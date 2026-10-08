// What `mise run signin:access` runs: Cloudflare Access in front of a deployed EmDash site's admin,
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
console.error(`-> DEPLOYED site: ${new URL(url).origin}`);
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
// The Cloudflare token, from wherever the developer keeps it: the environment, else fnox (the
// secrets tool in the project's [tools]), else the login wrangler holds — which can read Access
// but not change it, so the first two are the ones that work.
const fromFnox = (key) => {
	try {
		return execFileSync("fnox", ["get", key], { cwd: siteDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], shell: process.platform === "win32" }).trim();
	} catch {
		return "";
	}
};
let bearer = process.env.CLOUDFLARE_API_TOKEN || fromFnox("CLOUDFLARE_API_TOKEN");
if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
	const id = fromFnox("CLOUDFLARE_ACCOUNT_ID");
	if (id) process.env.CLOUDFLARE_ACCOUNT_ID = id;
}
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
		throw new Error(`Cloudflare refused ${method} access/${path}: ${why}. Wrangler's own login can read Access but not change it. Make an API token with "Access: Apps and Policies — Edit" and "Access: Service Tokens — Edit" (Cloudflare dashboard, My Profile, API Tokens) and store it:  fnox set CLOUDFLARE_API_TOKEN`);
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
	// The same application over every preview address of this Worker (mise run live:preview):
	// <preview name>-<worker>.<account>.workers.dev. One application, so one audience — the site's
	// `auth: access(…)` line fits the previews as it fits the live site. Without this a preview's
	// admin, and on a new preview its setup wizard, is open to anyone who has the address.
	const previews = `*-${host}/_emdash`;
	const over = app.self_hosted_domains || [app.domain];
	if (host.endsWith(".workers.dev") && !over.includes(previews)) {
		app = await api("PUT", `apps/${app.id}`, { name: app.name, type: "self_hosted", domain, self_hosted_domains: [...new Set([domain, ...over, previews])], session_duration: app.session_duration || "24h", app_launcher_visible: false });
		console.log(`access: and over this Worker's preview addresses (${previews})`);
	} else if (over.includes(previews)) {
		console.log("access: already over this Worker's preview addresses");
	}
	const policies = app.policies || [];

	// 2. people
	if (policies.some((p) => p.decision === "allow")) {
		console.log("access: a policy already lets people in — left as it is");
	} else {
		await api("POST", `apps/${app.id}/policies`, { name: "people", decision: "allow", include: [{ email: { email } }] });
		// not the address itself: this output ends up in logs
		console.log("access: the address in ADMIN_EMAIL may sign in, by a code sent to it");
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

	// 4. uploaded media stays public. The application covers all of /_emdash, and the files a page
	// shows are served from under it: without this, a visitor's browser is sent to the sign-in page
	// for every image. A second application over that one path, which lets everyone through.
	const mediaDomain = `${host}/_emdash/api/media/file`;
	// The same for what plugins serve to visitors (a form's submit address, an indexing key):
	// /_emdash/api/plugins/. EmDash itself decides which of a plugin's routes are public; without
	// this Cloudflare sends a visitor's browser to the sign-in page before EmDash is asked.
	const open = [mediaDomain, `${host}/_emdash/api/plugins`];
	const mediaOver = host.endsWith(".workers.dev") ? [...open, ...open.map((d) => `*-${d}`)] : open;
	const mediaApp = (await api("GET", "apps")).find((a) => a.domain === mediaDomain);
	if (mediaApp && mediaOver.every((d) => (mediaApp.self_hosted_domains || [mediaApp.domain]).includes(d))) {
		console.log("access: uploaded media and plugins' public routes are already public");
	} else if (mediaApp) {
		await api("PUT", `apps/${mediaApp.id}`, { name: mediaApp.name, type: "self_hosted", domain: mediaDomain, self_hosted_domains: mediaOver, session_duration: "24h", app_launcher_visible: false });
		console.log("access: uploaded media and plugins' public routes stay public, on the preview addresses too");
	} else {
		const media = await api("POST", "apps", { name: `${name}: media`, type: "self_hosted", domain: mediaDomain, self_hosted_domains: mediaOver, session_duration: "24h", app_launcher_visible: false });
		await api("POST", `apps/${media.id}/policies`, { name: "everyone", decision: "bypass", include: [{ everyone: {} }] });
		console.log(`access: uploaded media stays public (${mediaDomain})`);
	}

	// The team's domain, from Cloudflare — it is known before the site is ever deployed. Failing
	// that (a token that may not read it), from where the deployed site sends a visitor.
	let team = "";
	try {
		const org = await api("GET", "organizations");
		if (org?.auth_domain) team = `https://${org.auth_domain}`;
	} catch {}
	if (!team) team = (await fetch(`https://${host}/_emdash/admin`, { redirect: "manual" }).catch(() => null))?.headers.get("location") || "";
	if (team && !new URL(team).host.endsWith(".cloudflareaccess.com")) team = "";
	console.log("");
	console.log("In the site's astro.config.mjs, inside emdash({ ... }):");
	console.log(`  auth: access({ teamDomain: "${team ? new URL(team).host : "<your-team>.cloudflareaccess.com"}", audienceEnvVar: "CF_ACCESS_AUDIENCE" }),`);
	console.log('  (and: import { access } from "@emdash-cms/cloudflare")');
	console.log("In wrangler.jsonc:");
	console.log(`  "vars": { "CF_ACCESS_AUDIENCE": "${app.aud}" },`);
	console.log('  "preview_urls": false,');
	if (!team) console.log("(The team's domain could not be read yet. Deploy — mise run live:ship — then run this again for it.)");
	console.log("Then: mise run live:ship");
} catch (error) {
	console.error(`signin:access failed: ${error.message}`);
	process.exit(1);
}
