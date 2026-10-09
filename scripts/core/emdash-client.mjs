// EmDash's own client — the one its CLI is built on — for what it has a call for: the model, entries,
// uploads, terms, menus (to read them), search. It is loaded from the site's own packages, so it is
// always the client of the EmDash that site runs. What it has no call for is asked as a request,
// typed from EmDash's list of its requests (api.mjs).
//
// Its requests go through World, like everything else that leaves the program. The client takes
// "interceptors", each of which may answer a request itself: the one given here does, by asking
// World — so the client never reaches the network by itself, and a test, which gives a made-up
// World, sees every request it makes.

/**
 * @typedef {import("./world.mjs").World} World
 *
 * What the client answers with, as its own declarations have it (dist/client/index.d.mts, EmDash
 * 1.2.0), cut down to what is read here and kept in step by hand: the package is the site's, and
 * the type check has to pass where no site is installed. (Where the site answers null and the
 * client's declarations say "may be left out", null is said here.)
 * @typedef {{ id: string, type: string, slug: string | null, status: string, data: Record<string, unknown>, publishedAt: string | null, scheduledAt: string | null, _rev?: string }} Entry
 * @typedef {{ slug: string, type: string, validation?: unknown }} Field
 * @typedef {{ slug: string, label: string, fields: Field[] }} Collection
 * @typedef {{ id: string, slug: string, label: string, parentId?: string | null, children?: Term[] }} Term   (children: the terms under it — the site lists a taxonomy as a tree, which the client's declarations do not say)
 * @typedef {{ id: string, type: string, label: string, customUrl?: string | null, referenceCollection?: string | null, referenceId?: string | null, parentId?: string | null }} MenuItem
 * @typedef {{ id: string, filename: string, mimeType: string, width?: number | null, height?: number | null, alt?: string | null }} Uploaded
 *
 * The calls of the client that the tasks make.
 * @typedef {object} Client
 * @property {(slug: string) => Promise<Collection>} collection                a collection and its fields
 * @property {() => Promise<{ name: string, label: string }[]>} taxonomies
 * @property {(taxonomy: string) => Promise<{ items: Term[] }>} terms
 * @property {(taxonomy: string, input: { slug: string, label: string, parentId?: string, description?: string }) => Promise<unknown>} createTerm
 * @property {(collection: string, id: string, options?: { raw?: boolean }) => Promise<Entry>} get   by id or slug. raw: its data as it is kept (without it, a body comes back as markdown)
 * @property {(collection: string, options?: { status?: string, limit?: number }) => Promise<{ items: Entry[] }>} list
 * @property {(collection: string, id: string, input: { data?: Record<string, unknown>, _rev?: string }) => Promise<Entry>} update   the entry's data, and nothing else of it
 * @property {(collection: string, id: string) => Promise<void>} publish
 * @property {(collection: string, id: string) => Promise<void>} unpublish
 * @property {(collection: string, id: string, options: { at: string }) => Promise<void>} schedule
 * @property {(file: Uint8Array<ArrayBuffer> | Blob, filename: string, options?: { alt?: string, caption?: string, contentType?: string }) => Promise<Uploaded>} mediaUpload
 * @property {(name: string) => Promise<{ name: string, label: string, items: MenuItem[] }>} menu
 * @property {(query: string, options?: { limit?: number }) => Promise<{ id: string, collection: string, title: string }[]>} search
 */

/** The calls above, by name: each is looked for on the client the site has. */
const CALLS = /** @type {const} */ (["collection", "taxonomies", "terms", "createTerm", "get", "list", "update", "publish", "unpublish", "schedule", "mediaUpload", "menu", "search"]);

/** A request the site said no to: what was asked and what it said, and the status it said it with. */
export class Refused extends Error {
	/** @param {string} asked @param {number} status @param {string} said */
	constructor(asked, status, said) {
		// (never a token, should the answer have one in it; nor a preview link's signature)
		super(`${asked} answered ${status ? `${status} ${said}` : "nothing. Is the built site running? mise run site:preview"}`.replace(/ec_pat_[\w-]+/g, "ec_pat_…").replace(/_preview=[^\s"&]+/g, "_preview=…").trim());
		this.status = status;
	}
}
/** What was asked for, or null when the site has no such thing: a 404 is an answer, not a failure. @template T @param {Promise<T>} asked @returns {Promise<T | null>} */
export const orNone = (asked) =>
	asked.catch((e) => {
		if (e instanceof Refused && e.status === 404) return null;
		throw e;
	});

/**
 * EmDash's client for a site, from that site's own packages.
 * @param {World} world @param {string} site the site's folder @param {string} origin the site's address @param {string} [token] none: asked as a visitor
 * @returns {Promise<Client>}
 */
export const emdashClient = async (world, site, origin, token) => {
	const loaded = /** @type {{ EmDashClient?: new (options: { baseUrl: string, token?: string, interceptors: ((request: Request) => Promise<Response>)[] }) => Record<string, unknown> }} */ (await world.load(site, "emdash/client"));
	if (typeof loaded.EmDashClient !== "function") throw new Error(`The EmDash in ${site} has no client to load (emdash/client). Are the site's packages installed? mise run site:start`);
	let asked = "";
	const real = new loaded.EmDashClient({
		baseUrl: origin,
		token,
		interceptors: [
			// The last word on every request the client makes: asked of World, never of the network.
			async (request) => {
				asked = `${request.method} ${new URL(request.url).pathname}`;
				const headers = Object.fromEntries(request.headers);
				// a file goes as a form, which names its own type when it is sent; everything else is text
				const form = (headers["content-type"] ?? "").startsWith("multipart/form-data");
				if (form) delete headers["content-type"];
				const body = ["GET", "HEAD"].includes(request.method) ? undefined : form ? await request.formData() : (await request.text()) || undefined;
				const answer = await world.ask(request.url, { method: request.method, headers, body, seconds: 60 });
				if (answer.status === 0) throw new Refused(asked, 0, "");
				return new Response([204, 205, 304].includes(answer.status) ? null : answer.text, { status: answer.status, headers: { "content-type": answer.headers["content-type"] ?? "application/json" } });
			},
		],
	});
	/** One call: when the site refuses it, what was asked and what the site said — as a request of the tasks' own says it. @param {string} name */
	const call = (name) => {
		const method = real[name];
		if (typeof method !== "function") throw new Error(`The client of the EmDash in ${site} has no "${name}", which these tasks call: they were written for EmDash 1.2.`);
		return async (/** @type {unknown[]} */ ...given) => {
			try {
				return await method.apply(real, given);
			} catch (e) {
				if (e instanceof Refused) throw e;
				const refusal = /** @type {{ status?: number, code?: string, message?: string }} */ (e ?? {});
				throw typeof refusal.status === "number" ? new Refused(asked, refusal.status, `${refusal.code ?? ""} ${refusal.message ?? ""}`.trim()) : e;
			}
		};
	};
	return /** @type {Client} */ (/** @type {unknown} */ (Object.fromEntries(CALLS.map((name) => [name, call(name)]))));
};
