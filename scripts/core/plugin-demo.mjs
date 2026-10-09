// plugin:demo — seven plugins from EmDash's registry each DO their real thing on this machine's
// built site, with requests only: nobody clicks. plugin:works says a plugin loads and answers; this
// says it works — a setting shows on a page, a dead link is found, a visitor's message arrives —
// and, where the site can show it, that a VISITOR is given it: a form on a page, a post in French.
//
// A plugin is a RECIPE: what to make, and the proof. The proof is asked first, and when it already
// holds nothing is made — so the task is safe to run again, and makes no second form or message.
// Adding a plugin is adding a recipe to the list at the end.
//
// The requests were read from each plugin's own bundle and then tried on a site (EmDash 1.2.0, the
// releases named below). A plugin's admin page is ONE address, POST …/plugins/<id>/admin, and it
// takes what the page's buttons and forms send: { type: "page_load" | "block_action" | "form_submit", … }.
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

import { reference, said } from "../plugin-api.mjs";
import { main as pluginJob } from "../plugin.mjs";
import { Exit } from "./calls.mjs";
import { savedName } from "./signin.mjs";

/**
 * @typedef {import("./graph.mjs").Graph} Graph @typedef {import("./graph.mjs").Ctx} Ctx
 * @typedef {import("../plugin-api.mjs").Answer} Answer
 * @typedef {(method: string, path: string, body?: unknown) => Promise<Answer>} Ask
 * What a recipe is given: the site, as its plugin is asked.
 * @typedef {object} Site
 * @property {string} id      the plugin's id on THIS site: the site makes one up when it installs a plugin
 * @property {Ask} api        EmDash's own API, signed in: a path under /_emdash/api
 * @property {Ask} route      one of the plugin's routes, signed in
 * @property {Ask} visitor    one of the plugin's routes as a stranger's browser asks it: nothing saved is sent
 * @property {(path: string) => Promise<Answer>} page   a page of the site, as a visitor gets it
 * @property {import("./world.mjs").World["download"]} download   a file from somewhere else, as its bytes
 * @property {(seconds: number) => Promise<void>} sleep
 * @typedef {object} Recipe
 * @property {string} plugin                           as plugin:install takes it, with the release that was tried
 * @property {(site: Site) => Promise<void>} make      what is not there yet, each step only when it is missing
 * @property {(site: Site) => Promise<string>} proof   what shows it worked, in a few words; throws, saying why, when it does not hold
 */

/** An answer that is not a yes stops the recipe, with what was asked and what the site said. @param {Answer} r @param {string} what */
const must = (r, what) => {
	if (!r.ok) throw new Error(`${what} answered ${said(r)}`);
	return r;
};
/** A button or a form of a plugin's admin page. The page says how it went in a toast, with a 200 either way. @param {Site} site @param {string} what @param {Record<string, unknown>} sent */
const press = async (site, what, sent) => {
	const r = must(await site.route("POST", "admin", sent), what);
	if (r.data?.toast?.type === "error") throw new Error(`${what} answered: ${r.data.toast.message}`);
	return r;
};
/** A plugin's settings, as the admin's settings page reads and saves them. @param {Site} site */
const settings = async (site) => must(await site.api("GET", `/admin/plugins/${site.id}/settings`), "its settings").data.values ?? {};
/** @param {Site} site @param {Record<string, string>} values */
const set = async (site, values) => void must(await site.api("PUT", `/admin/plugins/${site.id}/settings`, { values }), "saving its settings");
const times = (/** @type {number} */ n) => (n === 1 ? "once" : `${n} times`);

// ─── what the recipes make ───────────────────────────────────────────────────────────────────────
// Each is the task's own, and named after it or — a page a visitor opens — for what it is: nobody's
// content is replaced, and whoever finds one in the admin later can tell where it came from. The
// one thing of somebody else's that is added to is a page contact that is already there (putOnPage).

/**
 * One paragraph or heading of an entry's body, as EmDash keeps it (Portable Text): its style, and
 * its words — a string, or [words, address] for a link.
 * @param {string} key @param {string} style @param {...(string | [string, string])} words
 */
const text = (key, style, ...words) => ({
	_type: "block",
	_key: key,
	style,
	markDefs: words.flatMap((w, i) => (typeof w === "string" ? [] : [{ _key: `${key}l${i}`, _type: "link", href: w[1] }])),
	children: words.map((w, i) => ({ _type: "span", _key: `${key}s${i}`, text: typeof w === "string" ? w : w[0], marks: typeof w === "string" ? [] : [`${key}l${i}`] })),
});

// A published post with a link to a page that is not there: Link Guardian's dead link, and the entry
// LinguaDash translates. It is on the site's home page among the others, so it reads as a post a
// visitor could believe, with a photograph — and in French, written here: no translation service is
// asked. (A built site that signin:token set up has no content of its own: a seed's posts come with
// EmDash's set-up wizard, which that skips.)
const POST = "plugin-demo";
const DEAD_LINK = "https://emdashcms.com/this-page-does-not-exist-404";
/** @typedef {{ title: string, excerpt: string, body: [string, ...(string | [string, string])[]][] }} Words */
/** @type {Words} */
const ENGLISH = {
	title: "Every link is a promise",
	excerpt: "A link that worked the day it was written can lead nowhere a year later. How this site finds its dead links before a reader does.",
	body: [
		["normal", "A link says: there is more to read, and it is over there. Then the other site is rebuilt, a page is renamed, a company closes, and the promise is broken without anyone here having changed a word."],
		["h2", "It happens to every site"],
		["normal", "It is called link rot, and no site escapes it. Here is one, in this very post: ", ["a page that is not there", DEAD_LINK], ". It answers 404."],
		["h2", "So this site checks"],
		["normal", "When a post is published its links are read, each address is asked whether it still answers, and those that do not are listed, with the post each was found in. A dead link is then a click away from being put right, or sent on to where its page went."],
	],
};
const FRENCH_SLUG = "chaque-lien-est-une-promesse";
/** @type {Words} */
const FRENCH = {
	title: "Chaque lien est une promesse",
	excerpt: "Un lien qui fonctionnait le jour où il a été écrit peut ne plus mener nulle part un an plus tard. Voici comment ce site trouve ses liens morts avant ses lecteurs.",
	body: [
		["normal", "Un lien dit : il y a autre chose à lire, et c’est par là. Puis l’autre site est refait, une page change de nom, une entreprise ferme, et la promesse est rompue sans que personne ici ait changé un mot."],
		["h2", "Cela arrive à tous les sites"],
		["normal", "On appelle cela l’érosion des liens, et aucun site n’y échappe. En voici un, dans cet article même : ", ["une page qui n’existe pas", DEAD_LINK], ". Elle répond 404."],
		["h2", "Alors ce site vérifie"],
		["normal", "À la publication d’un article, ses liens sont lus, on demande à chaque adresse si elle répond encore, et celles qui ne répondent plus sont listées, avec l’article où chacune a été trouvée. Un lien mort n’est alors plus qu’à un clic d’être corrigé, ou renvoyé vers la nouvelle adresse de sa page."],
	],
};
/** An entry's fields, from its words. @param {Words} words */
const written = (words) => ({ title: words.title, excerpt: words.excerpt, content: words.body.map(([style, ...rest], i) => text(`b${i}`, style, ...rest)) });

// The post's photograph: asked for at its address and uploaded, the way the seeds of EmDash's own
// templates name their pictures — no picture is kept in the repo. (Not one of the blog template's:
// a site made from it would show the same picture on two posts.) EmDash knows an upload by what it
// holds, and answers one it already has with the file that is there.
const PHOTO = { url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=800&fit=crop", filename: "plugin-demo-photo.jpg", alt: "The Earth at night, seen from orbit: the lights of its cities, and threads of light between them" };
/** A file of the media library by its name; null when there is none. @param {Site} site @param {string} filename */
const findMedia = async (site, filename) => (must(await site.api("GET", `/media?q=${filename}`), "the media library").data?.items ?? []).find((/** @type {any} */ m) => m.filename === filename) ?? null;
/** The photograph, as an image field holds one. @param {Site} site */
const photo = async (site) => {
	let item = await findMedia(site, PHOTO.filename);
	if (!item) {
		const got = await site.download(PHOTO.url);
		const kind = got.headers["content-type"] ?? "";
		if (got.status !== 200 || !kind.startsWith("image/")) throw new Error(`the post's photograph, ${PHOTO.url}, answered ${got.status || "nothing"}${kind ? ` (${kind})` : ""}`);
		const form = new FormData();
		form.append("file", new Blob([got.bytes], { type: kind }), PHOTO.filename);
		form.append("alt", PHOTO.alt);
		item = must(await site.api("POST", "/media", form), "the upload of the post's photograph").data.item;
	}
	return { provider: "local", id: item.id, alt: item.alt || PHOTO.alt, width: item.width, height: item.height, filename: item.filename, mimeType: item.mimeType };
};
/** The post, when it is there and published. @param {Site} site */
const findPost = async (site) => {
	const r = await site.api("GET", `/content/posts/${POST}`);
	return r.ok && r.data?.item?.status === "published" ? r.data.item : null;
};
/** The post, made when it is not there, and published. @param {Site} site */
const makePost = async (site) => {
	let r = await site.api("GET", `/content/posts/${POST}`);
	if (r.status === 404) r = await site.api("POST", "/content/posts", { slug: POST, data: { ...written(ENGLISH), featured_image: await photo(site) } });
	let item = must(r, `the post ${POST}`).data.item;
	// One an earlier release of this task made said only that the task had made it, and had no
	// picture: it is given what the post has now. (An edit of a published post waits as a draft of it.)
	const old = item.data?.title !== ENGLISH.title || !item.data?.featured_image?.id;
	if (old) item = must(await site.api("PUT", `/content/posts/${item.id}`, { data: { ...written(ENGLISH), featured_image: await photo(site) }, _rev: r.data._rev }), `bringing the post ${POST} up to date`).data.item;
	return item.status === "published" && !old ? item : must(await site.api("POST", `/content/posts/${item.id}/publish`, {}), "publishing the post").data.item;
};

// An image with no alt text. Made here, 16 by 16, a checkerboard of two colours: nothing is
// downloaded and no image file is kept in the repo — and not the one-pixel image every site has,
// which EmDash, knowing an upload by what it holds, would answer with somebody's own file.
const IMAGE = "plugin-demo.png";
const ALT = "A small orange and slate checkerboard, made by plugin:demo";
export const png = () => {
	const chunk = (/** @type {string} */ type, /** @type {Buffer} */ data) => {
		const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
		const out = Buffer.alloc(body.length + 8);
		out.writeUInt32BE(data.length, 0);
		body.copy(out, 4);
		out.writeUInt32BE(crc32(body), body.length + 4);
		return out;
	};
	const size = 16;
	const head = Buffer.alloc(13);
	head.writeUInt32BE(size, 0);
	head.writeUInt32BE(size, 4);
	head.set([8, 2, 0, 0, 0], 8); // 8 bits a channel, red green blue
	const row = 1 + size * 3; // a row is a filter byte (0: none), then its pixels
	const rows = Buffer.alloc(size * row);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) rows.set((x + y) % 2 ? [0xf6, 0x82, 0x1f] : [0x1f, 0x29, 0x37], y * row + 1 + x * 3);
	return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", head), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
};
/** Is this image in the plugin's queue of images with no alt text? @param {Site} site @param {string} id */
const queued = async (site, id) => ((await press(site, "its queue of images with no alt text", { type: "page_load", page: "/alt-text" })).data?.blocks ?? []).some((/** @type {any} */ b) => (b.rows ?? []).some((/** @type {any} */ row) => row.action?.value === id));

// A form in each of the two forms plugins — Contact in the one, Feedback in the other — and one
// message a visitor sends to it.
const FORM = "Contact";
const FEEDBACK = "Feedback";
const VISITOR = { name: "A Visitor", email: "visitor@example.com", message: "Hello from plugin:demo" };
// Contact Forms has no request that lists its forms (forms/list answers for the one id it is given):
// its Forms page does, a form as a few blocks — "Form ID: <id>", then its fields, the slug among them.
/** @param {Site} site */
const contactForm = async (site) => {
	let id = "";
	for (const b of (await press(site, "its Forms page", { type: "page_load", page: "/forms" })).data?.blocks ?? []) {
		id = /^Form ID: (\S+)/.exec(b.type === "context" ? b.text : "")?.[1] ?? id;
		if (b.type === "fields" && b.fields?.some((/** @type {any} */ f) => f.label === "Slug" && f.value === FORM.toLowerCase())) return id;
	}
	return "";
};
/** @param {Site} site @param {string} id */
const contactExport = async (site, id) => must(await site.route("GET", `submissions/export?formId=${id}`), "its export of submissions").text;
// Forms answers a refusal with a 200 too: { ok: false, code, message }.
/** @param {Answer} r @param {string} what */
const formsSaid = (r, what) => {
	if (must(r, what).data?.ok !== true) throw new Error(`${what} answered ${r.data?.code}: ${r.data?.message}`);
	return r.data;
};
/** @param {Site} site */
const formsForm = async (site) => (formsSaid(await site.route("POST", "list", {}), "its list of forms").items ?? []).find((/** @type {any} */ f) => (f.record?.published ?? f.record?.draft)?.title === FEEDBACK) ?? null;
/** The visitor's answers among a form's entries (the newest fifty). @param {Site} site @param {string} id */
const formsEntries = async (site, id) => (formsSaid(await site.route("POST", "entries", { formId: id }), "its entries").items ?? []).filter((/** @type {any} */ e) => e.entry?.answers?.message === VISITOR.message);
const field = (/** @type {string} */ id, /** @type {string} */ label, /** @type {string} */ type, /** @type {number} */ maxLength) => ({ id, label, description: "", required: true, width: "full", condition: null, type, placeholder: "", maxLength });

// ─── on a page, for a visitor ────────────────────────────────────────────────────────────────────
// A plugin from the registry runs in a sandbox, and cannot put anything on a page of the site. So
// each forms plugin has an npm package that draws its form where an editor puts its block, and the
// SITE has that package in its config or has not; and a post in French has an address only on a
// site whose Astro config names French among its languages. The site says both to its admin, in
// its manifest — the blocks its plugins draw, its languages, where a collection's pages are — and
// a recipe asks it first. Where the site can show a thing, the thing is made and a visitor's page
// must have it; where it cannot, the line says so and what the site lacks, and nothing is made
// that no visitor could reach.

/** What the site says of itself to its admin. @param {Site} site @returns {Promise<any>} */
const manifestOf = async (site) => must(await site.api("GET", "/manifest"), "the site's manifest").data ?? {};
/** Where an entry of a collection is for a visitor, by the collection's own pattern; "" when it has none. @param {any} manifest @param {string} collection @param {string} slug */
const addressOf = (manifest, collection, slug) => String(manifest.collections?.[collection]?.urlPattern ?? "").replace("{slug}", slug);

/**
 * A form's page: the block that draws the form, and the page it is put on.
 * @typedef {object} Place
 * @property {string} block   the block's type, as the plugin's package names it
 * @property {string} needs   what a site that cannot draw it lacks, as its config would have it
 * @property {string} slug    the page
 * @property {string} title   its title, and its name in the menu — when the page has to be made
 * @property {string} words   what it says above the form — when the page has to be made
 */
/** @type {Place} */
const CONTACT_PAGE = { block: "masonjames-registry-contact-form", needs: "contactFormsEmbedPlugin(), of the package @masonjames/emdash-contact-forms", slug: "contact", title: "Contact", words: "Write to us with the form below, and we will answer by email." };
/** @type {Place} */
const FEEDBACK_PAGE = { block: "studio-form", needs: "forms(), of the package @netdollar/emdash-forms", slug: "feedback", title: "Feedback", words: "Tell us what you think of this site: what you came for, and whether you found it." };
/**
 * Where a visitor finds the form's page — or, when the site cannot show the form, why not.
 * @param {Site} site @param {Place} place @returns {Promise<{ path: string, why: string }>}
 */
const whereIs = async (site, place) => {
	const manifest = await manifestOf(site);
	const draws = Object.values(manifest.plugins ?? {}).some((/** @type {any} */ p) => p.enabled !== false && (p.portableTextBlocks ?? []).some((/** @type {any} */ b) => b.type === place.block));
	if (!draws) return { path: "", why: `it is on no page, for this site cannot draw it: plugins: [ … ] of emdash({ … }) in its Astro config has no ${place.needs}` };
	const path = addressOf(manifest, "pages", place.slug);
	return path ? { path, why: "" } : { path: "", why: "it is on no page: this site has no collection of pages with an address for them" };
};
/**
 * The form on its page, published, and the page in the site's main menu. The page is made when the
 * site has none by that name; one that is there is somebody's, and the form's block is added under
 * what it says. Each step only when it is missing: nothing is there twice.
 * @param {Site} site @param {Place} place @param {string} formId
 */
const putOnPage = async (site, place, formId) => {
	const block = { _type: place.block, _key: "plugin-demo-form", formId };
	const r = await site.api("GET", `/content/pages/${place.slug}`);
	let page;
	let changed = false;
	if (r.status === 404) page = must(await site.api("POST", "/content/pages", { slug: place.slug, data: { title: place.title, content: [text("a", "normal", place.words), block] } }), `making the page ${place.slug}`).data.item;
	else {
		page = must(r, `the page ${place.slug}`).data.item;
		/** @type {any[]} */
		const content = page.data?.content ?? [];
		const there = content.find((b) => b._type === place.block);
		// (a block for another form — one of this plugin's that is no longer there — is pointed at this one)
		if (there?.formId !== formId) {
			const next = there ? content.map((b) => (b === there ? { ...b, formId } : b)) : [...content, block];
			page = must(await site.api("PUT", `/content/pages/${page.id}`, { data: { content: next }, _rev: r.data._rev }), `putting the form on the page ${place.slug}`).data.item;
			changed = true;
		}
	}
	if (page.status !== "published" || changed) must(await site.api("POST", `/content/pages/${page.id}/publish`, {}), `publishing the page ${place.slug}`);
	// (an item that is a page follows the page: its address and its name are not written twice)
	let menu = await site.api("GET", "/menus/primary");
	if (menu.status === 404) menu = await site.api("POST", "/menus", { name: "primary", label: "Primary Navigation" });
	if (!(must(menu, "the site's main menu").data?.items ?? []).some((/** @type {any} */ i) => i.referenceId === page.id)) must(await site.api("POST", "/menus/primary/items", { type: "page", label: place.title, referenceCollection: "pages", referenceId: page.id }), `putting ${place.title} in the site's main menu`);
};
/** A page of the site that a visitor is given, or thrown with what was answered instead. @param {Site} site @param {string} path */
const pageOf = async (site, path) => {
	const page = await site.page(path);
	if (page.status !== 200) throw new Error(`${path} answered a visitor ${page.status || "nothing"}`);
	return page.text;
};
/** The French entry of an entry, as EmDash lists its translations; null when it has none. @param {Site} site @param {string} id @returns {Promise<any>} */
const frenchOf = async (site, id) => (must(await site.api("GET", `/content/posts/${id}/translations`), "the post's translations").data?.translations ?? []).find((/** @type {any} */ t) => t.locale === "fr") ?? null;
/** Does LinguaDash list this entry among the translations waiting for review? Its Translations page has a tab of them. @param {Site} site @param {string} id */
const toReview = async (site, id) => {
	const tabs = ((await press(site, "its Translations page", { type: "page_load", page: "/translations" })).data?.blocks ?? []).flatMap((/** @type {any} */ b) => b.panels ?? []);
	return JSON.stringify(tabs.find((/** @type {any} */ tab) => /^To review\b/.test(tab.label ?? "")) ?? {}).includes(id);
};

// ─── the recipes ─────────────────────────────────────────────────────────────────────────────────

/** @type {Recipe[]} */
export const recipes = [
	// Two settings, and every page of the site carries them. Only what is not set is set: a name or
	// a handle the site already has is its owner's, and the proof looks for whatever is there.
	{
		plugin: "@nookeshk.bsky.social/seo-suite@0.2.0",
		make: async (site) => {
			const now = await settings(site);
			const missing = Object.entries({ organizationName: "Acme", twitterHandle: "acme" }).filter(([key]) => !String(now[key] ?? "").trim());
			if (missing.length) await set(site, Object.fromEntries(missing));
		},
		proof: async (site) => {
			const now = await settings(site);
			const name = String(now.organizationName ?? "").trim();
			const handle = String(now.twitterHandle ?? "").trim().replace(/^@/, "");
			if (!name || !handle) throw new Error("its settings name no organisation, or no X handle");
			const home = must(await site.page("/"), "the home page").text;
			const lacks = [
				...(home.includes('"@type":"Organization"') && home.includes(`"name":${JSON.stringify(name)}`) ? [] : [`the organisation "${name}" as JSON-LD`]),
				...(home.includes(`name="twitter:site" content="@${handle}"`) ? [] : [`the X handle @${handle}`]),
			];
			if (lacks.length) throw new Error(`the home page does not carry ${lacks.join(", nor ")}`);
			return `the home page carries what its settings name: the organisation "${name}" as JSON-LD, and the X handle @${handle}`;
		},
	},
	// A dead link in a published post is found. Publishing the post has the plugin read its links,
	// and a pass — its "run a pass now" button — checks those not checked yet, a few at a time.
	{
		plugin: "@meekmedia.bsky.social/link-guardian@0.1.0",
		make: async (site) => {
			// Links to the site itself are left out: on this machine its address is localhost, which is
			// not a link any visitor will follow. Added to the patterns the site already has.
			const patterns = String((await settings(site)).ignorePatterns ?? "").split("\n").map((p) => p.trim()).filter(Boolean);
			if (!patterns.includes("http://localhost*")) await set(site, { ignorePatterns: [...patterns, "http://localhost*"].join("\n") });
			await makePost(site);
			// (a few passes: one checks a handful of links, and the check that publishing set off may still be on its way)
			for (let pass = 0; pass < 5; pass++) {
				const r = must(await site.route("POST", "pass", {}), "a pass");
				if (r.data?.ok !== true) throw new Error(`a pass answered ${r.data?.error?.code}: ${r.data?.error?.message}`);
				const found = must(await site.route("GET", "links/broken?limit=100"), "its list of broken links").data;
				if ((found?.links ?? []).some((/** @type {any} */ l) => l.url === DEAD_LINK)) return;
				await site.sleep(1);
			}
		},
		proof: async (site) => {
			const found = must(await site.route("GET", "links/broken?limit=100"), "its list of broken links").data;
			const link = (found?.links ?? []).find((/** @type {any} */ l) => l.url === DEAD_LINK);
			if (!link) throw new Error(`its list of broken links does not have ${DEAD_LINK}: it counts ${JSON.stringify(found?.counts ?? {})}`);
			// (the post, and once LinguaDash's recipe has run its French one: by title, so the line reads the same each time)
			const posts = (link.foundIn ?? []).map((/** @type {any} */ f) => `"${f.title}"`).sort();
			return `it found the dead link in the post ${posts.join(" and in ") || `"${POST}"`}: ${DEAD_LINK} answers ${link.httpStatus} (${found.counts?.broken} broken of ${found.counts?.links} links it knows)`;
		},
	},
	// An image uploaded with no alt text is in its queue; the alt text saved through the queue's own
	// form is on the image, and the queue lets it go.
	{
		plugin: "@agenticecom.net/media-alt-text-queue@0.2.1",
		make: async (site) => {
			let image = await findMedia(site, IMAGE);
			if (!image) {
				const form = new FormData();
				form.append("file", new Blob([png()], { type: "image/png" }), IMAGE);
				image = must(await site.api("POST", "/media", form), "the upload").data.item;
			}
			if (String(image.alt ?? "").trim()) return;
			if (!(await queued(site, image.id))) throw new Error(`its queue of images with no alt text does not list ${IMAGE}, which has none`);
			await press(site, "saving the alt text", { type: "form_submit", action_id: "save_alt", block_id: image.id, values: { alt: ALT }, page: "/alt-text" });
		},
		proof: async (site) => {
			const image = await findMedia(site, IMAGE);
			if (!image) throw new Error(`the media library has no ${IMAGE}`);
			if (!String(image.alt ?? "").trim()) throw new Error(`${IMAGE} has no alt text`);
			if (await queued(site, image.id)) throw new Error(`${IMAGE} has alt text and its queue still lists it`);
			return `${IMAGE}, uploaded with no alt text, has the one saved through its queue ("${image.alt}"), and the queue no longer lists it`;
		},
	},
	// A form, a visitor's message to it — sent with no sign-in, read back signed in — and the form on
	// the site's Contact page. One message is sent, and only when the export has none.
	//
	// THAT ONE MESSAGE IS ALL THIS RELEASE TAKES on a Cloudflare site (tried on EmDash 1.2.0, on the
	// site as it was before the form was on a page too): every later one, to any of its forms, sent
	// this way or from the page, in that hour or the next, is answered "Please try again later." By
	// its settings it takes five an hour from one address; to count them it lists the notes it keeps,
	// by a key some 118 characters long (kv.list), which the sandbox asks of the database as
	// `id LIKE '<key>%'` — and Cloudflare's D1 refuses a LIKE pattern over 50 bytes ("LIKE or GLOB
	// pattern too complex") as soon as the plugin has one note to try it on: the note of the first
	// message. Taking that note out of the database let the next message in. So the proof below is
	// what it says and no more: the form is on the page, and the one message arrived.
	{
		plugin: "@masonjames.com/contact-forms@0.2.0",
		make: async (site) => {
			let id = await contactForm(site);
			if (!id) {
				await press(site, "saving the form", { type: "form_submit", action_id: "forms:save:new", page: "/forms", values: { name: FORM, slug: FORM.toLowerCase(), status: "active", notifyEmails: "", confirmationMessage: "Thanks.", redirectUrl: "", submitLabel: "Send" } });
				id = await contactForm(site);
				if (!id) throw new Error(`the form was saved, and its Forms page does not list one with the slug ${FORM.toLowerCase()}`);
			}
			if (!(await contactExport(site, id)).includes(VISITOR.message)) {
				const sent = must(await site.visitor("POST", "submit", { formId: id, data: VISITOR }), "a visitor's message");
				if (sent.data?.success !== true) throw new Error(`a visitor's message answered ${said(sent)}`);
			}
			if ((await whereIs(site, CONTACT_PAGE)).path) await putOnPage(site, CONTACT_PAGE, id);
		},
		proof: async (site) => {
			const id = await contactForm(site);
			if (!id) throw new Error(`it has no form with the slug ${FORM.toLowerCase()}`);
			const csv = await contactExport(site, id);
			if (!csv.includes(VISITOR.message)) throw new Error(`its export of the form's submissions does not have the visitor's message: ${csv.replace(/\s+/g, " ").slice(0, 200)}`);
			const arrived = `the message a visitor sent to its form "${FORM}" is in the export of submissions, ${times(csv.split(VISITOR.message).length - 1)}`;
			const { path, why } = await whereIs(site, CONTACT_PAGE);
			if (!path) return `${arrived} — ${why}`;
			// the form itself, drawn where the page is made: the one with this id, and a field for each thing a visitor sends
			const html = await pageOf(site, path);
			const form = /<form\b[^>]*\sdata-mjcf-form\b[\s\S]*?<\/form>/.exec(html)?.[0] ?? "";
			if (!form.includes(`name="formId" value="${id}"`)) throw new Error(`${path} does not show a visitor the form: ${html.includes("mjcf-unavailable") ? 'where it should be, the page says "This form is currently unavailable."' : "the page has no form of this plugin's with that id"}`);
			const lacks = Object.keys(VISITOR).filter((name) => !form.includes(`name="${name}"`));
			if (lacks.length) throw new Error(`the form on ${path} has no field ${lacks.join(", nor ")}`);
			return `a visitor finds its form "${FORM}" on ${path}, with a field for each of ${Object.keys(VISITOR).join(", ")}; and ${arrived}`;
		},
	},
	// A form made, published, and answered by a visitor: a ticket first, then the answers — no sooner
	// than the ticket says (sent at once they are refused, TOO_FAST: a person takes longer). And the
	// form on a page of its own, Feedback: the page has a place for it, which a visitor's browser
	// fills by asking the plugin, so the proof asks what the browser asks.
	{
		plugin: "@netdollar.dev/forms@0.1.0",
		make: async (site) => {
			let form = await formsForm(site);
			if (!form) {
				const definition = {
					schemaVersion: 1,
					title: FEEDBACK,
					description: "",
					fields: [field("name", "Name", "text", 200), field("email", "Email", "email", 200), field("message", "Message", "textarea", 5000)],
					settings: { submitLabel: "Send", confirmation: "Thanks.", notifications: [], opensAt: null, closesAt: null, mode: "standard" },
				};
				form = formsSaid(await site.route("POST", "create", { definition }), "making the form");
			}
			if (form.record.status === "draft") {
				const { revision } = formsSaid(await site.route("POST", "get", { id: form.id }), "reading the form");
				formsSaid(await site.route("POST", "publish", { id: form.id, revision }), "publishing the form");
			}
			if (!(await formsEntries(site, form.id)).length) {
				const ticket = formsSaid(await site.visitor("POST", "ticket", { id: form.id }), "a visitor's ticket");
				await site.sleep((ticket.minimumWaitMs ?? 1500) / 1000 + 0.5);
				formsSaid(await site.visitor("POST", "submit", { formId: form.id, ticket: ticket.ticket, answers: VISITOR, website: "" }), "a visitor's answers");
			}
			if ((await whereIs(site, FEEDBACK_PAGE)).path) await putOnPage(site, FEEDBACK_PAGE, form.id);
		},
		proof: async (site) => {
			const form = await formsForm(site);
			if (!form) throw new Error(`it has no form titled ${FEEDBACK}`);
			const mine = await formsEntries(site, form.id);
			if (!mine.length) throw new Error(`the entries of its form ${form.id} do not have the visitor's answers`);
			const arrived = `the answers a visitor sent to its published form "${FEEDBACK}" (${form.id}) are among its entries, ${times(mine.length)}`;
			const { path, why } = await whereIs(site, FEEDBACK_PAGE);
			if (!path) return `${arrived} — ${why}`;
			// The page has the place, and no fields: the browser asks the package which plugin holds the
			// forms, then that plugin for the form. Both are asked here, with no sign-in, as it asks them.
			const html = await pageOf(site, path);
			if (!html.includes("<astro-island") || !html.includes(`&quot;formId&quot;:[0,&quot;${form.id}&quot;]`)) throw new Error(`${path} has no place for the form ${form.id}: the page does not draw this plugin's block`);
			const holder = must(await site.page("/_emdash/api/plugins/forms-embed/connection"), "the address a visitor's browser asks which plugin holds the forms").data?.engineId;
			if (holder !== site.id) throw new Error(`a visitor's browser is told the forms are held by the plugin ${holder}, and this one is ${site.id}`);
			const fields = (formsSaid(await site.visitor("GET", `definition?id=${form.id}`), "the form, as a visitor's browser asks for it").definition?.fields ?? []).map((/** @type {any} */ f) => f.id);
			return `a visitor finds its form "${FEEDBACK}" on ${path}: the page has its place, and the browser that fills it is given the fields ${fields.join(", ")}; and ${arrived}`;
		},
	},
	// A French entry for a post: with no translation service set, the plugin makes a copy to translate
	// and leaves it a draft. On a site that has French among its languages the copy is given its
	// French words (above) and published, and a visitor can read it: the English page names the
	// French one, and the plugin no longer lists it as waiting for review. French is added to the
	// languages the site already translates into.
	{
		plugin: "@swiss.ky/linguadash@0.2.1",
		make: async (site) => {
			const locales = String((await settings(site)).targetLocales ?? "").split(",").map((l) => l.trim()).filter(Boolean);
			if (!locales.includes("fr")) await set(site, { targetLocales: [...locales, "fr"].join(", ") });
			const post = await makePost(site);
			let french = await frenchOf(site, post.id);
			if (!french) {
				await press(site, "its button that makes a missing translation", { type: "block_action", action_id: "translate-missing", value: `fr|posts|${post.id}`, page: "/translations" });
				french = await frenchOf(site, post.id);
				if (!french) throw new Error(`its button that makes a missing translation was pressed, and the post ${POST} has no French entry`);
			}
			if (!(await manifestOf(site)).i18n?.locales?.includes("fr")) return;
			const copy = must(await site.api("GET", `/content/posts/${french.id}`), "its French entry").data;
			const untranslated = copy.item.data?.title !== FRENCH.title;
			if (untranslated) must(await site.api("PUT", `/content/posts/${french.id}`, { slug: FRENCH_SLUG, data: { ...written(FRENCH), featured_image: post.data?.featured_image }, _rev: copy._rev }), "giving its French entry its French words");
			if (untranslated || copy.item.status !== "published") must(await site.api("POST", `/content/posts/${french.id}/publish`, {}), "publishing its French entry");
			// (A plugin hears of a publish after EmDash has answered it, and after the plugins before it:
			// the first time on a site, asked straight after, it still listed the entry to review — and
			// not a moment later. So it is asked until it has let the entry go, for a few seconds.)
			for (let waited = 0; waited < 10 && (await toReview(site, french.id)); waited++) await site.sleep(1);
		},
		proof: async (site) => {
			const post = await findPost(site);
			if (!post) throw new Error(`there is no published post ${POST} to translate`);
			const all = must(await site.api("GET", `/content/posts/${post.id}/translations`), "the post's translations").data?.translations ?? [];
			const french = all.find((/** @type {any} */ t) => t.locale === "fr");
			if (!french) throw new Error(`the post ${POST} has no French entry: it is in ${all.map((/** @type {any} */ t) => t.locale).join(", ") || "no language"}`);
			const manifest = await manifestOf(site);
			if (!manifest.i18n?.locales?.includes("fr")) return `the post "${POST}" has the French entry it made (${french.slug}, a ${french.status} to review) — no visitor can open it: French is not one of this site's languages (i18n in its Astro config)`;
			if (french.status !== "published") throw new Error(`the French entry it made for the post ${POST} (${french.slug}) is a ${french.status}: no visitor can open it`);
			// What a visitor is given: the English page names its French one, and that address answers in French.
			const english = addressOf(manifest, "posts", POST);
			if (!english) throw new Error("the French entry is published, and this site's collection of posts has no address for its entries: there is no page to ask for");
			const named = [...(await pageOf(site, english)).matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).find((tag) => /\brel="alternate"/.test(tag) && /\bhreflang="fr"/.test(tag));
			if (!named) throw new Error(`${english} does not name a French page: its head has no <link rel="alternate" hreflang="fr">`);
			const path = new URL(/\bhref="([^"]*)"/.exec(named)?.[1] ?? "", "http://site").pathname;
			if (!(await pageOf(site, path)).includes(FRENCH.title)) throw new Error(`${path}, which ${english} names as its French page, does not have the French title "${FRENCH.title}"`);
			if (await toReview(site, french.id)) throw new Error(`the French entry of the post ${POST} is published, and its Translations page still lists it to review`);
			return `a visitor reads the post in French at ${path} ("${FRENCH.title}"), which ${english} names as its French page; it made the French entry, and no longer lists it to review`;
		},
	},
	// Installed, and the key search engines ask a site for is at its address. That is as far as it
	// goes on this machine: it tells a search engine which pages changed, and from an address only
	// this machine can reach it sends nothing — its own log page says so, and the line quotes it.
	// The key is made when the plugin is installed: there is nothing to make here.
	{
		plugin: "@peachfinthemes.com/instant-indexer@1.0.0",
		make: async () => {},
		proof: async (site) => {
			const key = must(await site.visitor("GET", "key"), "its key address, asked as a search engine asks it").text.trim();
			if (!/^[0-9a-f]{32}$/.test(key)) throw new Error(`its key address answered a visitor with what is not a key of 32 hexadecimal characters: ${key.replace(/\s+/g, " ").slice(0, 80) || "nothing"}`);
			const notice = ((await press(site, "its log page", { type: "page_load", page: "/submissions" })).data?.blocks ?? []).find((/** @type {any} */ b) => b.type === "banner" && /blocked/i.test(b.title ?? ""));
			return `its key address answers a visitor with its key, 32 hexadecimal characters (not printed); ${notice ? `it sends nothing from here, and says so itself — "${notice.title}": ${notice.description}` : "its log page has no notice that sending is blocked: what it has sent is on that page"}`;
		},
	},
];

// ─── the task ────────────────────────────────────────────────────────────────────────────────────

/**
 * How a site is asked: its answer as EmDash's JSON, read where it is used. No token: a visitor.
 * @param {import("./world.mjs").World} world @param {string} base @param {string} token @returns {Ask}
 */
const client = (world, base, token) => async (method, path, body) => {
	const form = body instanceof FormData; // (an upload: the request names its own content type)
	const init = {
		method,
		headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined && !form ? { "Content-Type": "application/json" } : {}) },
		...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }),
		seconds: 120,
	};
	let r = await world.ask(`${base}${path}`, init);
	// a read that got no answer is asked once more: seen on a local Cloudflare site, and not explained (scripts/plugin-api.mjs)
	if (r.status === 0 && method === "GET") r = await world.ask(`${base}${path}`, init);
	let json = null;
	try {
		json = JSON.parse(r.text);
	} catch {}
	return { status: r.status, ok: r.status >= 200 && r.status < 300, text: r.text, data: json?.data, error: json?.error };
};

/**
 * The plugins the site lacks, installed by the job behind plugin:install, agreeing to what each asks
 * for (--yes). It prints what that is, and ends by saying how it went: one it could not install is
 * a FAIL line of its own here.
 * @param {Ctx} ctx @returns {(plugins: string[]) => Promise<void>}
 */
const installer = ({ project }) => async (plugins) => {
	try {
		await pluginJob(["install", "--yes", `http://localhost:${project.builtPort}`, project.site, ...plugins]);
	} catch (e) {
		if (!(e instanceof Exit)) throw e;
	}
};

/**
 * Every recipe, one line each; the task fails when one did not hold.
 * @param {Ctx} ctx @param {Recipe[]} [list] @param {(plugins: string[]) => Promise<void>} [install]
 */
export const demo = async (ctx, list = recipes, install = installer(ctx)) => {
	const { world, project } = ctx;
	const origin = `http://localhost:${project.builtPort}`;
	world.say(`-> this machine, built site (site:preview): ${origin}`);
	const saved = join(world.config, "emdash-run", "tokens", `${savedName(origin, project.site)}.json`);
	const api = client(world, `${origin}/_emdash/api`, world.exists(saved) ? JSON.parse(world.read(saved)).token : "");
	const stranger = client(world, origin, "");
	const slug = (/** @type {Recipe} */ r) => reference(r.plugin).slug;
	const installed = async () => {
		const r = await api("GET", "/admin/plugins");
		if (r.status !== 200) throw new Error(`The site did not accept this machine's sign-in: GET /_emdash/api/admin/plugins answered ${said(r)}\nSign in first: mise run signin:token`);
		return (r.data?.items ?? []).filter((/** @type {any} */ p) => p.source === "registry");
	};
	let plugins = await installed();
	const missing = list.filter((r) => !plugins.some((/** @type {any} */ p) => p.registrySlug === slug(r)));
	if (missing.length) {
		world.say(`installing what the site does not have yet: ${missing.map(slug).join(", ")}`);
		await install(missing.map((r) => r.plugin));
		world.at("plugin:demo"); // (the install may have had other states reached, and what they print is under their names)
		plugins = await installed();
	}
	let failed = 0;
	for (const recipe of list) {
		// its id on this site, by the name the registry knows it by
		const plugin = plugins.find((/** @type {any} */ p) => p.registrySlug === slug(recipe));
		try {
			if (!plugin) throw new Error("it is not installed: the install, above, says why");
			/** @type {Site} */
			const site = {
				id: plugin.id,
				api,
				route: (method, route, body) => api(method, `/plugins/${plugin.id}/${route}`, body),
				visitor: (method, route, body) => stranger(method, `/_emdash/api/plugins/${plugin.id}/${route}`, body),
				page: (path) => stranger("GET", path),
				download: world.download,
				sleep: world.sleep,
			};
			const already = await recipe.proof(site).catch(() => "");
			if (!already) await recipe.make(site);
			world.say(`ok   ${slug(recipe)}: ${already ? `already so — ${already}` : await recipe.proof(site)}`);
		} catch (e) {
			failed++;
			world.say(`FAIL ${slug(recipe)}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	world.say(failed ? `${failed} of ${list.length} plugins did not do their real thing: the FAIL lines say what the site answered` : `all ${list.length} plugins did their real thing`);
	if (failed) throw new Exit(1);
};

/** @type {Graph} */
export const pluginDemo = {
	// A task for the site on this machine only stands on this first. Asked with --live it stops here,
	// before any other state is reached: a flag goes to every state a task stands on, and
	// signin:token --live would have signed in to the deployed site.
	"site:local-only": {
		done: ({ flags }) => !flags.live,
		work: () => {
			throw new Error("This task acts on the site on this machine only, and it was asked for the deployed one (--live). Nothing was done.");
		},
	},
	// Then what every task on registry plugins stands on here (pluginNeeds in tasks.mjs): the site
	// able to run sandboxed plugins, built, running, and this machine signed in to it.
	"plugin:demo": { needs: () => ["site:local-only", "plugin:sandbox", "signin:token"], work: (ctx) => demo(ctx) },
};
