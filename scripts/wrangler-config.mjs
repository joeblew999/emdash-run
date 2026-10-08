// What the scripts need to know about a Cloudflare site's wrangler.jsonc, read in one place.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// JSON with comments and trailing commas, as wrangler writes it.
export const parseJsonc = (/** @type {string} */ text) => {
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '"') {
			const start = i;
			for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === "\\") i++;
			out += text.slice(start, i + 1);
		} else if (c === "/" && text[i + 1] === "/") {
			while (i < text.length && text[i] !== "\n") i++;
			out += "\n";
		} else if (c === "/" && text[i + 1] === "*") {
			i = text.indexOf("*/", i + 2) + 1;
		} else {
			out += c;
		}
	}
	return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
};

// A Cloudflare site is one with a wrangler config, whatever its format.
export const isCloudflare = (/** @type {string} */ siteDir) => ["wrangler.jsonc", "wrangler.json", "wrangler.toml"].some((f) => existsSync(join(siteDir, f)));
export const wranglerFile = (/** @type {string} */ siteDir) => ["wrangler.jsonc", "wrangler.json"].map((f) => join(siteDir, f)).find((f) => existsSync(f));
export const wranglerConfig = (/** @type {string} */ siteDir) => {
	const file = wranglerFile(siteDir);
	return file ? parseJsonc(readFileSync(file, "utf8")) : null;
};

// Is this address one of the Worker's PREVIEWS (mise run live:preview)? Cloudflare names them
// <preview name>-<worker>.<account>.workers.dev. A preview has a database of its own, named in the
// `previews` block; it is behind the same Cloudflare Access application as the live site, so what
// this machine saved for the live address — the Access pass — is the one to use.
/** @param {string} url @param {string} siteDir */
export const previewOf = (url, siteDir) => {
	const config = wranglerConfig(siteDir);
	if (!config?.name || !URL.canParse(url)) return null;
	const { hostname } = new URL(url);
	const at = hostname.indexOf(`-${config.name}.`);
	if (at <= 0 || !hostname.endsWith(".workers.dev")) return null;
	return {
		name: hostname.slice(0, at),
		liveHost: hostname.slice(at + 1),
		database: config.previews?.d1_databases?.[0]?.database_name ?? null,
	};
};

// WHICH deployed site: the live one (LIVE_URL), or — with LIVE_PREVIEW=<name> in the environment
// or in mise.local.toml — the preview of that name. One switch for every task that takes --live,
// so a branch's checkout can say once that its "deployed site" is its preview.
export const deployedAddress = (/** @type {string} */ url) => {
	const name = process.env.LIVE_PREVIEW;
	if (!name || !URL.canParse(url)) return url;
	const u = new URL(url);
	if (!u.hostname.endsWith(".workers.dev") || u.hostname.startsWith(`${name}-`)) return url;
	u.hostname = `${name}-${u.hostname}`;
	return u.href.replace(/\/$/, "");
};
