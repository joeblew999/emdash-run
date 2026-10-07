// What `mise run live:access` runs: Cloudflare Access in front of a deployed EmDash site's admin,
// made with the Cloudflare login wrangler already holds. Wrangler has no command for Access, so
// this calls Cloudflare's API; it is the second and last script in this repo.
//
//   node access.mjs <site address> <site folder>
//
// It makes sure of three things, and changes nothing that is already there:
//   1. an Access application over <host>/_emdash — the admin and the API; the public site stays public
//   2. a policy that lets ADMIN_EMAIL in, by a code sent to that address
//   3. a service token for machines (the CLI, CI), allowed through by a second policy
// The service token's secret is written to ~/.config/emdash-run/access/<host>.json, readable by
// this user only, and is never printed. Cloudflare shows it once: lose the file and step 3 makes
// a new token.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const [url, siteDir] = process.argv.slice(2);
if (!url || !URL.canParse(url) || !siteDir) {
	console.error("This needs the address of the deployed site. Set LIVE_URL in the [env] block of mise.toml.");
	process.exit(1);
}
const email = process.env.ADMIN_EMAIL;
if (!email) {
	console.error("Who may sign in? Set ADMIN_EMAIL in the [env] block of mise.toml.");
	process.exit(1);
}
const { host } = new URL(url);
const tokenFile = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run", "access", `${host}.json`);

// The Cloudflare login: CLOUDFLARE_API_TOKEN if the developer set one, else the one wrangler holds.
const run = (args) =>
	execFileSync("pnpm", ["exec", "wrangler", ...args], {
		cwd: siteDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
		shell: process.platform === "win32",
	});
let bearer = process.env.CLOUDFLARE_API_TOKEN;
if (!bearer) {
	try {
		bearer = JSON.parse(run(["auth", "token", "--json"])).token;
	} catch {}
}
if (!bearer) {
	console.error("Not signed in to Cloudflare. Run: pnpm exec wrangler login");
	process.exit(1);
}
let account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!account) {
	const who = JSON.parse(run(["whoami", "--json"]));
	if (who.accounts?.length !== 1) {
		console.error("This Cloudflare login has more than one account. Set CLOUDFLARE_ACCOUNT_ID in the [env] block of mise.toml.");
		process.exit(1);
	}
	account = who.accounts[0].id;
}
const api = async (method, path, body) => {
	const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/access/${path}`, {
		method,
		headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
		body: body && JSON.stringify(body),
	});
	const j = await r.json().catch(() => ({}));
	if (!j.success) {
		const why = (j.errors || []).map((e) => e.message).join("; ") || `HTTP ${r.status}`;
		throw new Error(`Cloudflare refused ${method} access/${path}: ${why}. Wrangler's own login can read Access but not change it. Make an API token with "Access: Apps and Policies — Edit" and "Access: Service Tokens — Edit" (Cloudflare dashboard, My Profile, API Tokens) and set it as CLOUDFLARE_API_TOKEN.`);
	}
	return j.result;
};

try {
	// 1. the application
	const name = host.split(".")[0];
	const domain = `${host}/_emdash`;
	let app = (await api("GET", "apps")).find((a) => a.domain === domain);
	if (app) {
		console.log(`access: application "${app.name}" is already over ${domain}`);
	} else {
		app = await api("POST", "apps", { name, type: "self_hosted", domain, session_duration: "24h", app_launcher_visible: false });
		console.log(`access: application "${name}" made over ${domain}`);
	}
	const policies = app.policies || [];

	// 2. people
	if (policies.some((p) => p.decision === "allow")) {
		console.log("access: a policy already lets people in — left as it is");
	} else {
		await api("POST", `apps/${app.id}/policies`, { name: "people", decision: "allow", include: [{ email: { email } }] });
		console.log(`access: ${email} may sign in, by a code sent to that address`);
	}

	// 3. machines
	const saved = existsSync(tokenFile) ? JSON.parse(readFileSync(tokenFile, "utf8")) : null;
	if (saved && policies.some((p) => p.decision === "non_identity")) {
		console.log("access: the service token for machines is already saved on this machine");
	} else {
		const token = await api("POST", "service_tokens", { name: `${name}:emdash-run`, duration: "8760h" });
		mkdirSync(dirname(tokenFile), { recursive: true, mode: 0o700 });
		writeFileSync(tokenFile, JSON.stringify({ id: token.client_id, secret: token.client_secret }), { mode: 0o600 });
		chmodSync(tokenFile, 0o600);
		await api("POST", `apps/${app.id}/policies`, { name: "machines", decision: "non_identity", include: [{ service_token: { token_id: token.id } }] });
		console.log("access: a service token for machines made, allowed through, and saved on this machine");
	}

	const team = (await fetch(`https://${host}/_emdash/admin`, { redirect: "manual" })).headers.get("location") || "";
	console.log("");
	console.log("In the site's astro.config.mjs, inside emdash({ ... }):");
	console.log(`  auth: access({ teamDomain: "${team ? new URL(team).host : "<your-team>.cloudflareaccess.com"}", audienceEnvVar: "CF_ACCESS_AUDIENCE" }),`);
	console.log('  (and: import { access } from "@emdash-cms/cloudflare")');
	console.log("In wrangler.jsonc:");
	console.log(`  "vars": { "CF_ACCESS_AUDIENCE": "${app.aud}" },`);
	console.log('  "preview_urls": false,');
	console.log("Then: mise run live:ship");
} catch (error) {
	console.error(`live:access failed: ${error.message}`);
	process.exit(1);
}
