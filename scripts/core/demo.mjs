// site:demo — something real in every core feature of EmDash, on this machine's built site.
//
// A site that has just been made has a model and nothing in it, and an admin with nothing in it
// shows nothing of what EmDash does. What fills it is said in EmDash's own seed format, in
// seeds/demo.json, and applied as site:seed applies any seed file (seed.mjs): settings, terms, a
// byline, posts with their photographs, pages, menus, widgets, a section, a redirect, comments
// turned on. The words a visitor reads are all in that file.
//
// THE LIST BELOW is the rest: what a seed file has no way to say. What search engines read of a
// post, a second and third revision, the day a post is scheduled for, comments shown without
// approval and sent by a visitor, a preview link, the site's icon (with a caption and a focal
// point), the picture a shared link is shown with, a token, a backup. It finds its things by what
// the seed file holds (parts, below), not by names of its own. To add one, add an entry:
//   name    what the line is called
//   have    is it already there? Then nothing is made — the task is safe to run again
//   make    make it. Every part is looked for first, so a run that stopped half way is picked up
//   proof   what shows it works, in a few words — asked as a visitor would ask wherever a visitor can
// An entry, an upload and a search are asked of EmDash's own client; the rest are requests typed
// from EmDash's list of them (api.mjs).
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

import { connect, one, sure } from "./api.mjs";
import { Refused, orNone } from "./emdash-client.mjs";
import { seedFile, tallied } from "./seed.mjs";

/**
 * @typedef {import("./graph.mjs").Graph} Graph @typedef {import("./api.mjs").Api} Api
 * @typedef {import("./emdash-seed.js").Seed} Seed @typedef {import("./emdash-seed.js").SeedEntry} SeedEntry
 * @typedef {import("./emdash-client.mjs").Entry} Entry
 * @typedef {object} Feature
 * @property {string} name
 * @property {(api: Api, seed: Seed) => Promise<boolean>} [have]   (have and make are left out by a feature that only shows what is there)
 * @property {(api: Api, seed: Seed) => Promise<void>} [make]
 * @property {(api: Api, seed: Seed) => Promise<string>} proof
 */

const ICON = "site-icon.png";
const READ_ONLY = "demo-read-only";
const SCOPES = ["content:read", "media:read"];

/**
 * What the list stands on, as the seed file has it: the file can be given other words, and the
 * list still finds its things.
 * @param {Seed} seed
 */
export const parts = (seed) => {
	const posts = seed.content?.posts ?? [];
	const drafts = posts.filter((e) => e.status === "draft");
	return {
		/** the last post the file has published: the newest, which a blog shows first */
		lead: posts.filter((e) => e.status !== "draft").at(-1),
		/** a draft, to read through a preview link */
		draft: drafts[0],
		/** another, to give a day to be published on */
		later: drafts[1],
		redirect: seed.redirects?.[0],
		/** the menu item that is a page of the file: its label is looked for on the front page */
		linked: (seed.menus?.[0]?.items ?? []).filter((i) => i.ref).at(-1)?.label,
	};
};

/** Does a page show these words? As a visitor reads them: a page writes & < > " ' in a way of its own. @param {string} html @param {string} words */
const shows = (html, words) => {
	/** @type {Record<string, string>} */
	const plain = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", "#x27": "'" };
	return html.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g, (_, name) => plain[name]).includes(words);
};

/**
 * A picture made here: nothing is downloaded, and no file is kept in the repo. A PNG is a signature
 * and three chunks — the size, the pixels (rows of red-green-blue, each after a 0 byte, deflated),
 * the end — each chunk with its length before it and a CRC after.
 * @param {number} width @param {number} height @param {(x: number, y: number) => number[]} colour red, green and blue at a place, each 0 to 255
 */
export const png = (width, height, colour) => {
	const rows = Buffer.alloc(height * (1 + width * 3));
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows.set(colour(x, y), y * (1 + width * 3) + 1 + x * 3);
	const chunk = (/** @type {string} */ type, /** @type {Buffer} */ data) => {
		const body = Buffer.concat([Buffer.from(type), data]);
		const out = Buffer.alloc(body.length + 8);
		out.writeUInt32BE(data.length);
		body.copy(out, 4);
		out.writeUInt32BE(crc32(body), body.length + 4);
		return out;
	};
	const size = Buffer.alloc(13);
	size.writeUInt32BE(width);
	size.writeUInt32BE(height, 4);
	size.set([8, 2], 8); // 8 bits a colour, and the colours are red, green, blue
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", size), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
};
/** The site's icon: a white dash on a blue square, 192 pixels a side. */
export const icon = () => png(192, 192, (x, y) => (x >= 44 && x < 148 && y >= 86 && y < 106 ? [255, 255, 255] : [37, 99, 235]));

/**
 * A post of the seed file as the site has it, with the _rev an update of it has to give back.
 * Without it a feature cannot go on, and says so.
 * @param {Api} api @param {SeedEntry | undefined} entry the post, as the seed file has it @param {string} what what the list wants it for @returns {Promise<Entry>}
 */
const seeded = async (api, entry, what) => {
	const slug = entry?.slug;
	sure(slug, `the seed file has no ${what}`);
	const found = await orNone(api.emdash.get("posts", slug, { raw: true }));
	sure(found, `the post ${slug} is not there: the seed file makes it, and its line above says why it did not`);
	return found;
};
/** Where a post is, for a request about it. @param {Entry} found */
const at = (found) => ({ path: { collection: "posts", id: found.id } });
/** The photograph on a post, as its image field holds it; null when it has none. @param {Entry} found @returns {{ id: string, alt?: string, filename?: string } | null} */
const photograph = (found) => {
	const held = /** @type {{ id?: unknown, alt?: unknown, filename?: unknown } | null | undefined} */ (found.data.featured_image);
	return typeof held?.id === "string" ? { id: held.id, ...(typeof held.alt === "string" ? { alt: held.alt } : {}), ...(typeof held.filename === "string" ? { filename: held.filename } : {}) } : null;
};
/** A picture of the media library by its file's name, with the address a visitor fetches it at; null when it is not there. @param {Api} api @param {string} name */
const picture = async (api, name) => one((await api.send("get", "/media", { query: { q: name } })).items, "filename", name);
/** What search engines are told of a post. @param {Api} api @param {Entry} found */
const told = async (api, found) => (await api.send("get", "/content/{collection}/{id}", at(found))).item.seo;
/** How many revisions a post has. @param {Api} api @param {Entry} found */
const revisions = async (api, found) => (await api.send("get", "/content/{collection}/{id}/revisions", at(found))).total;
/** The comments a visitor is shown under a post; none when comments are off. @param {Api} api @param {Entry} found */
const comments = async (api, found) => {
	try {
		return (await api.visitor.send("get", "/comments/{collection}/{contentId}", { path: { collection: "posts", contentId: found.id } })).items;
	} catch (e) {
		if (e instanceof Refused) return [];
		throw e;
	}
};

/** @type {Feature[]} */
export const features = [
	{
		// A seed file's entry has no place for what search engines read: it is the post's own title and
		// excerpt. (A request: the client's update gives an entry its data, and nothing else of it.)
		name: "search engines",
		have: async (api, seed) => {
			const seo = await told(api, await seeded(api, parts(seed).lead, "published post"));
			return !!(seo?.title && seo?.description);
		},
		make: async (api, seed) => {
			const found = await seeded(api, parts(seed).lead, "published post");
			await api.send("put", "/content/{collection}/{id}", { ...at(found), body: { seo: { title: String(found.data.title), description: String(found.data.excerpt) }, _rev: found._rev } });
		},
		proof: async (api, seed) => {
			const found = await seeded(api, parts(seed).lead, "published post");
			const seo = await told(api, found);
			sure(seo?.title && seo?.description, `${found.slug} has no title or no description for search engines`);
			return `${found.slug} has a title and a description for search engines: its own title and excerpt`;
		},
	},
	{
		// The post as the seed file made it is its first revision. Two edits are two more, and no new
		// words: its excerpt without its last sentence, then whole again — it ends as the file has it.
		name: "revisions",
		have: async (api, seed) => (await revisions(api, await seeded(api, parts(seed).lead, "published post"))) >= 3,
		make: async (api, seed) => {
			const { lead } = parts(seed);
			let found = await seeded(api, lead, "published post");
			const whole = String(lead?.data.excerpt ?? "");
			sure(whole, `${found.slug} has no excerpt in the seed file to edit`);
			const edits = [whole.replace(/\s+[^.!?]+[.!?]\s*$/, "") || whole, whole];
			// each update is a revision of its own, and has to give back the _rev of what it changes
			for (let n = Math.max(1, await revisions(api, found)); n < 3; n++) found = await api.emdash.update("posts", found.id, { data: { excerpt: edits[n - 1] }, _rev: found._rev });
			// an update of a published post waits as a draft of it: published, the last one is what a visitor reads
			await api.emdash.publish("posts", found.id);
		},
		proof: async (api, seed) => {
			const { lead } = parts(seed);
			const found = await seeded(api, lead, "published post");
			sure(found.data.excerpt === lead?.data.excerpt, `${found.slug} does not read as the seed file has it: an edit was left half way`);
			return `${found.slug} has ${await revisions(api, found)} revisions to compare and go back to, and reads as the seed file has it`;
		},
	},
	{
		// (a seed file's entry is a draft or published: the day one is to be published is not in the format)
		name: "scheduled post",
		have: async (api, seed) => (await seeded(api, parts(seed).later, "second draft to schedule")).status === "scheduled",
		make: async (api, seed) => {
			const found = await seeded(api, parts(seed).later, "second draft to schedule");
			// one whose day has come is published: it is taken back, and given a day again
			if (found.status === "published") await api.emdash.unpublish("posts", found.id);
			await api.emdash.schedule("posts", found.id, { at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() });
		},
		proof: async (api, seed) => {
			const { later } = parts(seed);
			const due = one((await api.emdash.list("posts", { status: "scheduled" })).items, "slug", later?.slug ?? null);
			sure(due?.scheduledAt, `${later?.slug} is not among the scheduled posts`);
			return `${due.slug} is among the scheduled posts, for ${due.scheduledAt.slice(0, 10)}`;
		},
	},
	{
		name: "comments",
		have: async (api, seed) => (await comments(api, await seeded(api, parts(seed).lead, "published post"))).some((c) => c.parentId),
		make: async (api, seed) => {
			const found = await seeded(api, parts(seed).lead, "published post");
			// The seed file turned comments on for posts. That they are shown at once is not in its format:
			// a demo has nobody to approve them.
			await api.send("put", "/schema/collections/{slug}", { path: { slug: "posts" }, body: { commentsModeration: "none" } });
			// sent as a visitor sends one: with no sign-in
			const send = (/** @type {{ authorName: string, authorEmail: string, body: string, parentId?: string }} */ comment) => api.visitor.send("post", "/comments/{collection}/{contentId}", { path: { collection: "posts", contentId: found.id }, body: comment });
			const first = one(await comments(api, found), "parentId", null) ?? (await send({ authorName: "Maya", authorEmail: "maya@example.com", body: "Thank you for this. Short, clear, and I am trying it on Monday." }));
			await send({ authorName: "Demo Editor", authorEmail: "editor@example.com", body: "Glad it is useful. Tell us how it goes.", parentId: first.id });
		},
		proof: async (api, seed) => {
			const found = await seeded(api, parts(seed).lead, "published post");
			const shown = await comments(api, found);
			sure(shown.length >= 2, `a visitor is shown ${shown.length} comments under ${found.slug}, not the two that were sent`);
			return `a visitor is shown ${shown.length} comments under ${found.slug}, ${shown.filter((c) => c.parentId).length} of them an answer to another`;
		},
	},
	{
		// nothing to make: the link is a signature over the entry and a time, and the site keeps nothing of it
		name: "preview link",
		proof: async (api, seed) => {
			const draft = await seeded(api, parts(seed).draft, "draft to preview");
			const title = String(draft.data.title);
			const link = (await api.send("post", "/content/{collection}/{id}/preview-url", { ...at(draft), body: { expiresIn: "1d" } })).url;
			const path = new URL(link, api.origin).pathname;
			const [open, preview] = [await api.visitor.page(path), await api.visitor.page(link)];
			// (a site answers a draft's address with a redirect, or with its "not found" page: either way without the draft)
			sure(!shows(open.text, title), `${path} shows the draft to any visitor`);
			sure(preview.status === 200 && shows(preview.text, title), `the preview link answered ${preview.status}, without the draft's title`);
			return `${path} does not show the draft to a visitor (it answers ${open.status}), and its preview link — signed, good for a day — shows it`;
		},
	},
	{
		// A seed file can name the site's icon only as a picture the library already has, by the id it has
		// there — which no file can know. So the icon is made here: the one picture that is not a
		// photograph, and the one given a caption and a focal point, which a seed file's pictures cannot be.
		// (The site's logo is left as it is, its title in words. EmDash refuses an SVG upload, a name drawn
		// here would need a font, and a mark with no name would take the title's place in the header.)
		name: "site icon",
		have: async (api) => {
			const item = await picture(api, ICON);
			return item?.focalX != null && (await api.send("get", "/settings")).favicon?.mediaId === item.id;
		},
		make: async (api) => {
			if (!(await picture(api, ICON))) await api.emdash.mediaUpload(new Uint8Array(icon()), ICON, { alt: "A white dash on a blue square", caption: "The site's icon: what a browser shows on its tab.", contentType: "image/png" });
			const item = await picture(api, ICON);
			sure(item, `${ICON} was uploaded, and is not in the media library when asked for again`);
			// where a picture is cropped around when a page shows it in another shape: here, its middle
			await api.send("put", "/media/{id}", { path: { id: item.id }, body: { focalX: 0.5, focalY: 0.5 } });
			await api.send("post", "/settings", { body: { favicon: { mediaId: item.id, ...(item.alt ? { alt: item.alt } : {}) } } });
		},
		proof: async (api) => {
			const item = await picture(api, ICON);
			sure(item, `${ICON} is not in the media library`);
			const [front, file] = [await api.visitor.page("/"), await api.visitor.page(item.url)];
			const kind = file.headers["content-type"] ?? "no kind of file";
			sure(file.status === 200 && kind.startsWith("image/"), `the icon's address answered a visitor ${file.status}, ${kind}`);
			sure(new RegExp(`<link[^>]+rel="icon"[^>]+${(item.url.split("/").pop() ?? "").replace(/\W/g, "\\$&")}`).test(front.text), "the front page does not name the icon for the browser's tab");
			return `the front page names ${ICON} for the browser's tab, and its address answers a visitor with ${kind}; in the library it has alt text, a caption and a focal point (${item.focalX}/${item.focalY})`;
		},
	},
	{
		// The picture a link to the site is shown with elsewhere, when its page has none of its own: like
		// the icon, a seed file can only name it by an id the site gives. It is the newest post's photograph.
		name: "shared links",
		have: async (api, seed) => {
			const photo = photograph(await seeded(api, parts(seed).lead, "published post"));
			return !!photo && (await api.send("get", "/settings")).seo?.defaultOgImage?.mediaId === photo.id;
		},
		make: async (api, seed) => {
			const found = await seeded(api, parts(seed).lead, "published post");
			const photo = photograph(found);
			sure(photo, `${found.slug} has no photograph to use: the seed file's content line above says why`);
			// (sent alone, it is put beside the other settings for search engines, which stay as they are)
			await api.send("post", "/settings", { body: { seo: { defaultOgImage: { mediaId: photo.id, ...(photo.alt ? { alt: photo.alt } : {}) } } } });
		},
		proof: async (api, seed) => {
			const found = await seeded(api, parts(seed).lead, "published post");
			const front = await api.visitor.page("/");
			const named = /<meta[^>]+og:image[^>]+content="([^"]+)"/.exec(front.text)?.[1] ?? "";
			// (the page names it at the site's public address, which on this machine may be nobody's: its
			// path is asked of the site that is running here)
			const file = named ? await api.visitor.page(new URL(named, api.origin).pathname) : null;
			sure(file?.status === 200 && (file.headers["content-type"] ?? "").startsWith("image/"), `the front page names no picture for a link to it (og:image), or that picture's address answered a visitor ${file?.status}`);
			return `a link to the front page, shared elsewhere, is shown with the photograph of ${found.slug}: the page names it, and its address answers a visitor with ${file.headers["content-type"]}`;
		},
	},
	{
		// what the seed file made, as a visitor meets it
		name: "visitor's view",
		proof: async (api, seed) => {
			const { lead, redirect, linked } = parts(seed);
			const found = await seeded(api, lead, "published post");
			const front = await api.visitor.page("/");
			const title = String(seed.settings?.title ?? "");
			sure(front.status === 200 && shows(front.text, title), `the front page answered a visitor ${front.status}, and does not show "${title}"`);
			sure(!linked || shows(front.text, linked), `the front page does not show ${linked} in its menu`);
			const page = await api.visitor.page(`/posts/${found.slug}`);
			sure(page.status === 200 && shows(page.text, String(found.data.title)), `/posts/${found.slug} answered a visitor ${page.status}, without the post's title`);
			// its photograph: on the post, shown on its page, and its file there for anyone
			const photo = photograph(found);
			sure(photo, `${found.slug} has no photograph: the seed file's content line above says why`);
			// (the library's list is what gives an item its address)
			const item = one((await api.send("get", "/media", { query: { q: photo.filename ?? "" } })).items, "id", photo.id);
			const file = item ? await api.visitor.page(item.url) : null;
			sure(file?.status === 200 && (file.headers["content-type"] ?? "").startsWith("image/"), `the photograph of ${found.slug} is not in the media library, or its address answered a visitor ${file?.status}`);
			sure(!photo.alt || shows(page.text, photo.alt), `the page of ${found.slug} does not show its photograph (by its alt text)`);
			const sent = redirect ? await api.visitor.page(redirect.source) : null;
			const to = sent?.headers.location ? new URL(sent.headers.location, api.origin).pathname : "nowhere";
			sure(!redirect || (sent?.status === 301 && to === redirect.destination), `${redirect?.source} answered a visitor ${sent?.status}, to ${to}`);
			// what the file says to search engines' robots is what they are served
			const robots = (seed.settings?.seo?.robotsTxt ?? "").trim();
			sure(!robots || (await api.visitor.page("/robots.txt")).text.includes(robots), "/robots.txt is not what the seed file's settings say");
			return `the front page is titled "${title}"${linked ? ` and its menu shows ${linked}` : ""}; /posts/${found.slug} answers 200 with its title and its photograph${redirect ? `; ${redirect.source} sends on, with a 301, to ${to}` : ""}${robots ? "; /robots.txt is the file's" : ""}`;
		},
	},
	{
		// nothing to make: EmDash put the post into its index when it was published. (EmDash's client, with no sign-in.)
		name: "search",
		proof: async (api, seed) => {
			const found = await seeded(api, parts(seed).lead, "published post");
			const title = String(found.data.title);
			const word = (title.split(/\s+/).find((w) => w.length > 4) ?? title).toLowerCase();
			const results = await api.visitor.emdash.search(word);
			const hit = one(results, "id", found.id);
			sure(hit, `a visitor's search for "${word}" found ${results.length} entries, and ${found.slug} is not one`);
			return `a visitor's search for "${word}" finds "${hit.title}"`;
		},
	},
	{
		name: "API token",
		have: async (api) => !!one((await api.send("get", "/admin/api-tokens")).items, "name", READ_ONLY),
		// EmDash shows a new token once, in its answer to this. It is dropped here: not kept, not printed
		make: async (api) => void (await api.send("post", "/admin/api-tokens", { body: { name: READ_ONLY, scopes: SCOPES } })),
		proof: async (api) => {
			const made = one((await api.send("get", "/admin/api-tokens")).items, "name", READ_ONLY);
			sure(made && made.scopes.every((s) => SCOPES.includes(s)), `${READ_ONLY} is not among the tokens, or may do more than read`);
			return `${READ_ONLY} is among the tokens and may only read (${made.scopes.join(", ")}). The token itself was not kept: make one in the admin to use one`;
		},
	},
	{
		name: "backup",
		have: async (api) => {
			const backups = await api.send("get", "/settings/backups");
			return backups.settings.enabled && backups.archives.length > 0;
		},
		make: async (api) => {
			await api.send("put", "/settings/backups", { body: { enabled: true, retention: 7 } });
			if (!(await api.send("get", "/settings/backups")).archives.length) await api.send("post", "/settings/backups/archives");
		},
		proof: async (api) => {
			const backups = await api.send("get", "/settings/backups");
			sure(backups.settings.enabled && backups.archives.length, "backups are off, or none has been taken");
			return `backups are on, the last ${backups.settings.retention} kept; ${backups.archives.length} taken so far, in the site's own storage: ${backups.archives[0].name}`;
		},
	},
];

/** @type {Graph} */
export const demo = {
	// The task site:demo. It stands on this machine being signed in to the built site, which stands
	// on that site being built and running: the graph sees to all three.
	"site:demo": {
		needs: () => ["signin:token"],
		work: async (ctx) => {
			const { world, project } = ctx;
			const api = await connect(ctx);
			world.say(`-> this machine, built site (site:preview): ${api.origin}`);
			// The demo's seed file ships with these tasks, beside the scripts. Its title and tagline replace
			// the site's own, which a seed otherwise leaves: that the site is renamed is what was asked for.
			const { seed, count } = await seedFile(ctx, api, join(project.scripts, "..", "seeds", "demo.json"), { replace: true });
			const more = { made: 0, had: 0, shown: 0, failed: 0 };
			for (const feature of features) {
				// A feature that fails does not stop the others: each line stands for itself, and those that
				// needed the failed one say so in theirs.
				try {
					const had = feature.have ? await feature.have(api, seed) : null;
					if (had === false) await feature.make?.(api, seed);
					const proof = await feature.proof(api, seed);
					more[had === null ? "shown" : had ? "had" : "made"]++;
					world.say(`ok   ${feature.name}: ${had === null ? "nothing to make" : had ? "already there" : "made"} — ${proof}`);
				} catch (e) {
					more.failed++;
					world.say(`FAIL ${feature.name}: ${e instanceof Error ? e.message : String(e)}`);
				}
			}
			world.say(`the seed file, applied: ${tallied(count)}`);
			world.say(`what a seed file cannot say, ${features.length} features: ${more.made} made, ${more.had} already there, ${more.shown} with nothing to make${more.failed ? `, ${more.failed} FAILED` : ""}`);
			const failed = count.failed + more.failed;
			if (failed) throw new Error(`site:demo: ${failed} thing${failed === 1 ? "" : "s"} could not be made or shown to work. Each FAIL line above says which, and what the site answered. Run it again once that is put right: what is there is left alone.`);
		},
	},
};
