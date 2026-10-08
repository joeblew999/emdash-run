// What the registry plugin tasks share: how they speak to a site's admin, and to EmDash's registry.
// One client, used by scripts/plugin-install.mjs (install, remove, update) and scripts/plugin-works.mjs.
//
// A request to the site carries what this machine saved for it: the API token of `signin:token`
// and, behind Cloudflare Access, the pass of `signin:access`. Neither is ever printed.
// Asked of EmDash, as an idea (emdash-cms/emdash discussion 3999): `emdash plugin install|remove|list`,
// which would replace the requests made with this.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { deployedAddress, isCloudflare, previewOf } from "./wrangler-config.mjs";

export const win = process.platform === "win32";
export const projectDir = process.env.MISE_PROJECT_ROOT || process.env.MISE_CONFIG_ROOT || process.cwd();
export const fail = (message) => {
	console.error(message);
	process.exit(1);
};
// One of the project's own tasks.
export const mise = (task, quiet = true) => spawnSync("mise", ["run", ...task], { cwd: projectDir, stdio: quiet ? ["ignore", "ignore", "inherit"] : "inherit", shell: win });
// The site a task acts on: this machine's built site, or — `deployed` — the one at LIVE_URL, which
// with LIVE_PREVIEW=<name> is that preview of it (wrangler-config.mjs).
export const siteAddress = (given, deployed) => {
	const url = deployed ? deployedAddress(given) : given;
	if (!url || !URL.canParse(url)) fail("This needs the address of the deployed site. Set LIVE_URL in the [env] block of mise.toml.");
	return url;
};
// Did whoever ran the task say yes to what it printed?
export const agreed = (flags) => flags.includes("--yes") || ["1", "true", "yes"].includes(String(process.env.MISE_YES || "").toLowerCase()) || !!process.env.CI;

const savedName = (url, siteDir) => {
	const { host, hostname } = new URL(url);
	const safe = host.replace(/[^a-zA-Z0-9.-]/g, "_");
	const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname) || hostname.endsWith(".localhost");
	return local ? `${safe}_${createHash("sha256").update(resolve(siteDir)).digest("hex").slice(0, 10)}` : safe;
};
export const whereIs = (u) => {
	const { origin, port, hostname } = new URL(u);
	if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return `DEPLOYED site: ${origin}`;
	return `this machine, ${port === (process.env.PREVIEW_PORT || "4322") ? "built site (site:preview)" : "dev site (site:start)"}: ${origin}`;
};
const saved = (kind, url, siteDir) => {
	const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run", kind);
	let f = join(dir, `${savedName(url, siteDir)}.json`);
	// a preview of the Worker is behind the live site's Access application: the same pass
	const preview = kind === "access" && !existsSync(f) ? previewOf(url, siteDir) : null;
	if (preview) f = join(dir, `${preview.liveHost}.json`);
	return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
};
// What the site said a registry plugin declares, kept when plugin:install installs it: EmDash has
// no request that lists an installed plugin's public routes (asking it to verify again answers
// 409 ALREADY_INSTALLED), and plugin:works wants to ask them.
export const declared = (url, siteDir, key, value) => {
	const f = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run", "plugins", `${savedName(url, siteDir)}.json`);
	const all = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
	if (value === undefined) return all[key] ?? null;
	all[key] = value;
	mkdirSync(dirname(f), { recursive: true, mode: 0o700 });
	writeFileSync(f, JSON.stringify(all, null, 1), { mode: 0o600 });
	chmodSync(f, 0o600);
};
// `visitor`: nothing saved is sent — the request a stranger's browser would make.
export const client = (url, siteDir, visitor = false) => async (method, path, body) => {
	const token = visitor ? null : saved("tokens", url, siteDir);
	const pass = visitor ? null : saved("access", url, siteDir);
	const headers = {
		...(token ? { Authorization: `Bearer ${token.token}` } : {}),
		...(pass ? { "CF-Access-Client-Id": pass.id, "CF-Access-Client-Secret": pass.secret } : {}),
		...(body ? { "Content-Type": "application/json" } : {}),
	};
	for (let attempt = 1; ; attempt++) try {
		const res = await fetch(new URL(path, url), { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual", signal: AbortSignal.timeout(120_000) });
		const text = await res.text();
		let json = null;
		try {
			json = JSON.parse(text);
		} catch {}
		return { status: res.status, ok: res.ok, text, data: json?.data, error: json?.error, location: res.headers.get("location") ?? "" };
	} catch (error) {
		// Seen three times in one plugin:works run over 17 plugins on a local Cloudflare site, and not
		// explained: a GET that got no answer, and got one when asked again. A read is asked twice before it is called unanswered; a write never is.
		if (attempt === 1 && method === "GET") continue;
		return { status: 0, ok: false, text: `${error.message} ${error.cause?.code ?? ""} ${error.cause?.message ?? ""}`.trim(), data: undefined, error: undefined };
	}
};
export const said = (r) => `${r.status || "no answer"} ${r.error ? `${r.error.code}: ${r.error.message}` : r.text.replace(/\s+/g, " ").slice(0, 300)}`;
export const reference = (ref) => {
	// with a version to hold it to: @publisher/slug@1.2.3
	const m = /^@?([^/\s]+)\/([a-zA-Z][a-zA-Z0-9_-]*)(?:@(\d[\w.+-]*))?$/.exec(ref);
	if (!m) fail(`[${ref}] is not <publisher>/<slug> — as the search prints it, e.g. @netdollar.dev/forms, or with a version: @netdollar.dev/forms@0.1.0`);
	return { publisher: m[1], slug: m[2], name: `@${m[1]}/${m[2]}`, version: m[3] || null };
};
// <publisher>/<slug> → the registry's record of it (did, latestVersion), asked of the aggregator as
// the admin asks: resolvePackage for a handle, getPackage for a DID.
export const lookUp = async (aggregatorUrl, w) => {
	const q = w.publisher.startsWith("did:") ? `getPackage?did=${encodeURIComponent(w.publisher)}` : `resolvePackage?handle=${encodeURIComponent(w.publisher)}`;
	try {
		const res = await fetch(`${aggregatorUrl.replace(/\/$/, "")}/xrpc/com.emdashcms.experimental.aggregator.${q}&slug=${encodeURIComponent(w.slug)}`, { signal: AbortSignal.timeout(60_000) });
		const json = await res.json().catch(() => ({}));
		return res.ok && json.did ? { pkg: json } : { why: `${res.status} ${json.error ?? ""}: ${json.message ?? ""}` };
	} catch (error) {
		return { why: `${aggregatorUrl} did not answer: ${error.cause?.code || error.message}` };
	}
};
// One release of a package, as the registry's aggregator lists it — the request EmDash itself makes
// to find the release an update names (listReleases, page by page).
export const releaseOf = async (aggregatorUrl, did, slug, version) => {
	const base = `${aggregatorUrl.replace(/\/$/, "")}/xrpc/com.emdashcms.experimental.aggregator.listReleases?did=${encodeURIComponent(did)}&package=${encodeURIComponent(slug)}&limit=50`;
	const seen = [];
	try {
		for (let cursor = "", page = 0; page < 20; page++) {
			const res = await fetch(base + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""), { signal: AbortSignal.timeout(60_000) });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) return { why: `${res.status} ${json.error ?? ""}: ${json.message ?? ""}`, versions: seen };
			for (const r of json.releases ?? []) seen.push(r.version);
			const found = (json.releases ?? []).find((r) => r.version === version);
			if (found) return { release: found, versions: seen };
			if (!json.cursor) break;
			cursor = json.cursor;
		}
		return { why: "the registry has no such release", versions: seen };
	} catch (error) {
		return { why: `${aggregatorUrl} did not answer: ${error.cause?.code || error.message}`, versions: seen };
	}
};
// What a release says it needs, one line each, in the registry's own words: `content.write`,
// `network.request to api.example.com`. Two releases listed this way can be compared like for like.
export const accessOf = (release) => {
	const access = release?.release?.extensions?.["com.emdashcms.experimental.package.releaseExtension"]?.declaredAccess ?? {};
	const lines = [];
	for (const [area, verbs] of Object.entries(access)) {
		for (const [verb, options] of Object.entries(verbs ?? {})) {
			if (area !== "network") lines.push(`${area}.${verb}`);
			// no list of hosts is any host; a list, even an empty one, is those hosts only (the lexicon's meaning)
			else if (!Array.isArray(options?.allowedHosts)) lines.push(`${area}.${verb} to any host`);
			else lines.push(...(options.allowedHosts.length ? options.allowedHosts.map((h) => `${area}.${verb} to ${h}`) : [`${area}.${verb} to no host`]));
		}
	}
	return lines.sort();
};
// A Node site, after a plugin was installed or removed while it ran: EmDash restarts its sandbox
// process in place, the old one keeps the port, and from then on no sandboxed plugin answers
// ("bind(): Address already in use" — docs/upstream.md). Stopping and starting the site, with
// site:stop clearing the old process, is what gets them all running. A Cloudflare site needs none of it.
export const restartNode = (siteDir) => {
	if (isCloudflare(siteDir)) return;
	console.log("A Node site: restarting it, so its sandbox process starts with the plugins it now has (mise run site:preview)…");
	mise(["site:preview"]);
};
// A site on this machine: built and serving what is on disk now, and a token for it. `rebuild`
// when something the build is made from was just changed.
export const ready = async (url, siteDir, api, rebuild) => {
	if (rebuild || (await api("GET", "/")).status === 0) {
		console.log(`${rebuild ? "The site's config changed" : `Nothing is answering at ${new URL(url).origin}`}: building and starting it (mise run site:preview)…`);
		mise(["site:preview"]);
		// Seen once, in the full test, on one of two Cloudflare sites started in the same second: the
		// built site came up answering 500 "Error: listen EADDRINUSE: …" to everything. Started
		// again, it is fine — so once more, and say what it had said.
		const up = await api("GET", "/");
		if (up.status !== 200) {
			console.log(`The built site started but answers ${up.status || "nothing"}: ${up.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)}\nStarting it once more (mise run site:preview)…`);
			mise(["site:preview"]);
		}
	}
	if ((await api("GET", "/_emdash/api/admin/plugins")).status !== 200) mise(["signin:token"]);
};
