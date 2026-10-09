// How a state speaks to this machine's built site: signed in, with the token signin:token saved for
// it — or with nothing, as a visitor. Used by site:seed (seed.mjs) and site:demo (demo.mjs).
//
// Two ways, and neither is written by hand:
//   emdash   EmDash's own client, from the site's packages (emdash-client.mjs): the model, entries,
//            uploads, terms, menus to read, search
//   send     a request the client has no call for — a setting, a menu item, a widget, a section, a
//            byline, a redirect, a comment, a token, a backup. Its path, method, body and answer are
//            typed from EmDash's own list of its requests (emdash-requests.d.ts): one EmDash does not
//            have fails the type check
// Nothing here prints a token, and a refusal is told in the site's own words.
import { join } from "node:path";

import { Refused, emdashClient } from "./emdash-client.mjs";
import { savedName } from "./signin.mjs";

/**
 * @typedef {import("./graph.mjs").Ctx} Ctx
 * @typedef {import("./emdash-client.mjs").Client} Client
 * @typedef {import("./emdash-requests.js").Send} Send
 * @typedef {import("./emdash-requests.js").Find} Find
 * What a page of the site answered a visitor.
 * @typedef {{ status: number, text: string, headers: Record<string, string> }} Page
 * @typedef {object} Api
 * @property {string} origin    the built site's address
 * @property {Client} emdash    EmDash's own client, signed in
 * @property {Send} send        a request the client has no call for, signed in: its data — or, refused, what the site answered, thrown
 * @property {Find} find        a GET of one thing: its data, or null when the site has no such thing
 * @property {{ emdash: Client, send: Send, page: (path: string) => Promise<Page> }} visitor   the same with no sign-in, and a page of the site: what anyone gets
 */

/** What has to be so, or the work stops with these words. @type {(so: unknown, otherwise: string) => asserts so} */
export const sure = (so, otherwise) => {
	if (!so) throw new Error(otherwise);
};
/**
 * The one in a list that has this value in this field; null when none has.
 * @template T @template {keyof T} K @param {T[]} list @param {K} field @param {T[K]} value @returns {T | null}
 */
export const one = (list, field, value) => list.find((item) => item[field] === value) ?? null;
/**
 * Only these keys of an object, and of them only those it has: what a request is given.
 * @template {object} T @template {keyof T} K @param {T} from @param {readonly K[]} keys @returns {Pick<T, K>}
 */
export const pick = (from, keys) => /** @type {Pick<T, K>} */ (Object.fromEntries(keys.filter((k) => from[k] !== undefined).map((k) => [k, from[k]])));

/**
 * The built site of this project, to ask. (A token needs no CSRF header.)
 * @param {Ctx} ctx @returns {Promise<Api>}
 */
export const connect = async ({ world, project }) => {
	const origin = `http://localhost:${project.builtPort}`;
	const file = join(world.config, "emdash-run", "tokens", `${savedName(origin, project.site)}.json`);
	sure(world.exists(file), `This machine has no saved sign-in for ${origin}. Run: mise run signin:token`);
	/** @type {string} */
	const token = JSON.parse(world.read(file)).token;
	/**
	 * One request, by a path of EmDash's list with its names filled in: the data of its answer.
	 * (What EmDash answers is JSON, and is whatever it is until the list says: `send` and `find` say.)
	 * @param {Record<string, string>} headers @param {string} method @param {string} path @param {unknown} given @returns {Promise<any>}
	 */
	const request = async (headers, method, path, given) => {
		const { path: names, query, body } = /** @type {{ path?: Record<string, string>, query?: Record<string, unknown>, body?: unknown }} */ (given ?? {});
		const at = path.replace(/\{(\w+)\}/g, (_, name) => encodeURIComponent(names?.[name] ?? ""));
		const search = new URLSearchParams(Object.entries(query ?? {}).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString();
		const ask = () => world.ask(`${origin}/_emdash/api${at}${search ? `?${search}` : ""}`, { method: method.toUpperCase(), headers: body === undefined ? headers : { ...headers, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), seconds: 60 });
		// A site that has only just been made or emptied is still setting itself up while it answers
		// its first requests — EmDash makes its tables and loads its own seed over several of them —
		// and until it has, asking for a list answers 500. Reading is asked again, a few times, a
		// little apart; a request that changes something is never sent twice.
		let answer = await ask();
		for (let again = 0; method.toUpperCase() === "GET" && answer.status >= 500 && again < 8; again++) {
			await world.sleep(2);
			answer = await ask();
		}
		let json = null;
		try { json = JSON.parse(answer.text); } catch {}
		// (what was asked is told without its query)
		if (answer.status < 200 || answer.status >= 300) throw new Refused(`${method.toUpperCase()} /_emdash/api${at}`, answer.status, json?.error?.message ? `${json.error.code ?? ""} ${json.error.message}`.trim() : (/<title>([^<]*)<\/title>/.exec(answer.text)?.[1] ?? answer.text.replace(/\s+/g, " ").slice(0, 200)));
		return json?.data;
	};
	/** The two ways to ask, with these headers. @param {Record<string, string>} headers @returns {{ send: Send, find: Find }} */
	const asker = (headers) => ({
		send: (method, path, ...given) => request(headers, String(method), path, given[0]),
		find: async (path, ...given) => {
			try {
				return await request(headers, "get", path, given[0]);
			} catch (e) {
				if (e instanceof Refused && e.status === 404) return null;
				throw e;
			}
		},
	});
	return {
		origin,
		emdash: await emdashClient(world, project.site, origin, token),
		...asker({ Authorization: `Bearer ${token}` }),
		visitor: {
			emdash: await emdashClient(world, project.site, origin),
			send: asker({}).send,
			page: async (path) => {
				const { status, text, headers } = await world.ask(new URL(path, origin).href, { seconds: 60 });
				return { status, text, headers };
			},
		},
	};
};
