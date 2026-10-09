// site:seed — an EmDash seed file, applied to a site that is already running and is not empty.
//
// A seed file is EmDash's own way to say what a site is made of (seed/seed.json, checked against
// https://emdashcms.com/seed.schema.json). EmDash applies one by itself only on the first request
// to an empty database, and `emdash seed` writes to a SQLite file: neither reaches the database of
// a Cloudflare site once it is running. This applies the same file through the site's HTTP API:
// with EmDash's own client where it has a call for the thing, and with a request typed from
// EmDash's list of its requests where it has none (api.mjs says which is which, and why).
//
// THE RULE: each thing the file names is looked for; made when it is not there; left alone when it
// is — and looked for again once made, which is the proof. So it is safe to run again, and a run
// that stopped half way is picked up. It goes thing by thing: a menu that is there is given the
// items it lacks, where EmDash's own seeding empties the menu and fills it again. And never a near
// copy of what is there: a menu item is the one with its label or its destination, a widget the one
// of its kind (a component by which component, a menu's by which menu, words by their title).
//
// THE SECTIONS (below) are applied in the order EmDash applies them (src/seed/apply.ts in its
// package), so that what a thing names is there before it is named. To add one, add an entry. What
// is not applied — a section this cannot do yet, a key that is not EmDash's seed format — is said
// in a `skip` line: nothing in the file is passed over in silence.
import { isAbsolute, join } from "node:path";

import { connect, one, pick, sure } from "./api.mjs";
import { orNone } from "./emdash-client.mjs";

/**
 * @typedef {import("./graph.mjs").Graph} Graph @typedef {import("./graph.mjs").Ctx} Ctx @typedef {import("./api.mjs").Api} Api
 * A seed file, in EmDash's own shape (emdash-seed.d.ts): what a file is once EmDash's check has passed it.
 * @typedef {import("./emdash-seed.js").Seed} Seed
 * @typedef {import("./emdash-seed.js").SeedMenuItem} SeedMenuItem
 * @typedef {import("./emdash-seed.js").SeedPicture} SeedPicture
 * @typedef {import("./emdash-seed.js").SeedTerm} SeedTerm
 * @typedef {import("./emdash-requests.js").Shapes} Shapes
 * How a file is fetched from its address (World's download).
 * @typedef {import("./world.mjs").World["download"]} Download
 * What a section's work is handed.
 * @typedef {object} Hand
 * @property {Api} api
 * @property {<T>(name: string, have: () => Promise<T | null | undefined | false>, make: () => Promise<unknown>) => Promise<T | null>} thing   one thing the file names: what was found of it on the site — or null when it could not be done, which the section's line then says
 * @property {(what: string, why: string) => void} skip   something in the file that is not applied, and why
 * @property {Map<string, string>} entries   the id an entry has in the file -> the id it has on the site
 * @property {Map<string, string>} bylines   the same, for bylines
 * @property {Download} download
 * @property {boolean} replace               settings: write the file's value where the site has another (site:demo). Otherwise the site's own is left
 * @typedef {{ name: string, apply: (seed: Seed, hand: Hand) => Promise<void> }} Section
 * @typedef {{ made: number, had: number, failed: number, skipped: number }} Count
 */

// What EmDash's seed format has, object by object (seed.schema.json, where each of these is closed:
// no other key is allowed). A key that is not here is not applied, and is said.
/** @type {Record<string, string[]>} */
const KEYS = {
	seed: ["$schema", "version", "defaultLocale", "meta", "settings", "blockTypes", "collections", "relations", "taxonomies", "menus", "redirects", "widgetAreas", "sections", "bylines", "content"],
	settings: ["title", "tagline", "logo", "favicon", "url", "postsPerPage", "dateFormat", "timezone", "social", "seo"],
	collection: ["slug", "label", "labelSingular", "description", "icon", "admin", "supports", "urlPattern", "routable", "hidden", "sortOrder", "group", "commentsEnabled", "editLocking", "titleField", "dateField", "fields"],
	field: ["slug", "label", "type", "required", "unique", "searchable", "indexed", "translatable", "defaultValue", "validation", "widget", "options"],
	relation: ["slug", "parentCollection", "childCollection", "parentLabel", "parentLabelSingular", "childLabel", "childLabelSingular", "maxChildrenPerParent", "maxParentsPerChild"],
	taxonomy: ["id", "name", "label", "labelSingular", "hierarchical", "collections", "locale", "translationOf", "terms"],
	term: ["id", "slug", "label", "description", "parent", "locale", "translationOf"],
	menu: ["id", "name", "label", "locale", "translationOf", "items"],
	item: ["id", "type", "label", "url", "ref", "collection", "target", "titleAttr", "cssClasses", "locale", "translationOf", "children"],
	redirect: ["source", "destination", "type", "enabled", "groupName"],
	area: ["name", "label", "description", "widgets"],
	// (`settings` is in the format and EmDash's seeding drops it, with a warning: the widget areas say so in their turn)
	widget: ["type", "title", "content", "menuName", "componentId", "settings", "props"],
	section: ["slug", "title", "description", "keywords", "content", "source"],
	byline: ["id", "slug", "displayName", "bio", "websiteUrl", "isGuest", "avatar"],
	entry: ["id", "slug", "status", "data", "taxonomies", "bylines", "locale", "translationOf"],
};
const TRANSLATION = "a translation of another (translationOf): not applied by site:seed yet";

/** Is this an object with keys — not a list, not nothing? @param {unknown} value @returns {value is Record<string, unknown>} */
const keyed = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * What a seed file has that is not EmDash's seed format: each as its path in the file.
 * @param {unknown} file a seed file as it was read @returns {string[]}
 */
export const strangers = (file) => {
	/** @type {string[]} */
	const found = [];
	const look = (/** @type {unknown} */ thing, /** @type {string} */ kind, /** @type {string} */ path) => {
		if (keyed(thing)) for (const key of Object.keys(thing)) if (!KEYS[kind].includes(key)) found.push(`${path}${key}`);
	};
	/** @param {unknown} list @param {string} kind @param {string} path @param {(thing: Record<string, unknown>, path: string) => void} [inside] */
	const each = (list, kind, path, inside) => {
		for (const [i, thing] of (Array.isArray(list) ? list : []).entries()) {
			look(thing, kind, `${path}[${i}].`);
			inside?.(keyed(thing) ? thing : {}, `${path}[${i}].`);
		}
	};
	/** @param {unknown} list @param {string} path */
	const items = (list, path) => each(list, "item", path, (item, at) => items(item.children, `${at}children`));
	const seed = keyed(file) ? file : {};
	look(seed, "seed", "");
	look(seed.settings, "settings", "settings.");
	each(seed.collections, "collection", "collections", (c, at) => each(c.fields, "field", `${at}fields`));
	each(seed.relations, "relation", "relations");
	each(seed.taxonomies, "taxonomy", "taxonomies", (t, at) => each(t.terms, "term", `${at}terms`));
	each(seed.menus, "menu", "menus", (m, at) => items(m.items, `${at}items`));
	each(seed.redirects, "redirect", "redirects");
	each(seed.widgetAreas, "area", "widgetAreas", (a, at) => each(a.widgets, "widget", `${at}widgets`));
	each(seed.sections, "section", "sections");
	each(seed.bylines, "byline", "bylines");
	for (const [collection, entries] of Object.entries(keyed(seed.content) ? seed.content : {})) each(entries, "entry", `content.${collection}`);
	return found;
};

/** A value of an entry's data with every "$ref:id" in it made the id that entry has on the site. @param {unknown} value @param {Map<string, string>} entries @returns {unknown} */
const resolved = (value, entries) => {
	if (typeof value === "string" && value.startsWith("$ref:")) {
		const id = entries.get(value.slice(5));
		sure(id, `its data names the entry ${value.slice(5)}, which is not there yet: in the file, put that entry before this one`);
		return id;
	}
	if (Array.isArray(value)) return value.map((v) => resolved(v, entries));
	if (keyed(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolved(v, entries)]));
	return value;
};
/** Is this a picture named by its address ({ "$media": { "url": … } })? @param {unknown} value @returns {value is { $media: SeedPicture }} */
const pictured = (value) => keyed(value) && keyed(value.$media) && typeof value.$media.url === "string";
/** Is one anywhere inside this? @param {unknown} value */
const pictures = (value) => JSON.stringify(value ?? null).includes('"$media":');
const same = (/** @type {unknown} */ a, /** @type {unknown} */ b) => JSON.stringify(a) === JSON.stringify(b);
/**
 * Does what the site has hold what the file says? A group of settings by each one the file gives:
 * the site may hold more beside them (others of the group, or what it worked out itself).
 * @param {unknown} now @param {unknown} want @returns {boolean}
 */
const holds = (now, want) => (keyed(want) ? keyed(now) && Object.entries(want).every(([key, value]) => holds(now[key], value)) : same(now, want));
/** @type {Record<string, string>} */
const FILE_KINDS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif", "image/svg+xml": ".svg" };

/**
 * A picture the file names by its address, in the site's media library under its filename: fetched
 * and uploaded, with its alt text, when no item of that name is there (so one picture is fetched
 * once, however often it is named or the task is run). What an image field is given for it.
 * @param {Hand} hand @param {SeedPicture} media
 */
const picture = async ({ api, download }, media) => {
	sure(/^https?:\/\//.test(media.url), `its address is not one to fetch: ${media.url}`);
	const last = decodeURIComponent(new URL(media.url).pathname.split("/").pop() || "picture");
	const named = media.filename ?? last;
	// (asked of the library by name: EmDash's client lists the library, and has no way to ask it for one name)
	const listed = async (/** @type {string} */ name) => one((await api.send("get", "/media", { query: { q: name } })).items, "filename", name);
	let item = await listed(named);
	if (!item) {
		const file = await download(media.url);
		sure(file.status === 200 && file.bytes.length > 0, `GET ${media.url} answered ${file.status || "nothing"}`);
		// (a name with no ending is given the one its kind of file has: the library goes by it)
		const name = /\.\w+$/.test(named) ? named : `${named}${FILE_KINDS[file.type.split(";")[0]] ?? ""}`;
		item = await listed(name);
		if (!item) {
			await api.emdash.mediaUpload(file.bytes, name, { ...pick(media, ["alt", "caption"]), contentType: file.type });
			item = await listed(name);
			sure(item, `${name} was uploaded, and is not in the library when asked for again`);
		}
	}
	return { provider: "local", id: item.id, alt: media.alt ?? item.alt, width: item.width, height: item.height, filename: item.filename, mimeType: item.mimeType };
};

/** @type {Section[]} */
export const sections = [
	{
		// a setting the site has is the site's own: only one it has not is written (as EmDash's seeding does)
		name: "settings",
		apply: async (seed, { api, thing, replace }) => {
			const wanted = seed.settings ?? {};
			const keys = /** @type {(keyof typeof wanted)[]} */ (Object.keys(wanted));
			const here = keys.length ? await api.send("get", "/settings") : {};
			for (const key of keys) {
				const value = wanted[key];
				const own = !replace && here[key] != null && !holds(here[key], value);
				await thing(
					own ? `${key} (the site has its own: left as it is)` : key,
					async () => {
						const now = (await api.send("get", "/settings"))[key];
						return replace ? holds(now, value) : now != null;
					},
					// (POST: EmDash's own list of its requests says PUT, which the site answers with its 404 page)
					() => api.send("post", "/settings", { body: /** @type {Shapes["SettingsUpdateBody"]} */ (Object.fromEntries([[key, value]])) }),
				);
			}
		},
	},
	{
		name: "collections",
		apply: async (seed, { api, thing }) => {
			for (const c of seed.collections ?? []) {
				const made = await thing(
					c.slug,
					() => orNone(api.emdash.collection(c.slug)),
					// (as a request: the client's own call takes a collection's name and what it supports, and not its addresses, its place in the admin or where it came from)
					() => api.send("post", "/schema/collections", { body: { ...pick(c, ["slug", "label", "labelSingular", "description", "icon", "admin", "supports", "urlPattern", "routable", "hidden", "sortOrder", "group", "editLocking"]), source: "seed" } }),
				);
				// comments on or off is not part of making a collection: it is said to one that is there
				const comments = c.commentsEnabled;
				if (made && comments !== undefined) await thing(`${c.slug}: comments ${comments ? "on" : "off"}`, async () => (await api.send("get", "/schema/collections/{slug}", { path: { slug: c.slug } })).item.commentsEnabled === comments, () => api.send("put", "/schema/collections/{slug}", { path: { slug: c.slug }, body: { commentsEnabled: comments } }));
			}
		},
	},
	{
		// after the collections a relation joins, and before the fields that name it
		name: "relations",
		apply: async (seed, { api, thing }) => {
			for (const r of seed.relations ?? []) await thing(r.slug, async () => one((await api.send("get", "/relations")).relations, "slug", r.slug), () => api.send("post", "/relations", { body: pick(r, ["slug", "parentCollection", "childCollection", "parentLabel", "parentLabelSingular", "childLabel", "childLabelSingular", "maxChildrenPerParent", "maxParentsPerChild"]) }));
		},
	},
	{
		// the fields of the file's collections: one a collection lacks is added to it
		name: "fields",
		apply: async (seed, { api, thing }) => {
			for (const c of seed.collections ?? []) {
				const at = { path: { slug: c.slug } };
				// (as a request: the client's own call cannot say that a field is searched, indexed or translated)
				for (const f of c.fields ?? []) await thing(`${c.slug}.${f.slug}`, async () => one((await orNone(api.emdash.collection(c.slug)))?.fields ?? [], "slug", f.slug), () => api.send("post", "/schema/collections/{slug}/fields", { ...at, body: pick(f, ["slug", "label", "type", "required", "unique", "searchable", "indexed", "translatable", "defaultValue", "validation", "widget", "options"]) }));
				// the fields the admin lists an entry by: named once they are there
				for (const key of /** @type {const} */ (["titleField", "dateField"])) {
					const field = c[key];
					if (field !== undefined) await thing(`${c.slug}: ${key} ${field}`, async () => (await api.send("get", "/schema/collections/{slug}", at)).item[key] === field, () => api.send("put", "/schema/collections/{slug}", { ...at, body: key === "titleField" ? { titleField: field } : { dateField: field } }));
				}
			}
		},
	},
	{
		name: "blockTypes",
		apply: async (seed, { skip }) => {
			if (seed.blockTypes?.length) skip("blockTypes", `${seed.blockTypes.length} block types: not applied by site:seed yet (the file gives each as its versions; the API makes one from a single list of fields)`);
		},
	},
	{
		name: "taxonomies",
		apply: async (seed, { api, thing, skip }) => {
			for (const t of seed.taxonomies ?? []) {
				if (t.translationOf) {
					skip(`taxonomies: ${t.name} (${t.locale})`, TRANSLATION);
					continue;
				}
				if (!(await thing(t.name, async () => one(await api.emdash.taxonomies(), "name", t.name), () => api.send("post", "/taxonomies", { body: pick(t, ["name", "label", "labelSingular", "hierarchical", "collections", "locale"]) })))) continue;
				// (the site lists a taxonomy's terms as a tree: one under another is inside it, not beside it)
				/** @param {import("./emdash-client.mjs").Term[]} terms @returns {import("./emdash-client.mjs").Term[]} */
				const flat = (terms) => terms.flatMap((x) => [x, ...flat(x.children ?? [])]);
				const term = async (/** @type {string} */ slug) => one(flat((await api.emdash.terms(t.name)).items), "slug", slug);
				/** @type {SeedTerm[]} */
				const waiting = [];
				for (const x of t.terms ?? []) {
					if (x.translationOf) skip(`taxonomies: ${t.name}/${x.slug} (${x.locale})`, TRANSLATION);
					else waiting.push(x);
				}
				// (EmDash's client makes a term in the site's own language: it has no way to give it another)
				const elsewhere = waiting.filter((x) => x.locale).length;
				if (elsewhere) skip(`taxonomies: the language of ${elsewhere} term${elsewhere === 1 ? "" : "s"} of ${t.name}`, "EmDash's client gives a term none: made in the site's own language");
				// A term under another is made after it: the file names its parent by slug, the site by id.
				while (waiting.length) {
					const ready = waiting.filter((x) => !waiting.some((w) => w.slug === x.parent));
					for (const x of ready.length ? ready : [...waiting]) {
						waiting.splice(waiting.indexOf(x), 1);
						await thing(
							`${t.name}/${x.slug}`,
							() => term(x.slug),
							async () => {
								const parent = x.parent ? await term(x.parent) : null;
								sure(!x.parent || parent, `the term it is under, ${x.parent}, is not there`);
								await api.emdash.createTerm(t.name, { ...pick(x, ["slug", "label", "description"]), ...(parent ? { parentId: parent.id } : {}) });
							},
						);
					}
				}
			}
		},
	},
	{
		name: "bylines",
		apply: async (seed, { api, thing, skip, bylines }) => {
			for (const b of seed.bylines ?? []) {
				if (b.avatar) skip(`bylines: the avatar of ${b.slug}`, "a file already in the site's storage, which the API has no request to name: the byline is made without it");
				const made = await thing(b.slug, async () => one((await api.send("get", "/admin/bylines", { query: { search: b.slug } })).items, "slug", b.slug), () => api.send("post", "/admin/bylines", { body: pick(b, ["slug", "displayName", "bio", "websiteUrl", "isGuest"]) }));
				if (made) bylines.set(b.id, made.id);
			}
		},
	},
	{
		// before the menus, whose items name entries
		name: "content",
		apply: async (seed, hand) => {
			const { api, thing, skip, entries, bylines } = hand;
			for (const [collection, list] of Object.entries(seed.content ?? {})) {
				// a reference field that is bound to a relation is not given in an entry's data, but beside it
				const model = await orNone(api.emdash.collection(collection));
				const bound = (model?.fields ?? []).filter((f) => f.type === "reference" && keyed(f.validation) && f.validation.relation).map((f) => f.slug);
				for (const e of list) {
					const { slug } = e;
					const name = `${collection}/${slug ?? e.id}`;
					if (e.translationOf) skip(`content: ${name} (${e.locale})`, TRANSLATION);
					else if (!slug) skip(`content: ${name}`, "an entry with no slug cannot be found again on the site: not applied by site:seed yet");
					if (e.translationOf || !slug) continue;
					const find = () => orNone(api.emdash.get(collection, slug, { raw: true }));
					// An entry is published unless the file says draft (as EmDash's seeding has it).
					const live = (e.status ?? "published") === "published";
					// A picture that is a field's whole value is fetched and uploaded. One inside a body is not yet:
					// the block that holds it is left out, and that is said.
					const fields = Object.entries(e.data ?? {});
					const shown = fields.flatMap(([field, v]) => (pictured(v) ? [{ field, media: v.$media }] : []));
					const inside = fields.flatMap(([, v]) => (Array.isArray(v) ? v.filter(pictures) : !pictured(v) && pictures(v) ? [v] : [])).length;
					if (inside) skip(`content: ${name}`, `${inside} picture${inside === 1 ? "" : "s"} inside its fields (a block of a body): not applied by site:seed yet — the entry is made without ${inside === 1 ? "it" : "them"}`);
					const made = await thing(
						name,
						// There: it is on the site — and not half made. A draft that was never published, when the file
						// has it published, is one a run made and could not publish; a field with no picture, where the
						// file has one, is one a run could not fetch. Both are put right by the next run.
						async () => {
							const found = await find();
							return found && (!live || found.status !== "draft" || found.publishedAt) && shown.every(({ field }) => found.data[field]) ? found : null;
						},
						async () => {
							const found = await find();
							/** @type {Record<string, unknown>} */
							const fetched = {};
							/** @type {string[]} */
							const lost = [];
							for (const { field, media } of shown) {
								if (found?.data[field]) continue;
								try {
									fetched[field] = await picture(hand, media);
								} catch (error) {
									lost.push(`${field}: ${error instanceof Error ? error.message : String(error)}`);
								}
							}
							// (an entry somebody took back to a draft stays one)
							const publish = live && (!found || found.status === "published" || !found.publishedAt);
							let id = found?.id;
							if (!found) {
								/** @type {Record<string, unknown>} */
								const data = { ...Object.fromEntries(fields.filter(([, v]) => !pictured(v) && (Array.isArray(v) || !pictures(v))).map(([k, v]) => [k, resolved(Array.isArray(v) ? v.filter((x) => !pictures(x)) : v, entries)])), ...fetched };
								const references = Object.fromEntries(bound.filter((f) => data[f] != null).map((f) => [f, [data[f]].flat().map(String)]));
								for (const f of bound) delete data[f];
								const credits = (e.bylines ?? []).map((credit) => {
									const byline = bylines.get(credit.byline);
									sure(byline, `it is credited to the byline ${credit.byline}, which is not there`);
									return { bylineId: byline, ...pick(credit, ["roleLabel"]) };
								});
								// (as a request: the client's own call makes an entry of its data, and cannot give it its terms, its bylines or what it refers to)
								id = (await api.send("post", "/content/{collection}", { path: { collection }, body: { slug, data, ...pick(e, ["taxonomies", "locale"]), ...(credits.length ? { bylines: credits } : {}), ...(Object.keys(references).length ? { references } : {}) } })).item.id;
							} else if (Object.keys(fetched).length) await api.emdash.update(collection, found.id, { data: fetched, _rev: found._rev });
							if (publish && id) await api.emdash.publish(collection, id);
							sure(!lost.length, `it is there, without ${lost.length === 1 ? "a picture" : `${lost.length} pictures`} that could not be fetched (${lost.join("; ")}). Run again to fetch ${lost.length === 1 ? "it" : "them"}`);
						},
					);
					// (an entry that is there without its picture is still one a menu can name)
					const there = made ?? (await find());
					if (there) entries.set(e.id, there.id);
				}
			}
		},
	},
	{
		name: "menus",
		apply: async (seed, { api, thing, skip, entries }) => {
			for (const m of seed.menus ?? []) {
				if (m.translationOf) skip(`menus: ${m.name} (${m.locale})`, TRANSLATION);
				if (m.translationOf || !(await thing(m.name, () => orNone(api.emdash.menu(m.name)), () => api.send("post", "/menus", { body: pick(m, ["name", "label", "locale"]) })))) continue;
				/** @param {SeedMenuItem[] | undefined} items @param {string | null} parentId */
				const add = async (items, parentId) => {
					for (const item of items ?? []) {
						const label = item.label ?? item.url ?? item.ref ?? item.type;
						if (item.translationOf) {
							skip(`menus: ${m.name}/${label} (${item.locale})`, TRANSLATION);
							continue;
						}
						// What the site is asked for, as EmDash's own seeding writes an item: an item that is an entry
						// names it by the id it has in the file, and follows it from then on.
						const want = () => {
							const linked = item.type !== "custom" && item.type !== "taxonomy";
							const collection = item.collection ?? (item.type === "page" || item.type === "post" ? `${item.type}s` : undefined);
							sure(!linked || !item.ref || entries.has(item.ref), `it is the entry ${item.ref}, which is not there: the file's content does not have it, or it could not be made`);
							return { type: item.type, label: item.label ?? "", ...(item.url ? { customUrl: item.url } : {}), ...(linked && collection ? { referenceCollection: collection } : {}), ...(linked && item.ref ? { referenceId: entries.get(item.ref) } : {}), ...pick(item, ["target", "titleAttr", "cssClasses"]), ...(parentId ? { parentId } : {}) };
						};
						// The same item: beside the same items, one with its label, or one that leads to the same place.
						// (So "About" as an address and "About" as a page are one item, not two under one name.)
						/** @param {import("./emdash-client.mjs").MenuItem} i @param {ReturnType<typeof want>} w */
						const is = (i, w) => (i.parentId ?? null) === (w.parentId ?? null) && (i.label === w.label || (w.customUrl !== undefined ? i.customUrl === w.customUrl : w.referenceId !== undefined && i.referenceId === w.referenceId));
						const made = await thing(
							`${m.name}/${label}`,
							async () => {
								const w = want();
								return (await api.emdash.menu(m.name)).items.find((i) => is(i, w));
							},
							async () => api.send("post", "/menus/{name}/items", { path: { name: m.name }, body: want() }),
						);
						if (made) await add(item.children, made.id);
					}
				};
				await add(m.items, null);
			}
		},
	},
	{
		name: "redirects",
		apply: async (seed, { api, thing }) => {
			for (const r of seed.redirects ?? []) await thing(r.source, async () => one((await api.send("get", "/redirects", { query: { search: r.source } })).items, "source", r.source), () => api.send("post", "/redirects", { body: pick(r, ["source", "destination", "type", "enabled", "groupName"]) }));
		},
	},
	{
		name: "widgetAreas",
		apply: async (seed, { api, thing, skip }) => {
			for (const a of seed.widgetAreas ?? []) {
				const at = { path: { name: a.name } };
				if (!(await thing(a.name, () => api.find("/widget-areas/{name}", at), () => api.send("post", "/widget-areas", { body: pick(a, ["name", "label", "description"]) })))) continue;
				for (const w of a.widgets ?? []) {
					const name = `${a.name}/${w.title ?? w.componentId ?? w.menuName ?? w.type}`;
					if (w.settings !== undefined) skip(`widgetAreas: the settings of ${name}`, 'EmDash does not apply them either: a widget\'s options belong in "props"');
					// The same widget: a component by which component it is, a menu's by which menu, words by their
					// title. (An area that has "Recent Posts" is not given a second list of them under another title.)
					/** @param {Shapes["Widget"]} x */
					const is = (x) => x.type === w.type && (w.type === "component" ? x.componentId === w.componentId : w.type === "menu" ? x.menuName === w.menuName : (x.title ?? null) === (w.title ?? null));
					await thing(name, async () => (await api.send("get", "/widget-areas/{name}", at)).widgets.find(is), () => api.send("post", "/widget-areas/{name}/widgets", { ...at, body: { ...pick(w, ["type", "title", "content", "menuName", "componentId"]), ...(w.props ? { componentProps: w.props } : {}) } }));
				}
			}
		},
	},
	{
		name: "sections",
		apply: async (seed, { api, thing }) => {
			// (EmDash's seeding marks a section as a theme's. The API takes only an editor's or an import's: one with no source, or a theme's, is made an editor's)
			for (const s of seed.sections ?? []) await thing(s.slug, () => api.find("/sections/{slug}", { path: { slug: s.slug } }), () => api.send("post", "/sections", { body: { ...pick(s, ["slug", "title", "description", "keywords", "content"]), ...(s.source === "import" ? { source: s.source } : {}) } }));
		},
	},
];

/** Some names for a line: the first few, and how many more. @param {string[]} names */
const listed = (names) => `${names.slice(0, 8).join(", ")}${names.length > 8 ? `, and ${names.length - 8} more` : ""}`;

/**
 * A seed applied to the site: one line for each section the file has, then one for each thing in
 * the file that was not applied.
 * @param {Api} api @param {unknown} file a seed file as it was read, which EmDash's own check has passed @param {(line: string) => void} say @param {{ replace?: boolean, download: Download }} how
 * @returns {Promise<Count>}
 */
export const apply = async (api, file, say, how) => {
	const seed = /** @type {Seed} */ (file);
	const count = { made: 0, had: 0, failed: 0, skipped: 0 };
	/** @type {[string, string][]} */
	const skips = strangers(file).map((path) => [path, "not a part of EmDash's seed format (seed.schema.json): not applied"]);
	/** @type {Pick<Hand, "entries" | "bylines">} */
	const ids = { entries: new Map(), bylines: new Map() };
	for (const section of sections) {
		/** @type {Record<"made" | "had" | "failed", string[]>} */
		const tally = { made: [], had: [], failed: [] };
		const why = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));
		/** @type {Hand["thing"]} */
		const thing = async (name, have, make) => {
			try {
				let found = await have();
				if (!found) {
					await make();
					found = await have();
					sure(found, "it was made, and is not there when asked for again");
					tally.made.push(name);
				} else tally.had.push(name);
				return found;
			} catch (e) {
				// one thing that fails does not stop the others: what stands on it says so in its turn
				tally.failed.push(`${name}: ${why(e)}`);
				return null;
			}
		};
		try {
			await section.apply(seed, { api, thing, skip: (what, reason) => void skips.push([what, reason]), replace: !!how.replace, download: how.download, ...ids });
		} catch (e) {
			tally.failed.push(why(e));
		}
		count.made += tally.made.length;
		count.had += tally.had.length;
		count.failed += tally.failed.length;
		const parts = [tally.made.length ? `${tally.made.length} made (${listed(tally.made)})` : "", tally.had.length ? `${tally.had.length} already there (${listed(tally.had)})` : "", tally.failed.length ? `${tally.failed.length} not done — ${tally.failed.join("; ")}` : ""].filter(Boolean);
		// (a section the file does not have has no line)
		if (parts.length) say(`${tally.failed.length ? "FAIL" : "ok  "} ${section.name}: ${parts.join(", ")}`);
	}
	for (const [what, reason] of skips) say(`skip ${what}: ${reason}`);
	count.skipped = skips.length;
	return count;
};

/**
 * A seed file: found, checked by EmDash itself, and applied. What site:seed and site:demo both do.
 * @param {Ctx} ctx @param {Api} api @param {string} file @param {{ replace?: boolean }} [how] @returns {Promise<{ seed: Seed, count: Count }>}
 */
export const seedFile = async ({ world, project }, api, file, how = {}) => {
	sure(world.exists(file), `There is no seed file at ${file}. Give one: mise run site:seed -- <file> (a relative path is from the project's folder).`);
	world.say(`the seed file: ${file}`);
	/** @type {unknown} */
	let read;
	try {
		read = JSON.parse(world.read(file));
	} catch (e) {
		throw new Error(`${file} is not JSON (${e instanceof Error ? e.message : String(e)}). Nothing was applied.`);
	}
	// EmDash's own check of a seed file — the one its `emdash seed --validate` makes — from the site's
	// own EmDash, before anything is asked of the site: what it refuses, nothing is made from.
	const checker = /** @type {{ validateSeed?: (file: unknown) => { valid: boolean, errors: string[], warnings: string[] } }} */ (await world.load(project.site, "emdash/seed"));
	sure(typeof checker.validateSeed === "function", `The EmDash in ${project.site} has no check of a seed file to load (emdash/seed).`);
	const checked = checker.validateSeed(read);
	for (const warning of checked.warnings) world.say(`EmDash's check of the file warns: ${warning}`);
	sure(checked.valid, `EmDash's own check refuses this seed file, and nothing was applied:\n${checked.errors.map((error) => `  ${error}`).join("\n")}`);
	return { seed: /** @type {Seed} */ (read), count: await apply(api, read, world.say, { ...how, download: world.download }) };
};

/** The words a run ends with. @param {Count} count */
export const tallied = (count) => `${count.made} made, ${count.had} already there${count.skipped ? `, ${count.skipped} not applied (the skip lines)` : ""}${count.failed ? `, ${count.failed} FAILED` : ""}`;

/** @type {Graph} */
export const seed = {
	// The task site:seed. It stands on this machine being signed in to the built site, which stands
	// on that site being built and running: the graph sees to all three.
	"site:seed": {
		needs: () => ["signin:token"],
		work: async (ctx) => {
			const { world, project, args } = ctx;
			const api = await connect(ctx);
			world.say(`-> this machine, built site (site:preview): ${api.origin}`);
			// No file given: the site's own, where EmDash itself looks for one.
			/** @type {string | undefined} */
			const named = JSON.parse(world.read(join(project.site, "package.json")) || "{}").emdash?.seed;
			const own = [".emdash/seed.json", named, "seed/seed.json"].flatMap((f) => (f ? [join(project.site, f)] : []));
			const file = args[0] ? (isAbsolute(args[0]) ? args[0] : join(project.root, args[0])) : (own.find((f) => world.exists(f)) ?? own[own.length - 1]);
			const { count } = await seedFile(ctx, api, file);
			world.say(`the seed file, applied: ${tallied(count)}`);
			if (count.failed) throw new Error(`site:seed: ${count.failed} of the things in the seed file could not be done. Each FAIL line above says which, and what the site answered. Run it again once that is put right: what is there is left alone.`);
		},
	},
};
