// site:seed — an EmDash seed file, applied to a site that is already running and is not empty.
//
// A seed file is EmDash's own way to say what a site is made of (seed/seed.json, checked against
// https://emdashcms.com/seed.schema.json). EmDash applies one by itself only on the first request
// to an empty database, and `emdash seed` writes to a SQLite file: neither reaches the database of
// a Cloudflare site once it is running. This applies the same file through the site's HTTP API.
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

import { client, one, pick, sure } from "./api.mjs";

/**
 * @typedef {import("./graph.mjs").Graph} Graph @typedef {import("./graph.mjs").Ctx} Ctx @typedef {import("./api.mjs").Api} Api
 * A seed file: its shape is EmDash's (SeedFile, src/seed/types.ts), read field by field where it is used.
 * @typedef {Record<string, any>} Seed
 * How a file is fetched from its address (World's download).
 * @typedef {import("./world.mjs").World["download"]} Download
 * What a section's work is handed.
 * @typedef {object} Hand
 * @property {Api} api
 * @property {(name: string, have: () => Promise<unknown>, make: () => Promise<unknown>) => Promise<any>} thing   one thing the file names: what was found of it on the site — or null when it could not be done, which the section's line then says
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

/**
 * What a seed file has that is not EmDash's seed format: each as its path in the file.
 * @param {Seed} seed @returns {string[]}
 */
export const strangers = (seed) => {
	/** @type {string[]} */
	const found = [];
	const look = (/** @type {unknown} */ thing, /** @type {string} */ kind, /** @type {string} */ path) => {
		if (thing && typeof thing === "object" && !Array.isArray(thing)) for (const key of Object.keys(thing)) if (!KEYS[kind].includes(key)) found.push(`${path}${key}`);
	};
	/** @param {unknown} list @param {string} kind @param {string} path @param {(thing: any, path: string) => void} [inside] */
	const each = (list, kind, path, inside) => {
		for (const [i, thing] of (Array.isArray(list) ? list : []).entries()) {
			look(thing, kind, `${path}[${i}].`);
			inside?.(thing ?? {}, `${path}[${i}].`);
		}
	};
	/** @param {unknown} list @param {string} path */
	const items = (list, path) => each(list, "item", path, (item, at) => items(item.children, `${at}children`));
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
	for (const [collection, entries] of Object.entries(seed.content ?? {})) each(entries, "entry", `content.${collection}`);
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
	if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolved(v, entries)]));
	return value;
};
/** Is this a picture named by its address ({ "$media": { "url": … } })? @param {any} value */
const pictured = (value) => typeof value?.$media?.url === "string";
/** Is one anywhere inside this? @param {unknown} value */
const pictures = (value) => JSON.stringify(value ?? null).includes('"$media":');
const same = (/** @type {unknown} */ a, /** @type {unknown} */ b) => JSON.stringify(a) === JSON.stringify(b);
/**
 * Does what the site has hold what the file says? A group of settings by each one the file gives:
 * the site may hold more beside them (others of the group, or what it worked out itself).
 * @param {any} now @param {unknown} want @returns {boolean}
 */
const holds = (now, want) => (want && typeof want === "object" && !Array.isArray(want) ? !!now && typeof now === "object" && Object.entries(want).every(([key, value]) => holds(now[key], value)) : same(now, want));
const FILE_KINDS = /** @type {Record<string, string>} */ ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif", "image/svg+xml": ".svg" });

/**
 * A picture the file names by its address, in the site's media library under its filename: fetched
 * and uploaded, with its alt text, when no item of that name is there (so one picture is fetched
 * once, however often it is named or the task is run). What an image field is given for it.
 * @param {Hand} hand @param {{ url: string, alt?: string, filename?: string, caption?: string }} media
 */
const picture = async ({ api, download }, media) => {
	sure(/^https?:\/\//.test(media.url), `its address is not one to fetch: ${media.url}`);
	const last = decodeURIComponent(new URL(media.url).pathname.split("/").pop() || "picture");
	const named = media.filename ?? last;
	const listed = async (/** @type {string} */ name) => one((await api.must("GET", `/media?q=${encodeURIComponent(name)}`)).items, "filename", name);
	let item = await listed(named);
	if (!item) {
		const file = await download(media.url);
		sure(file.status === 200 && file.bytes.length > 0, `GET ${media.url} answered ${file.status || "nothing"}`);
		// (a name with no ending is given the one its kind of file has: the library goes by it)
		const name = /\.\w+$/.test(named) ? named : `${named}${FILE_KINDS[file.type.split(";")[0]] ?? ""}`;
		item = await listed(name);
		if (!item) {
			const form = new FormData();
			form.set("file", new Blob([file.bytes], { type: file.type }), name);
			if (media.alt) form.set("alt", media.alt);
			if (media.caption) form.set("caption", media.caption);
			item = (await api.must("POST", "/media", form)).item;
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
			const here = seed.settings ? await api.must("GET", "/settings") : {};
			for (const [key, value] of Object.entries(seed.settings ?? {})) {
				const own = !replace && here[key] != null && !holds(here[key], value);
				await thing(
					own ? `${key} (the site has its own: left as it is)` : key,
					async () => {
						const now = (await api.must("GET", "/settings"))[key];
						return replace ? holds(now, value) : now != null;
					},
					// (POST: EmDash's own list of its requests says PUT, which the site answers with its 404 page)
					() => api.must("POST", "/settings", { [key]: value }),
				);
			}
		},
	},
	{
		name: "collections",
		apply: async (seed, { api, thing }) => {
			for (const c of seed.collections ?? []) {
				const at = `/schema/collections/${c.slug}`;
				const made = await thing(
					c.slug,
					async () => (await api.find(at))?.item,
					() => api.must("POST", "/schema/collections", { ...pick(c, ["slug", "label", "labelSingular", "description", "icon", "admin", "supports", "urlPattern", "routable", "hidden", "sortOrder", "group", "editLocking"]), source: "seed" }),
				);
				// comments on or off is not part of making a collection: it is said to one that is there
				if (made && c.commentsEnabled !== undefined) await thing(`${c.slug}: comments ${c.commentsEnabled ? "on" : "off"}`, async () => (await api.must("GET", at)).item.commentsEnabled === c.commentsEnabled, () => api.must("PUT", at, { commentsEnabled: c.commentsEnabled }));
			}
		},
	},
	{
		// after the collections a relation joins, and before the fields that name it
		name: "relations",
		apply: async (seed, { api, thing }) => {
			for (const r of seed.relations ?? []) await thing(r.slug, async () => one((await api.must("GET", "/relations")).relations, "slug", r.slug), () => api.must("POST", "/relations", pick(r, KEYS.relation)));
		},
	},
	{
		// the fields of the file's collections: one a collection lacks is added to it
		name: "fields",
		apply: async (seed, { api, thing }) => {
			for (const c of seed.collections ?? []) {
				const at = `/schema/collections/${c.slug}`;
				for (const f of c.fields ?? []) await thing(`${c.slug}.${f.slug}`, async () => one((await api.find(`${at}?includeFields=true`))?.item.fields ?? [], "slug", f.slug), () => api.must("POST", `${at}/fields`, pick(f, KEYS.field)));
				// the fields the admin lists an entry by: named once they are there
				for (const key of ["titleField", "dateField"]) if (c[key] !== undefined) await thing(`${c.slug}: ${key} ${c[key]}`, async () => (await api.must("GET", at)).item[key] === c[key], () => api.must("PUT", at, { [key]: c[key] }));
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
				if (!(await thing(t.name, async () => (await api.find(`/taxonomies/${t.name}`))?.taxonomy, () => api.must("POST", "/taxonomies", pick(t, ["name", "label", "labelSingular", "hierarchical", "collections", "locale"]))))) continue;
				const at = `/taxonomies/${t.name}/terms`;
				/** @type {any[]} */
				const waiting = [];
				for (const term of t.terms ?? []) {
					if (term.translationOf) skip(`taxonomies: ${t.name}/${term.slug} (${term.locale})`, TRANSLATION);
					else waiting.push(term);
				}
				// A term under another is made after it: the file names its parent by slug, the site by id.
				while (waiting.length) {
					const ready = waiting.filter((term) => !one(waiting, "slug", term.parent));
					for (const term of ready.length ? ready : [...waiting]) {
						waiting.splice(waiting.indexOf(term), 1);
						await thing(
							`${t.name}/${term.slug}`,
							async () => (await api.find(`${at}/${term.slug}`))?.term,
							async () => {
								const parent = term.parent ? (await api.find(`${at}/${term.parent}`))?.term : null;
								sure(!term.parent || parent, `the term it is under, ${term.parent}, is not there`);
								await api.must("POST", at, { ...pick(term, ["slug", "label", "description", "locale"]), ...(parent ? { parentId: parent.id } : {}) });
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
				const made = await thing(b.slug, async () => one((await api.must("GET", `/admin/bylines?search=${encodeURIComponent(b.slug)}`)).items, "slug", b.slug), () => api.must("POST", "/admin/bylines", pick(b, ["slug", "displayName", "bio", "websiteUrl", "isGuest"])));
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
				const model = await api.find(`/schema/collections/${collection}?includeFields=true`);
				/** @type {string[]} */
				const bound = (model?.item.fields ?? []).filter((/** @type {any} */ f) => f.type === "reference" && f.validation?.relation).map((/** @type {any} */ f) => f.slug);
				for (const e of /** @type {any[]} */ (list)) {
					const name = `${collection}/${e.slug ?? e.id}`;
					if (e.translationOf) skip(`content: ${name} (${e.locale})`, TRANSLATION);
					else if (!e.slug) skip(`content: ${name}`, "an entry with no slug cannot be found again on the site: not applied by site:seed yet");
					if (e.translationOf || !e.slug) continue;
					const at = `/content/${collection}/${e.slug}`;
					// An entry is published unless the file says draft (as EmDash's seeding has it).
					const live = (e.status ?? "published") === "published";
					// A picture that is a field's whole value is fetched and uploaded. One inside a body is not yet:
					// the block that holds it is left out, and that is said.
					/** @type {[string, any][]} */
					const fields = Object.entries(e.data ?? {});
					const shown = fields.filter(([, v]) => pictured(v));
					const inside = fields.flatMap(([, v]) => (Array.isArray(v) ? v.filter(pictures) : !pictured(v) && pictures(v) ? [v] : [])).length;
					if (inside) skip(`content: ${name}`, `${inside} picture${inside === 1 ? "" : "s"} inside its fields (a block of a body): not applied by site:seed yet — the entry is made without ${inside === 1 ? "it" : "them"}`);
					const made = await thing(
						name,
						// There: it is on the site — and not half made. A draft that was never published, when the file
						// has it published, is one a run made and could not publish; a field with no picture, where the
						// file has one, is one a run could not fetch. Both are put right by the next run.
						async () => {
							const found = (await api.find(at))?.item;
							return found && (!live || found.status !== "draft" || found.publishedAt) && shown.every(([field]) => found.data[field]) ? found : null;
						},
						async () => {
							let found = (await api.find(at))?.item;
							/** @type {Record<string, unknown>} */
							const fetched = {};
							/** @type {string[]} */
							const lost = [];
							for (const [field, value] of shown) {
								if (found?.data[field]) continue;
								try {
									fetched[field] = await picture(hand, value.$media);
								} catch (error) {
									lost.push(`${field}: ${error instanceof Error ? error.message : String(error)}`);
								}
							}
							const publish = live && (!found || found.status === "published" || !found.publishedAt);
							if (!found) {
								/** @type {Record<string, any>} */
								const data = { ...Object.fromEntries(fields.filter(([, v]) => !pictured(v) && (Array.isArray(v) || !pictures(v))).map(([k, v]) => [k, resolved(Array.isArray(v) ? v.filter((x) => !pictures(x)) : v, entries)])), ...fetched };
								const references = Object.fromEntries(bound.filter((f) => data[f] != null).map((f) => [f, [data[f]].flat()]));
								for (const f of bound) delete data[f];
								const credits = (e.bylines ?? []).map((/** @type {any} */ credit) => {
									sure(bylines.has(credit.byline), `it is credited to the byline ${credit.byline}, which is not there`);
									return { bylineId: bylines.get(credit.byline), ...pick(credit, ["roleLabel"]) };
								});
								found = (await api.must("POST", `/content/${collection}`, { slug: e.slug, data, ...pick(e, ["taxonomies", "locale"]), ...(credits.length ? { bylines: credits } : {}), ...(Object.keys(references).length ? { references } : {}) })).item;
							} else if (Object.keys(fetched).length) await api.must("PUT", `/content/${collection}/${found.id}`, { data: fetched, _rev: (await api.must("GET", at))._rev });
							// (an entry somebody took back to a draft stays one)
							if (publish) await api.must("POST", `/content/${collection}/${found.id}/publish`, {});
							sure(!lost.length, `it is there, without ${lost.length === 1 ? "a picture" : `${lost.length} pictures`} that could not be fetched (${lost.join("; ")}). Run again to fetch ${lost.length === 1 ? "it" : "them"}`);
						},
					);
					// (an entry that is there without its picture is still one a menu can name)
					const there = made ?? (await api.find(at))?.item;
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
				if (m.translationOf || !(await thing(m.name, () => api.find(`/menus/${m.name}`), () => api.must("POST", "/menus", pick(m, ["name", "label", "locale"]))))) continue;
				/** @param {any[]} items @param {string | null} parentId */
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
						/** @param {any} i @param {ReturnType<typeof want>} w */
						const is = (i, w) => (i.parentId ?? null) === (w.parentId ?? null) && (i.label === w.label || (w.customUrl !== undefined ? i.customUrl === w.customUrl : w.referenceId !== undefined && i.referenceId === w.referenceId));
						const made = await thing(
							`${m.name}/${label}`,
							async () => {
								const w = want();
								return (await api.must("GET", `/menus/${m.name}`)).items.find((/** @type {any} */ i) => is(i, w)) ?? null;
							},
							async () => api.must("POST", `/menus/${m.name}/items`, want()),
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
			for (const r of seed.redirects ?? []) await thing(r.source, async () => one((await api.must("GET", `/redirects?search=${encodeURIComponent(r.source)}`)).items, "source", r.source), () => api.must("POST", "/redirects", pick(r, KEYS.redirect)));
		},
	},
	{
		name: "widgetAreas",
		apply: async (seed, { api, thing, skip }) => {
			for (const a of seed.widgetAreas ?? []) {
				const at = `/widget-areas/${a.name}`;
				if (!(await thing(a.name, () => api.find(at), () => api.must("POST", "/widget-areas", pick(a, ["name", "label", "description"]))))) continue;
				for (const w of a.widgets ?? []) {
					const name = `${a.name}/${w.title ?? w.componentId ?? w.menuName ?? w.type}`;
					if (w.settings !== undefined) skip(`widgetAreas: the settings of ${name}`, 'EmDash does not apply them either: a widget\'s options belong in "props"');
					// The same widget: a component by which component it is, a menu's by which menu, words by their
					// title. (An area that has "Recent Posts" is not given a second list of them under another title.)
					/** @param {any} x */
					const is = (x) => x.type === w.type && (w.type === "component" ? x.componentId === w.componentId : w.type === "menu" ? x.menuName === w.menuName : (x.title ?? null) === (w.title ?? null));
					await thing(name, async () => (await api.must("GET", at)).widgets.find(is) ?? null, () => api.must("POST", `${at}/widgets`, { ...pick(w, ["type", "title", "content", "menuName", "componentId"]), ...(w.props ? { componentProps: w.props } : {}) }));
				}
			}
		},
	},
	{
		name: "sections",
		apply: async (seed, { api, thing }) => {
			// (EmDash's seeding marks a section as a theme's. The API takes only an editor's or an import's: one with no source, or a theme's, is made an editor's)
			for (const s of seed.sections ?? []) await thing(s.slug, () => api.find(`/sections/${s.slug}`), () => api.must("POST", "/sections", { ...pick(s, ["slug", "title", "description", "keywords", "content"]), ...(s.source === "import" ? { source: s.source } : {}) }));
		},
	},
];

/** Some names for a line: the first few, and how many more. @param {string[]} names */
const listed = (names) => `${names.slice(0, 8).join(", ")}${names.length > 8 ? `, and ${names.length - 8} more` : ""}`;

/**
 * A seed applied to the site: one line for each section the file has, then one for each thing in
 * the file that was not applied.
 * @param {Api} api @param {Seed} seed @param {(line: string) => void} say @param {{ replace?: boolean, download: Download }} how
 * @returns {Promise<Count>}
 */
export const apply = async (api, seed, say, how) => {
	const count = { made: 0, had: 0, failed: 0, skipped: 0 };
	/** @type {[string, string][]} */
	const skips = strangers(seed).map((path) => [path, "not a part of EmDash's seed format (seed.schema.json): not applied"]);
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
	// EmDash's own check of a seed file, before anything is asked of the site: what it refuses, nothing is made from
	sure(world.tool("emdash", ["seed", file, "--validate"], project.site) === 0, "EmDash's own check refuses this seed file (emdash seed --validate: what it said is above). Nothing was applied.");
	const seed = JSON.parse(world.read(file));
	return { seed, count: await apply(api, seed, world.say, { ...how, download: world.download }) };
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
			const api = client(ctx);
			world.say(`-> this machine, built site (site:preview): ${api.origin}`);
			// No file given: the site's own, where EmDash itself looks for one.
			const named = JSON.parse(world.read(join(project.site, "package.json")) || "{}").emdash?.seed;
			const own = [".emdash/seed.json", named, "seed/seed.json"].filter(Boolean).map((f) => join(project.site, f));
			const file = args[0] ? (isAbsolute(args[0]) ? args[0] : join(project.root, args[0])) : (own.find((f) => world.exists(f)) ?? own[own.length - 1]);
			const { count } = await seedFile(ctx, api, file);
			world.say(`the seed file, applied: ${tallied(count)}`);
			if (count.failed) throw new Error(`site:seed: ${count.failed} of the things in the seed file could not be done. Each FAIL line above says which, and what the site answered. Run it again once that is put right: what is there is left alone.`);
		},
	},
};
