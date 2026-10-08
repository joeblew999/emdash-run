// How a state speaks to this machine's built site through EmDash's HTTP API: signed in, with the
// token signin:token saved for it — or with nothing, as a visitor. Used by site:seed (seed.mjs) and
// site:demo (demo.mjs). Nothing here prints a token, and a refusal is told in the site's own words.
import { join } from "node:path";

import { savedName } from "./signin.mjs";

/**
 * @typedef {import("./graph.mjs").Ctx} Ctx
 * What the site answered. `data` and `error` are EmDash's own JSON: their shape is EmDash's, and is
 * read field by field where it is used.
 * @typedef {{ status: number, text: string, headers: Record<string, string>, data: any, error: { code?: string, message?: string } | undefined, asked: string }} Answer
 * @typedef {object} Api
 * @property {string} origin                                                              the built site's address
 * @property {(method: string, path: string, body?: unknown) => Promise<Answer>} ask      a path of the API, signed in
 * @property {(method: string, path: string, body?: unknown) => Promise<any>} must        the same: its data — or, refused, what the site answered, thrown
 * @property {(path: string) => Promise<any>} find                                        the data of a GET; null when there is no such thing
 * @property {(method: string, path: string, body?: unknown) => Promise<Answer>} visitor  a path of the site, with no sign-in: what anyone gets
 */

/** What has to be so, or the work stops with these words. @type {(so: unknown, otherwise: string) => asserts so} */
export const sure = (so, otherwise) => {
	if (!so) throw new Error(otherwise);
};
/** The one in a list EmDash answered with that has this value in this field; null when none has. @param {any[]} list @param {string} field @param {unknown} value @returns {any} */
export const one = (list, field, value) => list.find((item) => item[field] === value) ?? null;
/** Only these keys of an object, and of them only those it has: what a request is given. @param {Record<string, unknown>} from @param {string[]} keys */
export const pick = (from, keys) => Object.fromEntries(keys.filter((k) => from[k] !== undefined).map((k) => [k, from[k]]));

/**
 * What a site answered, in a few words — and never a token, should the answer have one in it.
 * @param {Answer} a
 */
const said = (a) => {
	if (a.status === 0) return "nothing. Is the built site running? mise run site:preview";
	const words = a.error?.message ? `${a.error.code ?? ""} ${a.error.message}` : (/<title>([^<]*)<\/title>/.exec(a.text)?.[1] ?? a.text.replace(/\s+/g, " ").slice(0, 200));
	return `${a.status} ${words.trim()}`.replace(/ec_pat_[\w-]+/g, "ec_pat_…").replace(/_preview=[^\s"&]+/g, "_preview=…").trim();
};
/** The data of an answer that says yes; one that says no is thrown, as what was asked and what the site said. @param {Answer} a @returns {any} */
export const good = (a) => {
	sure(a.status >= 200 && a.status < 300, `${a.asked} answered ${said(a)}`);
	return a.data;
};

/**
 * The built site of this project, to ask. (A token needs no CSRF header.)
 * @param {Ctx} ctx @returns {Api}
 */
export const client = ({ world, project }) => {
	const origin = `http://localhost:${project.builtPort}`;
	const file = join(world.config, "emdash-run", "tokens", `${savedName(origin, project.site)}.json`);
	sure(world.exists(file), `This machine has no saved sign-in for ${origin}. Run: mise run signin:token`);
	const token = JSON.parse(world.read(file)).token;
	/** @param {string} url @param {string} method @param {unknown} body @param {Record<string, string>} headers @returns {Promise<Answer>} */
	const send = async (url, method, body, headers) => {
		// a file goes as a form, which names its own type; everything else is JSON
		const form = body instanceof FormData;
		const answer = await world.ask(url, { method, headers: form || body === undefined ? headers : { ...headers, "Content-Type": "application/json" }, body: form ? body : body === undefined ? undefined : JSON.stringify(body), seconds: 60 });
		/** @type {any} */
		let json = null;
		try { json = JSON.parse(answer.text); } catch {}
		// (what was asked is kept without its query: a preview link's signature is in it)
		return { ...answer, data: json?.data, error: json?.error, asked: `${method} ${new URL(url).pathname}` };
	};
	/** @type {Api["ask"]} */
	const ask = (method, path, body) => send(`${origin}/_emdash/api${path}`, method, body, { Authorization: `Bearer ${token}` });
	return {
		origin,
		ask,
		must: async (method, path, body) => good(await ask(method, path, body)),
		find: async (path) => {
			const answer = await ask("GET", path);
			return answer.status === 404 ? null : good(answer);
		},
		visitor: (method, path, body) => send(new URL(path, origin).href, method, body, {}),
	};
};
