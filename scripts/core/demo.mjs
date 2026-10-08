// site:demo — something real in every core feature of EmDash, on this machine's built site.
//
// A site that has just been made has a model and nothing in it, and an admin with nothing in it
// shows nothing of what EmDash does. This fills it through EmDash's own HTTP API. Not its CLI:
// that makes a post, uploads a file and adds a term, and has no command for a setting, a byline, a
// menu item, a widget, a section, a comment, a redirect, a token, a backup or a preview link — so
// everything is asked one way, and a feature is looked for the way it was made.
//
// It is a LIST OF FEATURES (below). To add one, add an entry:
//   name    what the line is called
//   have    is it already there? Then nothing is made — the task is safe to run again
//   make    make it. Every part is looked for first, so a run that stopped half way is picked up
//   proof   what shows it works, in a few words — asked as a visitor would ask wherever a visitor can
// The requests are what EmDash 1.2.0 was seen to accept (its own list of them is at
// /_emdash/api/openapi.json, and where the two differ a note says so).
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

import { savedName } from "./signin.mjs";

/**
 * @typedef {import("./graph.mjs").Graph} Graph @typedef {import("./graph.mjs").Ctx} Ctx
 * What the site answered. `data` and `error` are EmDash's own JSON: their shape is EmDash's, and is
 * read field by field where it is used.
 * @typedef {{ status: number, text: string, headers: Record<string, string>, data: any, error: { code?: string, message?: string } | undefined, asked: string }} Answer
 * @typedef {object} Api
 * @property {string} origin                                                              the built site's address
 * @property {(method: string, path: string, body?: unknown) => Promise<Answer>} ask      a path of the API, signed in
 * @property {(method: string, path: string, body?: unknown) => Promise<any>} must        the same: its data — or, refused, what the site answered, thrown
 * @property {(path: string) => Promise<any>} find                                        the data of a GET; null when there is no such thing
 * @property {(method: string, path: string, body?: unknown) => Promise<Answer>} visitor  a path of the site, with no sign-in: what anyone gets
 * @typedef {object} Feature
 * @property {string} name
 * @property {(api: Api) => Promise<boolean>} [have]   (have and make are left out by a feature EmDash makes by itself)
 * @property {(api: Api) => Promise<void>} [make]
 * @property {(api: Api) => Promise<string>} proof
 */

// What the demo is made of. A feature finds its own things again by these names.
const TITLE = "EmDash Demo";
const TAGLINE = "Every feature, with something in it";
const TERMS = [["category", "tutorials", "Tutorials"], ["tag", "demo", "Demo"]];
const IMAGE = "emdash-demo.png";
const BYLINE = "demo-editor";
const POST = "kitchen-sink";
const POST_TITLE = "The kitchen sink";
// (the post's excerpt as it is first written, and after each of the two edits that give it revisions)
const EXCERPTS = ["One post with everything on it.", "One post with everything on it: a picture, a category and a tag.", "One post with everything on it: a picture, a category, a tag, a byline, and a title and description for search engines."];
const DRAFT = "work-in-progress";
const DRAFT_TITLE = "A draft, not yet published";
const LATER = "coming-soon";
const PAGE = "contact";
const EMDASH = "https://emdashcms.com";
const READ_ONLY = "demo-read-only";
const SCOPES = ["content:read", "media:read"];

/** What has to be so, or the feature fails with these words. @type {(so: unknown, otherwise: string) => asserts so} */
const sure = (so, otherwise) => {
	if (!so) throw new Error(otherwise);
};
/** The one in a list EmDash answered with that has this value in this field; null when none has. @param {any[]} list @param {string} field @param {unknown} value @returns {any} */
const one = (list, field, value) => list.find((item) => item[field] === value) ?? null;

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
const good = (a) => {
	sure(a.status >= 200 && a.status < 300, `${a.asked} answered ${said(a)}`);
	return a.data;
};

/**
 * How the features speak to the built site: with the token signin:token saved for it on this
 * machine (a token needs no CSRF header), or with nothing, as a visitor.
 * @param {Ctx} ctx @returns {Api}
 */
const client = ({ world, project }) => {
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

/**
 * One block of Portable Text, the form EmDash's API takes a body in: a style, and its words — a
 * string, or [words, address] for a link.
 * @param {string} key @param {string} style @param {(string | [string, string])[]} words @param {boolean} [item] one item of a list
 */
const block = (key, style, words, item = false) => ({
	_type: "block",
	_key: key,
	style,
	...(item ? { listItem: "bullet", level: 1 } : {}),
	markDefs: words.flatMap((w, i) => (typeof w === "string" ? [] : [{ _type: "link", _key: `${key}l${i}`, href: w[1] }])),
	children: words.map((w, i) => ({ _type: "span", _key: `${key}s${i}`, text: typeof w === "string" ? w : w[0], marks: typeof w === "string" ? [] : [`${key}l${i}`] })),
});

/**
 * A small picture, made here: nothing is downloaded, and no file is kept in the repo. A PNG is a
 * signature and three chunks — the size, the pixels (rows of red-green-blue, each after a 0 byte,
 * deflated), the end — each chunk with its length before it and a CRC after.
 * @param {number} width @param {number} height
 */
export const picture = (width, height) => {
	const rows = Buffer.alloc(height * (1 + width * 3));
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows.set([40 + Math.round((180 * x) / width), 110, 200 - Math.round((90 * x) / width)], y * (1 + width * 3) + 1 + x * 3);
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

/**
 * An entry of a collection by its slug, with the _rev an update of it has to give back; null when
 * there is none.
 * @param {Api} api @param {string} collection @param {string} slug @returns {Promise<any>}
 */
const entry = async (api, collection, slug) => {
	const got = await api.find(`/content/${collection}/${slug}`);
	return got && { ...got.item, _rev: got._rev };
};
/** The demo's picture in the media library, or null. @param {Api} api */
const image = async (api) => one((await api.must("GET", `/media?q=${IMAGE}`)).items, "filename", IMAGE);
/** The demo's byline, or null. @param {Api} api */
const byline = async (api) => one((await api.must("GET", `/admin/bylines?search=${BYLINE}`)).items, "slug", BYLINE);
/** How many revisions the published post has; 0 when there is no such post. @param {Api} api @returns {Promise<number>} */
const revisions = async (api) => {
	const post = await entry(api, "posts", POST);
	return post ? (await api.must("GET", `/content/posts/${post.id}/revisions`)).total : 0;
};
/** The comments a visitor is shown under the published post; none when there is no post, or comments are off. @param {Api} api @returns {Promise<any[]>} */
const comments = async (api) => {
	const post = await entry(api, "posts", POST);
	const shown = post ? await api.visitor("GET", `/_emdash/api/comments/posts/${post.id}`) : null;
	return shown?.status === 200 ? shown.data.items : [];
};
/** A menu and its items, by its name: made when there is none. @param {Api} api @param {string} name @param {string} label */
const menu = async (api, name, label) => (await api.find(`/menus/${name}`)) ?? { ...(await api.must("POST", "/menus", { name, label })), items: [] };
/** A widget area and its widgets, by its name: made when there is none. @param {Api} api @param {string} name @param {string} label */
const area = async (api, name, label) => (await api.find(`/widget-areas/${name}`)) ?? { ...(await api.must("POST", "/widget-areas", { name, label })), widgets: [] };

/** @type {Feature[]} */
export const features = [
	{
		name: "settings",
		have: async (api) => (await api.must("GET", "/settings")).title === TITLE,
		// (POST: EmDash's own list of its requests says PUT, which the site answers with its 404 page)
		make: async (api) => void (await api.must("POST", "/settings", { title: TITLE, tagline: TAGLINE, url: api.origin })),
		proof: async (api) => {
			const front = await api.visitor("GET", "/");
			sure(front.status === 200 && front.text.includes(TITLE), `the front page answered a visitor ${front.status}, and does not show "${TITLE}"`);
			return `the front page is titled "${TITLE}"`;
		},
	},
	{
		name: "taxonomy terms",
		have: async (api) => {
			for (const [taxonomy, slug] of TERMS) if (!(await api.find(`/taxonomies/${taxonomy}/terms/${slug}`))) return false;
			return true;
		},
		make: async (api) => {
			for (const [taxonomy, slug, label] of TERMS) if (!(await api.find(`/taxonomies/${taxonomy}/terms/${slug}`))) await api.must("POST", `/taxonomies/${taxonomy}/terms`, { slug, label });
		},
		proof: async (api) => {
			const listed = [];
			for (const [taxonomy, slug, label] of TERMS) {
				sure(one((await api.must("GET", `/taxonomies/${taxonomy}/terms`)).terms, "slug", slug), `${label} is not among the terms of ${taxonomy}`);
				listed.push(`the ${taxonomy} ${label}`);
			}
			return `${listed.join(" and ")} are in their lists`;
		},
	},
	{
		name: "media",
		have: async (api) => (await image(api))?.focalX != null,
		make: async (api) => {
			let item = await image(api);
			if (!item) {
				const form = new FormData();
				form.set("file", new Blob([picture(480, 270)], { type: "image/png" }), IMAGE);
				for (const [field, value] of [["alt", "A band of colour, from blue to orange"], ["caption", "Made by site:demo, to have a picture to show"], ["width", "480"], ["height", "270"]]) form.set(field, value);
				item = (await api.must("POST", "/media", form)).item;
			}
			// where the picture is cropped around, when a page shows it in another shape
			await api.must("PUT", `/media/${item.id}`, { focalX: 0.5, focalY: 0.3 });
		},
		proof: async (api) => {
			const item = await image(api);
			sure(item, `${IMAGE} is not in the media library`);
			const file = await api.visitor("GET", item.url);
			const kind = file.headers["content-type"] ?? "no kind of file";
			sure(file.status === 200 && kind.startsWith("image/"), `the picture's address answered a visitor ${file.status}, ${kind}`);
			const listed = (await api.must("GET", "/media")).items.length;
			return `${IMAGE} (${item.width}×${item.height}, alt text, a caption, focal point ${item.focalX}/${item.focalY}) is ${listed === 1 ? "the one item" : `one of ${listed}`} in the library, and its address answers a visitor with ${kind}`;
		},
	},
	{
		name: "byline",
		have: async (api) => !!(await byline(api)),
		make: async (api) => void (await api.must("POST", "/admin/bylines", { slug: BYLINE, displayName: "Demo Editor", bio: "Writes what site:demo puts on the site." })),
		proof: async (api) => {
			const made = await byline(api);
			sure(made, `${BYLINE} is not among the bylines`);
			return `${made.displayName} (${BYLINE}) is among the bylines`;
		},
	},
	{
		name: "published post",
		have: async (api) => (await entry(api, "posts", POST))?.status === "published",
		make: async (api) => {
			let post = await entry(api, "posts", POST);
			if (!post) {
				const [shown, author] = [await image(api), await byline(api)];
				sure(shown && author, "it takes the picture and the byline, and they are not there: their lines above say why");
				post = (
					await api.must("POST", "/content/posts", {
						slug: POST,
						data: {
							title: POST_TITLE,
							excerpt: EXCERPTS[0],
							featured_image: { provider: "local", id: shown.id, alt: shown.alt, width: shown.width, height: shown.height, filename: shown.filename, mimeType: shown.mimeType },
							// (the API takes a body as Portable Text; EmDash's CLI is what turns markdown into it)
							content: [
								block("a", "h2", ["What is on this post"]),
								block("b", "normal", ["It was made by site:demo, through the HTTP API of ", ["EmDash", EMDASH], "."]),
								block("c", "normal", ["A picture, with alt text, a caption and a focal point"], true),
								block("d", "normal", ["A category and a tag"], true),
								block("e", "normal", ["A byline, and a title and a description for search engines"], true),
								block("f", "blockquote", [TAGLINE + "."]),
							],
						},
						taxonomies: { category: ["tutorials"], tag: ["demo"] },
						seo: { title: `${POST_TITLE} — every field of a post`, description: "A post made by site:demo: a picture, a category, a tag, a byline and the fields search engines read." },
						bylines: [{ bylineId: author.id }],
					})
				).item;
			}
			await api.must("POST", `/content/posts/${post.id}/publish`, {});
		},
		proof: async (api) => {
			const page = await api.visitor("GET", `/posts/${POST}`);
			sure(page.status === 200 && page.text.includes(POST_TITLE), `/posts/${POST} answered a visitor ${page.status}, without the post's title`);
			const post = await entry(api, "posts", POST);
			/** @type {[unknown, string][]} */
			const on = [
				[post.data.featured_image?.id, "a picture"],
				[(await api.must("GET", `/content/posts/${post.id}/terms/category`)).terms.length, "a category"],
				[(await api.must("GET", `/content/posts/${post.id}/terms/tag`)).terms.length, "a tag"],
				[post.bylines?.length, "a byline"],
				[post.seo?.title && post.seo?.description, "a title and a description for search engines"],
			];
			sure(on.every(([is]) => is), `the post has no ${on.filter(([is]) => !is).map(([, what]) => what.replace(/^an? /, "")).join(", no ")}`);
			return `/posts/${POST} answers a visitor 200 with its title; on the post: ${on.map(([, what]) => what).join(", ")}`;
		},
	},
	{
		name: "draft with a preview link",
		have: async (api) => !!(await entry(api, "posts", DRAFT)),
		make: async (api) =>
			void (await api.must("POST", "/content/posts", {
				slug: DRAFT,
				status: "draft",
				data: { title: DRAFT_TITLE, excerpt: "Only someone with its preview link can read this.", content: [block("a", "normal", ["Still being written."])] },
			})),
		// (the link is asked for each time: it is a signature over the entry and a time, and the site keeps nothing of it)
		proof: async (api) => {
			const draft = await entry(api, "posts", DRAFT);
			const link = (await api.must("POST", `/content/posts/${draft.id}/preview-url`, { expiresIn: "1d" })).url;
			const path = new URL(link, api.origin).pathname;
			const [open, preview] = [await api.visitor("GET", path), await api.visitor("GET", link)];
			sure(open.status !== 200, `${path} answers a visitor 200: the draft is there for anyone to read`);
			sure(preview.status === 200 && preview.text.includes(DRAFT_TITLE), `the preview link answered ${preview.status}, without the draft's title`);
			return `${path} answers a visitor ${open.status}, and its preview link — signed, good for a day — answers 200 with the draft`;
		},
	},
	{
		name: "revisions",
		have: async (api) => (await revisions(api)) >= EXCERPTS.length,
		make: async (api) => {
			let post = await entry(api, "posts", POST);
			sure(post, "the published post is not there to edit: its line above says why");
			// each update is a revision of its own, and has to give back the _rev of what it changes
			for (let n = await revisions(api); n < EXCERPTS.length; n++) {
				const changed = await api.must("PUT", `/content/posts/${post.id}`, { data: { excerpt: EXCERPTS[n] }, _rev: post._rev });
				post = { ...changed.item, _rev: changed._rev };
			}
			// an update of a published post waits as a draft of it: published, the last one is what a visitor reads
			await api.must("POST", `/content/posts/${post.id}/publish`, {});
		},
		proof: async (api) => `${POST} has ${await revisions(api)} revisions to compare and go back to: as first published, and each edit since`,
	},
	{
		name: "scheduled post",
		have: async (api) => (await entry(api, "posts", LATER))?.status === "scheduled",
		make: async (api) => {
			const post =
				(await entry(api, "posts", LATER)) ??
				(await api.must("POST", "/content/posts", { slug: LATER, data: { title: "Coming soon", excerpt: "Scheduled: EmDash publishes this by itself when its day comes.", content: [block("a", "normal", ["Not yet."])] } })).item;
			// one whose day has come is published: it is taken back, and given a day again
			if (post.status === "published") await api.must("POST", `/content/posts/${post.id}/unpublish`, {});
			await api.must("POST", `/content/posts/${post.id}/schedule`, { scheduledAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() });
		},
		proof: async (api) => {
			const due = one((await api.must("GET", "/content/posts?status=scheduled")).items, "slug", LATER);
			sure(due?.scheduledAt, `${LATER} is not among the scheduled posts`);
			return `${LATER} is among the scheduled posts, for ${String(due.scheduledAt).slice(0, 10)}`;
		},
	},
	{
		name: "menus",
		have: async (api) => {
			const page = await entry(api, "pages", PAGE);
			const [main, footer] = [await api.find("/menus/primary"), await api.find("/menus/footer")];
			return page?.status === "published" && !!main && !!one(main.items, "referenceId", page.id) && !!footer && !!one(footer.items, "customUrl", EMDASH);
		},
		make: async (api) => {
			const page = (await entry(api, "pages", PAGE)) ?? (await api.must("POST", "/content/pages", { slug: PAGE, data: { title: "Contact", content: [block("a", "normal", ["Write to us: ", ["hello@example.com", "mailto:hello@example.com"], "."])] } })).item;
			if (page.status !== "published") await api.must("POST", `/content/pages/${page.id}/publish`, {});
			// an item that is a page follows the page: its address and its name are not written twice
			if (!one((await menu(api, "primary", "Primary Navigation")).items, "referenceId", page.id)) await api.must("POST", "/menus/primary/items", { type: "page", label: "Contact", referenceCollection: "pages", referenceId: page.id });
			if (!one((await menu(api, "footer", "Footer")).items, "customUrl", EMDASH)) await api.must("POST", "/menus/footer/items", { type: "custom", label: "EmDash", customUrl: EMDASH });
		},
		proof: async (api) => {
			const front = await api.visitor("GET", "/");
			sure(/>\s*Contact\s*</.test(front.text), `the front page (${front.status}) does not show Contact in its menu`);
			const footer = (await api.must("GET", "/menus/footer")).items.length;
			return `the front page's menu shows Contact, an item that is the page ${PAGE}; a second menu, footer, has ${footer} item${footer === 1 ? "" : "s"}`;
		},
	},
	{
		name: "widgets",
		have: async (api) => {
			const [side, foot] = [await api.find("/widget-areas/sidebar"), await api.find("/widget-areas/footer")];
			return !!side && !!one(side.widgets, "title", "Tags") && !!foot && !!one(foot.widgets, "menuName", "footer");
		},
		make: async (api) => {
			if (!one((await area(api, "sidebar", "Sidebar")).widgets, "title", "Tags")) await api.must("POST", "/widget-areas/sidebar/widgets", { type: "component", componentId: "core:tags", title: "Tags" });
			if (!one((await area(api, "footer", "Footer")).widgets, "menuName", "footer")) await api.must("POST", "/widget-areas/footer/widgets", { type: "menu", menuName: "footer", title: "Elsewhere" });
		},
		proof: async (api) => {
			const side = (await api.must("GET", "/widget-areas/sidebar")).widgets;
			const foot = (await api.must("GET", "/widget-areas/footer")).widgets;
			sure(one(side, "title", "Tags") && one(foot, "menuName", "footer"), "the Tags widget or the footer's menu widget is not in its area");
			return `the area sidebar has ${side.length} widgets, Tags among them; a second area, footer, shows the menu footer`;
		},
	},
	{
		name: "section",
		have: async (api) => !!(await api.find("/sections/newsletter")),
		make: async (api) =>
			void (await api.must("POST", "/sections", {
				slug: "newsletter",
				title: "Newsletter",
				description: "A call to sign up, to put into any page.",
				keywords: ["cta"],
				content: [block("a", "h3", ["Get the newsletter"]), block("b", "normal", ["One letter a month, and no more."])],
			})),
		proof: async (api) => {
			const made = await api.must("GET", "/sections/newsletter");
			return `${made.title} is among the sections an editor can put into a page: ${made.content.length} blocks, found by the word ${made.keywords.join(", ")}`;
		},
	},
	{
		name: "comments",
		have: async (api) => (await comments(api)).some((c) => c.parentId),
		make: async (api) => {
			const post = await entry(api, "posts", POST);
			sure(post, "the published post is not there to comment on: its line above says why");
			// on for posts, and shown at once: a demo has nobody to approve them
			await api.must("PUT", "/schema/collections/posts", { commentsEnabled: true, commentsModeration: "none" });
			// sent as a visitor sends one: with no sign-in
			const send = async (/** @type {Record<string, string>} */ comment) => good(await api.visitor("POST", `/_emdash/api/comments/posts/${post.id}`, comment));
			const first = one(await comments(api), "parentId", null) ?? (await send({ authorName: "A Visitor", authorEmail: "visitor@example.com", body: "A comment, sent the way a visitor sends one." }));
			await send({ authorName: "Demo Editor", authorEmail: "editor@example.com", body: "And an answer to it.", parentId: first.id });
		},
		proof: async (api) => {
			const shown = await comments(api);
			sure(shown.length >= 2, `a visitor is shown ${shown.length} comments under ${POST}, not the two that were sent`);
			return `a visitor is shown ${shown.length} comments under ${POST}, ${shown.filter((c) => c.parentId).length} of them an answer to another`;
		},
	},
	{
		name: "redirect",
		have: async (api) => !!one((await api.must("GET", `/redirects?search=${encodeURIComponent("/hello")}`)).items, "source", "/hello"),
		make: async (api) => void (await api.must("POST", "/redirects", { source: "/hello", destination: `/posts/${POST}`, type: 301 })),
		proof: async (api) => {
			const sent = await api.visitor("GET", "/hello");
			const to = sent.headers.location ? new URL(sent.headers.location, api.origin).pathname : "nowhere";
			sure(sent.status === 301 && to === `/posts/${POST}`, `/hello answered a visitor ${sent.status}, to ${to}`);
			return `/hello sends a visitor on, with a 301, to ${to}`;
		},
	},
	{
		name: "search",
		// nothing to make: EmDash put the post into its index when it was published
		proof: async (api) => {
			const found = good(await api.visitor("GET", "/_emdash/api/search?q=kitchen")).items;
			sure(one(found, "slug", POST), `a visitor's search for "kitchen" found ${found.length} entries, and ${POST} is not one`);
			return `a visitor's search for "kitchen" finds "${one(found, "slug", POST).title}"`;
		},
	},
	{
		name: "API token",
		have: async (api) => !!one((await api.must("GET", "/admin/api-tokens")).items, "name", READ_ONLY),
		// EmDash shows a new token once, in its answer to this. It is dropped here: not kept, not printed
		make: async (api) => void (await api.must("POST", "/admin/api-tokens", { name: READ_ONLY, scopes: SCOPES })),
		proof: async (api) => {
			const made = one((await api.must("GET", "/admin/api-tokens")).items, "name", READ_ONLY);
			sure(made && made.scopes.every((/** @type {string} */ s) => SCOPES.includes(s)), `${READ_ONLY} is not among the tokens, or may do more than read`);
			return `${READ_ONLY} is among the tokens and may only read (${made.scopes.join(", ")}). The token itself was not kept: make one in the admin to use one`;
		},
	},
	{
		name: "backup",
		have: async (api) => {
			const backups = await api.must("GET", "/settings/backups");
			return backups.settings.enabled && backups.archives.length > 0;
		},
		make: async (api) => {
			await api.must("PUT", "/settings/backups", { enabled: true, retention: 7 });
			if (!(await api.must("GET", "/settings/backups")).archives.length) await api.must("POST", "/settings/backups/archives");
		},
		proof: async (api) => {
			const backups = await api.must("GET", "/settings/backups");
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
			const { world } = ctx;
			const api = client(ctx);
			world.say(`-> this machine, built site (site:preview): ${api.origin}`);
			const count = { made: 0, had: 0, given: 0, failed: 0 };
			for (const feature of features) {
				// A feature that fails does not stop the others: each line stands for itself, and those that
				// needed the failed one say so in theirs.
				try {
					const had = feature.have ? await feature.have(api) : null;
					if (had === false) await feature.make?.(api);
					const proof = await feature.proof(api);
					count[had === null ? "given" : had ? "had" : "made"]++;
					world.say(`ok   ${feature.name}: ${had === null ? "nothing to make" : had ? "already there" : "made"} — ${proof}`);
				} catch (e) {
					count.failed++;
					world.say(`FAIL ${feature.name}: ${e instanceof Error ? e.message : String(e)}`);
				}
			}
			world.say(`${features.length} features: ${count.made} made, ${count.had} already there, ${count.given} with nothing to make${count.failed ? `, ${count.failed} FAILED` : ""}`);
			if (count.failed) throw new Error(`site:demo: ${count.failed} of ${features.length} features could not be made or shown to work. Each FAIL line above says what the site answered. Run it again once that is put right: what is already there is left alone.`);
		},
	},
};
