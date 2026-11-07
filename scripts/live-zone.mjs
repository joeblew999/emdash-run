// live:zone — the settings of the Cloudflare zone a deployed site's domain is in, as Coywolf runs
// its EmDash sites (https://notes.recollect.fyi/share/nSejSR2HYjlL4dQGCox3q2, read 2026-11-07):
//
//   Smart Tiered Cache   the zone's cache asks one upper tier before the origin (the media host;
//                        a Worker's own cache is not the zone's and is not changed by this)
//   Early Hints          a 103 with the page's preconnect Link header, sent before the page
//   two custom rules     on the site's host only, never the rest of the zone:
//                        - a Managed Challenge to unverified bots that say they are Chrome before
//                          140 or iOS 15 and earlier (Coywolf: scrapers were its largest CPU cost)
//                        - a block of WordPress probes: *.php, /wp-admin, /wp-json, /wp-content, /wp-includes
//
// Written for the Free plan: its rules cannot use regular expressions (`matches` is Business and
// up), so the versions are spelt out with `contains`. Each setting and rule is printed before it is
// sent; one already so, and a rule already there under its name, is left as it is.
//
//   main([<the deployed site's address>, <the site's folder>])   (scripts/core/tasks.mjs calls it)
//
// It needs an API token that may change the zone: CLOUDFLARE_API_TOKEN, or fnox's, with Zone →
// Zone Settings → Edit and Zone → Zone WAF → Edit. Wrangler's own login cannot.
import { execFileSync } from "node:child_process";

import { Exit } from "./core/calls.mjs";

export const CHALLENGE = "emdash-run: challenge outdated browser user agents (scrapers)";
export const PROBES = "emdash-run: block WordPress probes";

// "Chrome/N" for every N before 140, without a regular expression. A prefix covers every version
// that starts with it: "Chrome/2" is 2, 20–29 and 200–299 (none yet); "Chrome/13" is 13 and
// 130–139. 14–19 are named whole ("Chrome/14."), so that 140 and later are not caught.
export const oldChrome = () => [..."23456789"].map((d) => `Chrome/${d}`).concat(["10", "11", "12", "13"].map((p) => `Chrome/${p}`), ["14", "15", "16", "17", "18", "19"].map((v) => `Chrome/${v}.`));
// iOS 15 and earlier, as iPhones and iPads say it.
export const oldIos = () => Array.from({ length: 14 }, (_, i) => i + 2).flatMap((v) => [`iPhone OS ${v}_`, `CPU OS ${v}_`]);

/** The two rules, for the site's host. @param {string} host */
export const rules = (host) => {
	if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error(`[${host}] is not a host name`);
	const any = (/** @type {string[]} */ parts) => parts.map((p) => `http.user_agent contains "${p}"`).join(" or ");
	return [
		{
			description: CHALLENGE,
			action: "managed_challenge",
			expression: `(http.host eq "${host}" and not cf.client.bot and (${any(oldChrome())} or ${any(oldIos())}))`,
		},
		{
			description: PROBES,
			action: "block",
			expression: `(http.host eq "${host}" and (http.request.uri.path wildcard "*.php" or starts_with(http.request.uri.path, "/wp-admin") or starts_with(http.request.uri.path, "/wp-json") or starts_with(http.request.uri.path, "/wp-content") or starts_with(http.request.uri.path, "/wp-includes")))`,
		},
	];
};

/** @param {string[]} argv */
export async function main(argv) {
	const [address, siteDir] = argv;
	if (!address || !URL.canParse(address)) {
		console.error("live:zone needs the deployed site's address: LIVE_URL in the [env] block of mise.toml.");
		throw new Exit(1);
	}
	const { hostname: host } = new URL(address);
	if (host.endsWith(".workers.dev")) {
		console.error(`[${host}] is a workers.dev address: it is in no zone of yours, so there is nothing to set. Give the Worker a custom domain first (routes in wrangler.jsonc, then mise run live:ship) and set LIVE_URL to it.`);
		throw new Exit(1);
	}
	const fromFnox = (/** @type {string} */ key) => {
		try {
			return execFileSync("fnox", ["get", key], { cwd: siteDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], shell: process.platform === "win32" }).trim();
		} catch {
			return "";
		}
	};
	const token = process.env.CLOUDFLARE_API_TOKEN || fromFnox("CLOUDFLARE_API_TOKEN");
	if (!token) {
		console.error("live:zone changes the zone, which wrangler's login cannot: make an API token with Zone → Zone Settings → Edit and Zone → Zone WAF → Edit (Cloudflare dashboard, My Profile, API Tokens) and give it as CLOUDFLARE_API_TOKEN, or store it: fnox set CLOUDFLARE_API_TOKEN. Nothing was changed.");
		throw new Exit(1);
	}
	const api = async (/** @type {string} */ method, /** @type {string} */ path, /** @type {any} */ body = undefined) => {
		const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
			method,
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const json = /** @type {any} */ (await r.json().catch(() => ({})));
		if (!r.ok || json.success === false) {
			console.error(`Cloudflare refused ${method} ${path}: HTTP ${r.status} ${(json.errors ?? []).map((/** @type {any} */ e) => e.message).join("; ")}`);
			throw new Exit(1);
		}
		return json.result;
	};

	// the zone: the longest name the host ends with
	const labels = host.split(".");
	let zone = null;
	for (let i = 0; i < labels.length - 1 && !zone; i++) zone = (await api("GET", `/zones?name=${labels.slice(i).join(".")}`))[0] ?? null;
	if (!zone) {
		console.error(`No zone this token can see holds ${host}. Nothing was changed.`);
		throw new Exit(1);
	}
	console.log(`zone: ${zone.name} (${zone.plan?.name ?? "plan unknown"}), for the site at ${host}`);

	for (const [name, path] of [
		["Smart Tiered Cache", `/zones/${zone.id}/cache/tiered_cache_smart_topology_enable`],
		["Early Hints", `/zones/${zone.id}/settings/early_hints`],
	]) {
		const now = (await api("GET", path)).value;
		if (now === "on") console.log(`${name}: already on`);
		else {
			console.log(`${name}: ${now} -> on`);
			await api("PATCH", path, { value: "on" });
		}
	}

	const phase = `/zones/${zone.id}/rulesets/phases/http_request_firewall_custom/entrypoint`;
	const entry = await fetch(`https://api.cloudflare.com/client/v4${phase}`, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => (r.status === 404 ? null : (await r.json()).result));
	const have = /** @type {{ description?: string }[]} */ (entry?.rules ?? []);
	const missing = rules(host).filter((r) => !have.some((h) => h.description === r.description));
	for (const r of rules(host)) console.log(`custom rule [${r.description}]: ${missing.includes(r) ? `adding: ${r.action} when ${r.expression.length > 160 ? `${r.expression.slice(0, 160)}…` : r.expression}` : "already there, left as it is"}`);
	if (missing.length) {
		if (entry) for (const r of missing) await api("POST", `/zones/${zone.id}/rulesets/${entry.id}/rules`, r);
		else await api("PUT", phase, { rules: missing });
	}
	console.log(`The zone's other sites keep their own: the two rules match http.host eq "${host}" only. Smart Tiered Cache and Early Hints are for the whole zone.`);
	throw new Exit(0);
}
