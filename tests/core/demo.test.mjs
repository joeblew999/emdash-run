// site:demo (scripts/core/demo.mjs), on a made-up EmDash: what it asks of an empty site and in what
// order, that a second run asks for nothing more, and what it says when the site refuses.
import assert from "node:assert/strict";
import { test } from "node:test";

import { graph } from "../../scripts/core/cli.mjs";
import { demo, features, picture } from "../../scripts/core/demo.mjs";
import { plan, reach } from "../../scripts/core/graph.mjs";
import { savedName } from "../../scripts/core/signin.mjs";
import { fakeWorld, project } from "./fake-world.mjs";

const TOKEN = "ec_pat_SAVED"; // what signin:token saved on this machine
const SHOWN_ONCE = "ec_pat_SHOWN_ONCE"; // what EmDash answers a new API token with
const SIGNATURE = "SIGNED"; // what makes a link a preview link

/**
 * A made-up EmDash: as much of its API, and of the pages it serves, as site:demo asks of it. It
 * keeps what it is sent, and answers in the shapes EmDash 1.2.0 was seen to answer in. It starts as
 * a site that has just been made does: a model, a primary menu, a sidebar, and nothing in them.
 */
const emdash = () => {
	/** @type {Record<string, any[]>} */
	const has = { terms: [], media: [], bylines: [], entries: [], menus: [{ name: "primary", items: [] }], areas: [{ name: "sidebar", widgets: [] }], sections: [], comments: [], redirects: [], tokens: [], archives: [] };
	/** @type {Record<string, unknown>} */
	const settings = { title: "My Site" };
	const backups = { enabled: false, retention: 7 };
	let commentsOn = false;
	let ids = 0;
	/** every request it was sent @type {{ method: string, path: string, signed: boolean }[]} */
	const asked = [];

	const yes = (/** @type {unknown} */ data, status = 200) => ({ status, text: JSON.stringify({ success: true, data }) });
	const no = (/** @type {number} */ status, /** @type {string} */ code, /** @type {string} */ message) => ({ status, text: JSON.stringify({ success: false, error: { code, message } }) });
	const gone = (/** @type {string} */ what) => no(404, "NOT_FOUND", `${what} not found`);
	const page = (/** @type {string} */ body) => ({ status: 200, text: `<!DOCTYPE html><html>${body}</html>`, headers: { "content-type": "text/html" } });
	/** Kept in a list, with an id of its own. @param {any[]} list @param {Record<string, unknown>} thing @returns {any} */
	const keep = (list, thing) => {
		list.push({ id: `ID${++ids}`, ...thing });
		return list.at(-1);
	};
	/** @param {any[]} list @param {string} field @param {unknown} value @returns {any} */
	const by = (list, field, value) => list.find((x) => x[field] === value);
	const entry = (/** @type {string} */ type, /** @type {string} */ key) => has.entries.find((e) => e.type === type && (e.id === key || e.slug === key));
	const withRev = (/** @type {any} */ e, status = 200) => yes({ item: e, _rev: `rev${e.version}` }, status);

	// the API: a method, a path, what it answers — and `true` where a visitor may ask it too
	/** @type {[string, RegExp, (at: string[], body: any, query: URLSearchParams) => { status: number, text: string }, boolean?][]} */
	const api = [
		["GET", /^\/settings$/, () => yes(settings)],
		["POST", /^\/settings$/, (_, body) => yes(Object.assign(settings, body))],
		["GET", /^\/taxonomies\/(\w+)\/terms$/, ([, name]) => yes({ terms: has.terms.filter((t) => t.name === name) })],
		["GET", /^\/taxonomies\/(\w+)\/terms\/([\w-]+)$/, ([, name, slug]) => (has.terms.some((t) => t.name === name && t.slug === slug) ? yes({ term: { name, slug } }) : gone(`Term '${slug}'`))],
		["POST", /^\/taxonomies\/(\w+)\/terms$/, ([, name], body) => yes({ term: keep(has.terms, { name, ...body }) }, 201)],
		["GET", /^\/media$/, (_, __, query) => yes({ items: has.media.filter((m) => m.filename.includes(query.get("q") ?? "")) })],
		["POST", /^\/media$/, (_, form) => yes({ item: keep(has.media, { filename: form.get("file").name, mimeType: form.get("file").type, width: Number(form.get("width")), height: Number(form.get("height")), alt: form.get("alt"), caption: form.get("caption"), focalX: null, focalY: null, url: "/_emdash/api/media/file/KEY.png" }) }, 201)],
		["PUT", /^\/media\/(\w+)$/, ([, id], body) => yes({ item: Object.assign(by(has.media, "id", id), body) })],
		["GET", /^\/admin\/bylines$/, () => yes({ items: has.bylines })],
		["POST", /^\/admin\/bylines$/, (_, body) => yes(keep(has.bylines, body), 201)],
		["GET", /^\/content\/(\w+)$/, ([, type], _, query) => yes({ items: has.entries.filter((e) => e.type === type && e.status === (query.get("status") ?? e.status)) })],
		["POST", /^\/content\/(\w+)$/, ([, type], body) => (entry(type, body.slug) ? no(409, "CONFLICT", `The slug '${body.slug}' is taken`) : withRev(keep(has.entries, { type, status: "draft", version: 1, revisions: 0, scheduledAt: null, bylines: [], seo: {}, taxonomies: {}, ...body }), 201))],
		["GET", /^\/content\/(\w+)\/([\w-]+)$/, ([, type, key]) => (entry(type, key) ? withRev(entry(type, key)) : gone(`Content item not found: ${key}`))],
		// an update has to give back the _rev of what it changes, and is a revision of its own
		["PUT", /^\/content\/(\w+)\/(\w+)$/, ([, type, key], body) => {
			const e = entry(type, key);
			if (body._rev !== `rev${e.version}`) return no(409, "CONFLICT", "Content has been modified since last read (version conflict)");
			Object.assign(e.data, body.data);
			e.version++;
			e.revisions++;
			return withRev(e);
		}],
		["POST", /^\/content\/(\w+)\/(\w+)\/(publish|unpublish|schedule)$/, ([, type, key, verb], body) => {
			const e = entry(type, key);
			Object.assign(e, verb === "publish" ? { status: "published", revisions: e.revisions || 1 } : verb === "unpublish" ? { status: "draft" } : { status: "scheduled", scheduledAt: body.scheduledAt });
			e.version++;
			return withRev(e);
		}],
		["GET", /^\/content\/(\w+)\/(\w+)\/revisions$/, ([, type, key]) => yes({ items: [], total: entry(type, key).revisions })],
		["GET", /^\/content\/(\w+)\/(\w+)\/terms\/(\w+)$/, ([, type, key, name]) => yes({ terms: entry(type, key).taxonomies[name] ?? [] })],
		["POST", /^\/content\/(\w+)\/(\w+)\/preview-url$/, ([, type, key]) => yes({ url: `/${type}/${entry(type, key).slug}?_preview=${SIGNATURE}` })],
		["GET", /^\/menus\/([\w-]+)$/, ([, name]) => (by(has.menus, "name", name) ? yes(by(has.menus, "name", name)) : gone(`Menu '${name}'`))],
		["POST", /^\/menus$/, (_, body) => yes({ name: keep(has.menus, { ...body, items: [] }).name }, 201)],
		["POST", /^\/menus\/([\w-]+)\/items$/, ([, name], body) => yes(keep(by(has.menus, "name", name).items, body), 201)],
		["GET", /^\/widget-areas\/([\w-]+)$/, ([, name]) => (by(has.areas, "name", name) ? yes(by(has.areas, "name", name)) : gone(`Widget area "${name}"`))],
		["POST", /^\/widget-areas$/, (_, body) => yes({ name: keep(has.areas, { ...body, widgets: [] }).name }, 201)],
		["POST", /^\/widget-areas\/([\w-]+)\/widgets$/, ([, name], body) => yes(keep(by(has.areas, "name", name).widgets, body), 201)],
		["GET", /^\/sections\/([\w-]+)$/, ([, slug]) => (by(has.sections, "slug", slug) ? yes(by(has.sections, "slug", slug)) : gone(`Section "${slug}"`))],
		["POST", /^\/sections$/, (_, body) => yes(keep(has.sections, body), 201)],
		["PUT", /^\/schema\/collections\/posts$/, (_, body) => yes({ item: { commentsEnabled: (commentsOn = body.commentsEnabled) } })],
		["GET", /^\/comments\/posts\/(\w+)$/, ([, id]) => (commentsOn ? yes({ items: has.comments.filter((c) => c.on === id) }) : no(403, "COMMENTS_DISABLED", "Comments are not enabled for this collection")), true],
		["POST", /^\/comments\/posts\/(\w+)$/, ([, id], body) => (commentsOn ? yes({ id: keep(has.comments, { on: id, parentId: null, ...body }).id, status: "approved" }, 201) : no(403, "COMMENTS_DISABLED", "Comments are not enabled for this collection")), true],
		["GET", /^\/redirects$/, () => yes({ items: has.redirects })],
		["POST", /^\/redirects$/, (_, body) => yes(keep(has.redirects, body), 201)],
		["GET", /^\/search$/, (_, __, query) => yes({ items: has.entries.filter((e) => e.status === "published" && e.data.title.toLowerCase().includes(query.get("q"))).map((e) => ({ slug: e.slug, title: e.data.title })) }), true],
		["GET", /^\/admin\/api-tokens$/, () => yes({ items: has.tokens })],
		["POST", /^\/admin\/api-tokens$/, (_, body) => yes({ token: SHOWN_ONCE, info: keep(has.tokens, body) }, 201)],
		["GET", /^\/settings\/backups$/, () => yes({ settings: backups, archives: has.archives, storageAvailable: true })],
		["PUT", /^\/settings\/backups$/, (_, body) => yes(Object.assign(backups, body))],
		["POST", /^\/settings\/backups\/archives$/, () => yes(keep(has.archives, { name: "emdash-backup.json" }), 201)],
	];

	const site = {
		has,
		asked,
		/** the requests it answers with a server error, while this is set @type {RegExp | null} */
		refuses: null,
		/** What it changed: every request but the reads — and but the asking for a preview link, which makes a signature and keeps nothing. */
		writes: () => asked.filter((a) => a.method !== "GET" && !a.path.endsWith("/preview-url")).map((a) => `${a.method} ${a.path.replace("/_emdash/api", "").replace(/\/ID\d+/g, "/{id}")}`),
		/** @param {string} url @param {RequestInit} [init] @returns {{ status: number, text?: string, headers?: Record<string, string> }} */
		answers: (url, init = {}) => {
			const { pathname, searchParams } = new URL(url);
			const method = init.method ?? "GET";
			const signed = /** @type {Record<string, string>} */ (init.headers ?? {}).Authorization === `Bearer ${TOKEN}`;
			asked.push({ method, path: pathname, signed });
			if (site.refuses?.test(`${method} ${pathname}`)) return no(500, "INTERNAL_ERROR", "the database is locked");
			if (pathname.startsWith("/_emdash/api/media/file/")) return { status: 200, text: "the picture", headers: { "content-type": "image/png" } };
			if (pathname.startsWith("/_emdash/api/")) {
				for (const [verb, path, answer, open] of api) {
					const at = verb === method ? path.exec(pathname.slice("/_emdash/api".length)) : null;
					if (!at) continue;
					if (!open && !signed) return no(401, "UNAUTHORIZED", "Authentication required");
					return answer(at, typeof init.body === "string" ? JSON.parse(init.body) : init.body, searchParams);
				}
				return { ...page("<title>Not Found</title>"), status: 404 }; // (what the real one answers a request it has no route for)
			}
			// the pages a visitor is served
			if (pathname === "/") return page(`<title>${settings.title}</title><nav>${by(has.menus, "name", "primary").items.map((/** @type {any} */ i) => `<a>${i.label}</a>`).join("")}</nav>`);
			const post = entry("posts", /^\/posts\/([\w-]+)$/.exec(pathname)?.[1] ?? "");
			if (post) return post.status === "published" || searchParams.get("_preview") === SIGNATURE ? page(`<h1>${post.data.title}</h1>`) : { status: 302, headers: { location: "/404" } };
			const sent = by(has.redirects, "source", pathname);
			return sent ? { status: sent.type, headers: { location: sent.destination } } : { status: 404 };
		},
	};
	return site;
};

// site:demo by itself: that this machine is signed in to a built site that is running is the
// graph's work, and has its own tests (signin.test.mjs). Here it is so: the token is saved.
const alone = { ...demo, "signin:token": { work: () => {} } };
const saved = { [`/config/emdash-run/tokens/${savedName("http://localhost:4322", "/p/site")}.json`]: JSON.stringify({ url: "http://localhost:4322", token: TOKEN }) };
/** @param {ReturnType<typeof emdash>} site */
const run = async (site) => {
	const fake = fakeWorld({ files: { ...saved }, answers: site.answers });
	const failed = await reach(alone, "site:demo", { world: fake.world, project, flags: {} }).then(() => "", (e) => String(e.message));
	// (what the task said: not the graph's own line of how long each state took)
	return { said: fake.said.filter((l) => !l.startsWith("done in ")), failed };
};

// What making each feature asks of an empty site, in order.
/** @type {[string, string[]][]} */
const MAKES = [
	["settings", ["POST /settings"]],
	["taxonomy terms", ["POST /taxonomies/category/terms", "POST /taxonomies/tag/terms"]],
	["media", ["POST /media", "PUT /media/{id}"]],
	["byline", ["POST /admin/bylines"]],
	["published post", ["POST /content/posts", "POST /content/posts/{id}/publish"]],
	["draft with a preview link", ["POST /content/posts"]],
	["revisions", ["PUT /content/posts/{id}", "PUT /content/posts/{id}", "POST /content/posts/{id}/publish"]],
	["scheduled post", ["POST /content/posts", "POST /content/posts/{id}/schedule"]],
	["menus", ["POST /content/pages", "POST /content/pages/{id}/publish", "POST /menus/primary/items", "POST /menus", "POST /menus/footer/items"]],
	["widgets", ["POST /widget-areas/sidebar/widgets", "POST /widget-areas", "POST /widget-areas/footer/widgets"]],
	["section", ["POST /sections"]],
	["comments", ["PUT /schema/collections/posts", "POST /comments/posts/{id}", "POST /comments/posts/{id}"]],
	["redirect", ["POST /redirects"]],
	["search", []], // EmDash's own doing: nothing is asked for
	["API token", ["POST /admin/api-tokens"]],
	["backup", ["PUT /settings/backups", "POST /settings/backups/archives"]],
];

test("it stands on this machine being signed in to the built site, running", () => {
	assert.deepEqual(plan(graph, "site:demo").slice(-3), ["site:built-running", "signin:token", "site:demo"]);
});

test("an empty site: each feature is made, in order, and each line says what shows it works", async () => {
	const site = emdash();
	const { said, failed } = await run(site);
	assert.equal(failed, "");
	assert.deepEqual(features.map((f) => f.name), MAKES.map(([name]) => name));
	assert.deepEqual(site.writes(), MAKES.flatMap(([, writes]) => writes));
	assert.equal(said[0], "-> this machine, built site (site:preview): http://localhost:4322");
	assert.deepEqual(said.slice(1, -1).map((l) => l.split(" — ")[0]), MAKES.map(([name]) => `ok   ${name}: ${name === "search" ? "nothing to make" : "made"}`));
	assert.equal(said.at(-1), "16 features: 15 made, 0 already there, 1 with nothing to make");
	assert.ok(said.includes(`ok   redirect: made — /hello sends a visitor on, with a 301, to /posts/kitchen-sink`));

	// what is on the site now
	assert.deepEqual(site.has.entries.map((e) => `${e.type}/${e.slug} ${e.status}`), ["posts/kitchen-sink published", "posts/work-in-progress draft", "posts/coming-soon scheduled", "pages/contact published"]);
	const [post, , later] = site.has.entries;
	assert.equal(post.data.featured_image.id, site.has.media[0].id);
	assert.deepEqual([post.taxonomies, post.bylines], [{ category: ["tutorials"], tag: ["demo"] }, [{ bylineId: site.has.bylines[0].id }]]);
	assert.equal(post.data.content[1].markDefs[0].href, "https://emdashcms.com", "the body is Portable Text, a link in it");
	assert.ok(Date.parse(later.scheduledAt) > Date.now(), "scheduled for a day to come");
	assert.deepEqual(site.has.media[0], { ...site.has.media[0], filename: "emdash-demo.png", mimeType: "image/png", width: 480, height: 270, focalX: 0.5, focalY: 0.3 });
	assert.equal(site.has.comments[1].parentId, site.has.comments[0].id, "the second comment answers the first");
	assert.deepEqual(site.has.tokens[0].scopes, ["content:read", "media:read"]);

	// a comment is sent as a visitor sends one, and no token or preview link is ever printed
	const sent = site.asked.filter((a) => a.method === "POST" && a.path.includes("/comments/"));
	assert.deepEqual(sent.map((a) => a.signed), [false, false]);
	assert.doesNotMatch(said.join("\n"), /ec_pat_|_preview=/);
});

test("run again: everything is already there, and nothing is made", async () => {
	const site = emdash();
	await run(site);
	const before = site.writes().length;
	const { said, failed } = await run(site);
	assert.equal(failed, "");
	assert.deepEqual(site.writes().slice(before), []);
	assert.deepEqual(said.slice(1, -1).map((l) => l.split(" — ")[0]), MAKES.map(([name]) => `ok   ${name}: ${name === "search" ? "nothing to make" : "already there"}`));
	assert.equal(said.at(-1), "16 features: 0 made, 15 already there, 1 with nothing to make");
});

test("a request the site refuses: that feature is a FAIL line with what the site said, the others go on, and the task fails", async () => {
	const site = emdash();
	site.refuses = /^POST \/_emdash\/api\/redirects$/;
	const { said, failed } = await run(site);
	assert.ok(said.includes("FAIL redirect: POST /_emdash/api/redirects answered 500 INTERNAL_ERROR the database is locked"));
	assert.equal(said.filter((l) => l.startsWith("ok   ")).length, 15);
	assert.equal(said.at(-1), "16 features: 14 made, 0 already there, 1 with nothing to make, 1 FAILED");
	assert.match(failed, /^site:demo: 1 of 16 features could not be made or shown to work/);
});

test("a run that stopped half way is picked up: what was made is not made again", async () => {
	const site = emdash();
	// nothing can be published: the post, the edits of it, the page for the menu — and search finds no post
	site.refuses = /\/publish$/;
	const first = await run(site);
	assert.deepEqual(first.said.filter((l) => l.startsWith("FAIL")).map((l) => l.split(":")[0]), ["FAIL published post", "FAIL revisions", "FAIL menus", "FAIL search"]);
	assert.match(first.said.join("\n"), /FAIL search: a visitor's search for "kitchen" found 0 entries, and kitchen-sink is not one/);
	site.refuses = null;
	const before = site.writes().length;
	const second = await run(site);
	assert.equal(second.failed, "");
	// only what was missing: the post published, the page published and put in its menus
	assert.deepEqual(site.writes().slice(before), ["POST /content/posts/{id}/publish", "POST /content/pages/{id}/publish", "POST /menus/primary/items", "POST /menus", "POST /menus/footer/items"]);
	assert.equal(second.said.at(-1), "16 features: 2 made, 13 already there, 1 with nothing to make");
	assert.deepEqual([site.has.entries.length, site.has.media.length, site.has.comments.length], [4, 1, 2]);
});

test("the picture is a PNG of the size asked for", () => {
	const png = picture(3, 2);
	assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
	assert.deepEqual([png.subarray(12, 16).toString(), png.readUInt32BE(16), png.readUInt32BE(20)], ["IHDR", 3, 2]);
	assert.equal(png.subarray(-8, -4).toString(), "IEND");
});
