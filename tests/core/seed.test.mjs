// site:seed (scripts/core/seed.mjs), on a made-up EmDash: which file it applies, what it asks of the
// site for each section and in what order, that a second run asks for nothing more, what it says
// when the site refuses, and that what it does not apply is said.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { graph } from "../../scripts/core/cli.mjs";
import { plan, reach } from "../../scripts/core/graph.mjs";
import { seed, strangers } from "../../scripts/core/seed.mjs";
import { savedName } from "../../scripts/core/signin.mjs";
import { TOKEN, emdash } from "./fake-emdash.mjs";
import { fakeWorld, project } from "./fake-world.mjs";
import { site } from "../../scripts/core/site.mjs";

// site:seed by itself: that this machine is signed in to a built site that is running is the
// graph's work, and has its own tests (signin.test.mjs). Here it is so: the token is saved.
const alone = { ...seed, "site:local-only": site["site:local-only"], "signin:token": { work: () => {} } };
const saved = { [`/config/emdash-run/tokens/${savedName("http://localhost:4322", "/p/site")}.json`]: JSON.stringify({ url: "http://localhost:4322", token: TOKEN }) };
/** A seed file where a site has its own. @param {unknown} content */
const own = (content) => ({ "/p/site/seed/seed.json": JSON.stringify(content) });
/** @param {ReturnType<typeof emdash>} site @param {Record<string, string>} files @param {{ args?: string[], downloads?: (url: string) => { status: number, type?: string, bytes?: Uint8Array<ArrayBuffer> } }} [more] */
const run = async (site, files, more = {}) => {
	const fake = fakeWorld({ files: { ...saved, ...files }, answers: site.answers, packages: site.packages, downloads: more.downloads });
	const failed = await reach(alone, "site:seed", { world: fake.world, project, flags: {}, args: more.args ?? [] }).then(() => "", (e) => String(e.message));
	// (what the task said: not the graph's own line of how long each state took)
	return { said: fake.said.filter((l) => !l.startsWith("done in ") && !l.startsWith("already so (")), failed, ran: fake.ran };
};

// A seed with something in every section site:seed applies, for a site that has posts, pages, a
// primary menu and a sidebar: some of it is there, some is not.
const FULL = {
	$schema: "https://emdashcms.com/seed.schema.json",
	version: "1",
	settings: { title: "From the file", timezone: "Europe/Paris" },
	collections: [
		{ slug: "posts", label: "Posts", commentsEnabled: true, fields: [{ slug: "title", label: "Title", type: "string" }, { slug: "subtitle", label: "Subtitle", type: "string" }] },
		{ slug: "books", label: "Books", fields: [{ slug: "title", label: "Title", type: "string" }, { slug: "sequel", label: "Sequel", type: "reference", validation: { relation: "sequels", relationSide: "parent" } }] },
	],
	relations: [{ slug: "sequels", parentCollection: "books", childCollection: "books", parentLabel: "Books", childLabel: "Sequels" }],
	taxonomies: [
		// (a term under another, named before it)
		{ name: "category", label: "Categories", hierarchical: true, collections: ["posts"], terms: [{ slug: "how-to", label: "How-to", parent: "guides" }, { slug: "guides", label: "Guides" }] },
		{ name: "mood", label: "Moods", hierarchical: false, collections: ["posts"] },
	],
	bylines: [{ id: "b1", slug: "ann", displayName: "Ann" }],
	content: {
		books: [{ id: "book-1", slug: "one", data: { title: "One" } }, { id: "book-2", slug: "two", status: "draft", data: { title: "Two", sequel: "$ref:book-1" } }],
		posts: [{ id: "p1", slug: "hello", data: { title: "Hello" }, taxonomies: { category: ["how-to"] }, bylines: [{ byline: "b1", roleLabel: "Words" }] }],
	},
	menus: [{ name: "primary", label: "Primary", items: [{ type: "custom", label: "Home", url: "/", children: [{ type: "post", label: "Hello", ref: "p1" }] }] }],
	redirects: [{ source: "/old", destination: "/posts/hello", type: 301 }],
	widgetAreas: [{ name: "sidebar", label: "Sidebar", widgets: [{ type: "component", componentId: "core:tags", title: "Tags", props: { count: 3 } }] }],
	sections: [{ slug: "cta", title: "Call", content: [] }],
};

test("it stands on this machine being signed in to the built site, running", () => {
	assert.deepEqual(plan(graph, "site:seed").slice(-3), ["site:built-running", "signin:token", "site:seed"]);
	// asked for the deployed site it stops at the first state, before anything signs in to that site
	assert.equal(plan(graph, "site:seed", { live: true })[0], "site:local-only");
});

test("each section is applied, in EmDash's order: what is not there is made, what is there is left alone", async () => {
	const site = emdash();
	const { said, failed, ran } = await run(site, own(FULL));
	assert.equal(failed, "");
	// EmDash's own check — the site's — is given the file as it is; no program is started
	assert.deepEqual([site.checked, ran], [[FULL], []]);
	assert.deepEqual(site.writes(), [
		"POST /settings",
		"PUT /schema/collections/posts",
		"POST /schema/collections",
		"POST /relations",
		"POST /schema/collections/posts/fields",
		"POST /schema/collections/books/fields",
		"POST /schema/collections/books/fields",
		"POST /taxonomies/category/terms",
		"POST /taxonomies/category/terms",
		"POST /taxonomies",
		"POST /admin/bylines",
		"POST /content/books",
		"POST /content/books/{id}/publish",
		"POST /content/books",
		"POST /content/posts",
		"POST /content/posts/{id}/publish",
		"POST /menus/primary/items",
		"POST /menus/primary/items",
		"POST /redirects",
		"POST /widget-areas/sidebar/widgets",
		"POST /sections",
	]);
	assert.deepEqual(said, [
		"-> this machine, built site (site:preview): http://localhost:4322",
		`the seed file: ${join("/p/site", "seed", "seed.json")}`,
		"ok   settings: 1 made (timezone), 1 already there (title (the site has its own: left as it is))",
		"ok   collections: 2 made (posts: comments on, books), 1 already there (posts)",
		"ok   relations: 1 made (sequels)",
		"ok   fields: 3 made (posts.subtitle, books.title, books.sequel), 1 already there (posts.title)",
		"ok   taxonomies: 3 made (category/guides, category/how-to, mood), 1 already there (category)",
		"ok   bylines: 1 made (ann)",
		"ok   content: 3 made (books/one, books/two, posts/hello)",
		"ok   menus: 2 made (primary/Home, primary/Hello), 1 already there (primary)",
		"ok   redirects: 1 made (/old)",
		"ok   widgetAreas: 1 made (sidebar/Tags), 1 already there (sidebar)",
		"ok   sections: 1 made (cta)",
		"the seed file, applied: 19 made, 6 already there",
	]);

	// what the file names by its own ids and slugs, the site was given by the site's
	const { has } = site;
	const [one, two, hello] = has.entries;
	assert.deepEqual([site.settings.title, site.settings.timezone], ["My Site", "Europe/Paris"], "a setting the site has is left; one it has not is written");
	assert.equal(has.collections[0].commentsEnabled, true);
	assert.equal(has.terms.find((t) => t.slug === "how-to").parentId, has.terms.find((t) => t.slug === "guides").id, "a term's parent, by id");
	assert.deepEqual([one.status, two.status, hello.status], ["published", "draft", "published"], "published unless the file says draft");
	assert.deepEqual([two.data, two.references], [{ title: "Two" }, { sequel: [one.id] }], "a reference bound to a relation goes beside the data, as the entry's id");
	assert.deepEqual([hello.taxonomies, hello.bylines], [{ category: ["how-to"] }, [{ bylineId: has.bylines[0].id, roleLabel: "Words" }]]);
	const [home, under] = has.menus[0].items;
	assert.deepEqual([under.parentId, under.referenceCollection, under.referenceId], [home.id, "posts", hello.id], "an item under another, that is an entry");
	assert.deepEqual(has.areas[0].widgets[0].componentProps, { count: 3 });
});

test("run again: everything is already there, and nothing is made", async () => {
	const site = emdash();
	await run(site, own(FULL));
	const before = site.writes().length;
	const { said, failed } = await run(site, own(FULL));
	assert.equal(failed, "");
	assert.deepEqual(site.writes().slice(before), []);
	assert.ok(said.slice(2, -1).every((l) => /^ok {3}\w+: \d+ already there \(/.test(l)), said.join("\n"));
	assert.equal(said.at(-1), "the seed file, applied: 0 made, 25 already there");
});

test("a request the site refuses: a FAIL line with what the site said, what stands on it says so, the rest goes on, and the task fails", async () => {
	const site = emdash();
	site.refuses = /^POST \/_emdash\/api\/admin\/bylines$/;
	const { said, failed } = await run(site, own(FULL));
	assert.ok(said.includes("FAIL bylines: 1 not done — ann: POST /_emdash/api/admin/bylines answered 500 INTERNAL_ERROR the database is locked"));
	assert.ok(said.includes("FAIL content: 2 made (books/one, books/two), 1 not done — posts/hello: it is credited to the byline b1, which is not there"));
	assert.ok(said.includes("FAIL menus: 1 made (primary/Home), 1 already there (primary), 1 not done — primary/Hello: it is the entry p1, which is not there: the file's content does not have it, or it could not be made"));
	assert.ok(said.includes("ok   sections: 1 made (cta)"));
	assert.equal(said.at(-1), "the seed file, applied: 16 made, 6 already there, 3 FAILED");
	assert.match(failed, /^site:seed: 3 of the things in the seed file could not be done/);

	// put right, a second run makes what is missing and nothing else
	site.refuses = null;
	const before = site.writes().length;
	assert.equal((await run(site, own(FULL))).failed, "");
	assert.deepEqual(site.writes().slice(before), ["POST /admin/bylines", "POST /content/posts", "POST /content/posts/{id}/publish", "POST /menus/primary/items"]);
});

test("an entry that was made and could not be published is published by the next run, and not made again", async () => {
	const site = emdash();
	const file = own({ version: "1", content: { posts: [{ id: "p1", slug: "hello", data: { title: "Hello" } }] } });
	site.refuses = /\/publish$/;
	assert.match((await run(site, file)).said.join("\n"), /FAIL content: 1 not done — posts\/hello: POST \/_emdash\/api\/content\/posts\/ID\d+\/publish answered 500/);
	site.refuses = null;
	const before = site.writes().length;
	assert.equal((await run(site, file)).failed, "");
	assert.deepEqual(site.writes().slice(before), ["POST /content/posts/{id}/publish"]);
	assert.deepEqual(site.has.entries.map((e) => e.status), ["published"]);
});

test("a picture the file names by its address is fetched once, uploaded with its alt text, and put on its entry", async () => {
	const site = emdash();
	const photo = { $media: { url: "https://pictures.example/photo-1?w=1200", alt: "A desk", filename: "desk.jpg" } };
	const file = own({ version: "1", content: { posts: [{ id: "a", slug: "first", data: { title: "First", featured_image: photo } }, { id: "b", slug: "second", data: { title: "Second", featured_image: photo } }] } });
	/** @type {string[]} */
	const fetched = [];
	const downloads = (/** @type {string} */ url) => (fetched.push(url), { status: 200, type: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) });
	const { said, failed } = await run(site, file, { downloads });
	assert.equal(failed, "");
	assert.deepEqual(fetched, ["https://pictures.example/photo-1?w=1200"], "once: the second entry finds it in the library");
	assert.deepEqual(site.writes(), ["POST /media", "POST /content/posts", "POST /content/posts/{id}/publish", "POST /content/posts", "POST /content/posts/{id}/publish"]);
	const [item] = site.has.media;
	assert.deepEqual([item.filename, item.mimeType, item.alt], ["desk.jpg", "image/jpeg", "A desk"]);
	assert.deepEqual(site.has.entries.map((e) => e.data.featured_image), Array(2).fill({ provider: "local", id: item.id, alt: "A desk", width: 1200, height: 800, filename: "desk.jpg", mimeType: "image/jpeg" }));
	assert.ok(said.includes("ok   content: 2 made (posts/first, posts/second)"));
	// run again: nothing fetched, nothing made
	await run(site, file, { downloads });
	assert.equal(fetched.length, 1);
});

test("a picture that cannot be fetched: the entry is made without it, the line says so, the task fails — and the next run fetches it", async () => {
	const site = emdash();
	const file = own({ version: "1", content: { posts: [{ id: "a", slug: "first", data: { title: "First", featured_image: { $media: { url: "https://pictures.example/gone", alt: "A desk", filename: "desk.jpg" } } } }] }, redirects: [{ source: "/a", destination: "/b" }] });
	const first = await run(site, file, { downloads: () => ({ status: 404 }) });
	assert.ok(first.said.includes("FAIL content: 1 not done — posts/first: it is there, without a picture that could not be fetched (featured_image: GET https://pictures.example/gone answered 404). Run again to fetch it"));
	assert.ok(first.said.includes("ok   redirects: 1 made (/a)"), "the rest still applies");
	assert.match(first.failed, /^site:seed: 1 of the things/);
	assert.deepEqual(site.has.entries.map((e) => [e.status, e.data.featured_image]), [["published", undefined]]);
	const before = site.writes().length;
	const second = await run(site, file, { downloads: () => ({ status: 200, type: "image/jpeg", bytes: new Uint8Array([1]) }) });
	assert.equal(second.failed, "");
	// the entry is given its picture by an edit, which is published: it is not made again
	assert.deepEqual(site.writes().slice(before), ["POST /media", "PUT /content/posts/{id}", "POST /content/posts/{id}/publish"]);
	assert.equal(site.has.entries[0].data.featured_image.id, site.has.media[0].id);
});

test("never a near copy of what is there: a menu item by its label or where it leads, a widget by its kind", async () => {
	const site = emdash();
	site.has.menus[0].items.push({ id: "M1", type: "custom", label: "About", customUrl: "/about", parentId: null }, { id: "M2", type: "custom", label: "Start", customUrl: "/", parentId: null });
	site.has.areas[0].widgets.push({ id: "W1", type: "component", componentId: "core:recent-posts", title: "Recent Posts" }, { id: "W2", type: "content", title: "About" });
	const { said, failed } = await run(site, own({
		version: "1",
		content: { pages: [{ id: "page-about", slug: "about", data: { title: "About" } }] },
		// About as a page, where the site has About as an address; Home, which the site calls Start
		menus: [{ name: "primary", label: "Primary", items: [{ type: "page", label: "About", ref: "page-about" }, { type: "custom", label: "Home", url: "/" }, { type: "custom", label: "Posts", url: "/posts" }] }],
		widgetAreas: [{ name: "sidebar", label: "Sidebar", widgets: [{ type: "component", componentId: "core:recent-posts", title: "Latest" }, { type: "content", title: "About", content: [] }, { type: "menu", menuName: "primary", title: "More" }] }],
	}));
	assert.equal(failed, "");
	assert.ok(said.includes("ok   menus: 1 made (primary/Posts), 3 already there (primary, primary/About, primary/Home)"));
	assert.ok(said.includes("ok   widgetAreas: 1 made (sidebar/More), 3 already there (sidebar, sidebar/Latest, sidebar/About)"));
	assert.deepEqual(site.has.menus[0].items.map((/** @type {any} */ i) => i.label), ["About", "Start", "Posts"]);
	assert.deepEqual(site.has.areas[0].widgets.map((/** @type {any} */ w) => w.title), ["Recent Posts", "About", "More"]);
});

test("what is not applied is said: a key that is not EmDash's seed format, and what site:seed cannot do yet", async () => {
	const site = emdash();
	const odd = {
		version: "1",
		plugins: ["not a section"],
		blockTypes: [{ slug: "hero", label: "Hero", currentVersion: 1, versions: [{ version: 1, fields: [] }] }],
		taxonomies: [{ name: "category", label: "Categories", terms: [{ slug: "nouvelles", label: "Nouvelles", locale: "fr", translationOf: "t-news" }] }],
		bylines: [{ id: "b", slug: "bo", displayName: "Bo", avatar: { storageKey: "bo.jpg" } }],
		content: {
			posts: [
				{ id: "p", slug: "pic", status: "draft", seo: { title: "For search engines" }, data: { title: "Pic", content: [{ _type: "block", _key: "a" }, { _type: "image", asset: { $media: { url: "https://pictures.example/b.jpg" } } }] } },
				{ id: "q", data: { title: "No slug" } },
			],
		},
		widgetAreas: [{ name: "sidebar", label: "Sidebar", widgets: [{ type: "component", componentId: "core:search", title: "Search", settings: { count: 5 } }] }],
	};
	assert.deepEqual(strangers(odd), ["plugins", "content.posts[0].seo"]);
	const { said, failed } = await run(site, own(odd));
	assert.equal(failed, "", "what is not applied is said, and does not fail the task");
	assert.deepEqual(said.filter((l) => l.startsWith("skip ")), [
		"skip plugins: not a part of EmDash's seed format (seed.schema.json): not applied",
		"skip content.posts[0].seo: not a part of EmDash's seed format (seed.schema.json): not applied",
		"skip blockTypes: 1 block types: not applied by site:seed yet (the file gives each as its versions; the API makes one from a single list of fields)",
		"skip taxonomies: category/nouvelles (fr): a translation of another (translationOf): not applied by site:seed yet",
		"skip bylines: the avatar of bo: a file already in the site's storage, which the API has no request to name: the byline is made without it",
		"skip content: posts/pic: 1 picture inside its fields (a block of a body): not applied by site:seed yet — the entry is made without it",
		"skip content: posts/q: an entry with no slug cannot be found again on the site: not applied by site:seed yet",
		'skip widgetAreas: the settings of sidebar/Search: EmDash does not apply them either: a widget\'s options belong in "props"',
	]);
	assert.equal(said.at(-1), "the seed file, applied: 3 made, 2 already there, 8 not applied (the skip lines)");
	// the entry is made without the block that holds a picture
	assert.deepEqual(site.has.entries[0].data, { title: "Pic", content: [{ _type: "block", _key: "a" }] });
	assert.equal(site.has.terms.length, 0);
});

test("the file: the site's own where EmDash looks for it, or the one given — a relative path is from the project's folder", async () => {
	const tiny = JSON.stringify({ version: "1", redirects: [{ source: "/a", destination: "/b" }] });
	// package.json names it
	const named = await run(emdash(), { "/p/site/package.json": '{"emdash":{"seed":"my/seed.json"}}', "/p/site/my/seed.json": tiny });
	assert.ok(named.said.includes(`the seed file: ${join("/p/site", "my/seed.json")}`));
	// given, relative
	const given = await run(emdash(), { ...own({ version: "1" }), "/p/seeds/mine.json": tiny }, { args: ["seeds/mine.json"] });
	assert.ok(given.said.includes(`the seed file: ${join("/p", "seeds/mine.json")}`));
	assert.ok(given.said.includes("ok   redirects: 1 made (/a)"));
	// none
	const none = await run(emdash(), {});
	assert.match(none.failed, /^There is no seed file at .*seed\.json\. Give one: mise run site:seed -- <file>/);
});

test("a file EmDash's own check refuses: its reasons are given, and nothing is asked of the site", async () => {
	const site = emdash();
	site.check = () => ({ valid: false, errors: ["menus[0]: label is required", "menus[0].items: must be an array"], warnings: [] });
	const { failed } = await run(site, own(FULL));
	assert.equal(failed, "EmDash's own check refuses this seed file, and nothing was applied:\n  menus[0]: label is required\n  menus[0].items: must be an array");
	assert.deepEqual(site.asked, []);
});

test("what EmDash's check warns of is said, and the file is applied", async () => {
	const site = emdash();
	site.check = () => ({ valid: true, errors: [], warnings: ['widgetAreas[0].widgets[2].settings: not applied; widget options belong in "props"'] });
	const { said, failed } = await run(site, own({ version: "1", redirects: [{ source: "/a", destination: "/b" }] }));
	assert.equal(failed, "");
	assert.deepEqual(said.slice(1, 4), [`the seed file: ${join("/p/site", "seed", "seed.json")}`, 'EmDash\'s check of the file warns: widgetAreas[0].widgets[2].settings: not applied; widget options belong in "props"', "ok   redirects: 1 made (/a)"]);
});

test("a file that is not JSON, and a site whose EmDash cannot be loaded: said, and nothing is asked", async () => {
	const site = emdash();
	assert.match((await run(site, { "/p/site/seed/seed.json": "{ not json" })).failed, /seed\.json is not JSON \(.*\)\. Nothing was applied\.$/);
	const bare = fakeWorld({ files: { ...saved, ...own(FULL) }, answers: site.answers });
	await assert.rejects(reach(alone, "site:seed", { world: bare.world, project, flags: {} }), /Cannot find package 'emdash\/client'/);
	assert.deepEqual(site.asked, []);
});
