// site:demo (scripts/core/demo.mjs), on a made-up EmDash: its seed file applied, then what a seed
// file cannot say, made in order; that a second run asks for nothing more; and what it says when
// the site refuses, or a photograph cannot be fetched.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { graph } from "../../scripts/core/cli.mjs";
import { demo, features, icon, parts } from "../../scripts/core/demo.mjs";
import { plan, reach } from "../../scripts/core/graph.mjs";
import { strangers } from "../../scripts/core/seed.mjs";
import { savedName } from "../../scripts/core/signin.mjs";
import { TOKEN, emdash } from "./fake-emdash.mjs";
import { fakeWorld, project } from "./fake-world.mjs";
import { site } from "../../scripts/core/site.mjs";

// The demo's seed file as it ships, where the task looks for it: beside emdash-run's scripts.
const shipped = readFileSync(new URL("../../seeds/demo.json", import.meta.url), "utf8");
// site:demo by itself: that this machine is signed in to a built site that is running is the
// graph's work, and has its own tests (signin.test.mjs). Here it is so: the token is saved.
const alone = { ...demo, "site:local-only": site["site:local-only"], "signin:token": { work: () => {} } };
const files = { "/emdash-run/seeds/demo.json": shipped, [`/config/emdash-run/tokens/${savedName("http://localhost:4322", "/p/site")}.json`]: JSON.stringify({ url: "http://localhost:4322", token: TOKEN }) };
const photograph = () => ({ status: 200, type: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) });
/** @param {ReturnType<typeof emdash>} site @param {(url: string) => { status: number, type?: string, bytes?: Uint8Array<ArrayBuffer> }} [downloads] where its photographs come from: by default, they are fetched */
const run = async (site, downloads = photograph) => {
	const fake = fakeWorld({ files: { ...files }, answers: site.answers, packages: site.packages, downloads });
	const failed = await reach(alone, "site:demo", { world: fake.world, project, flags: {} }).then(() => "", (e) => String(e.message));
	// (what the task said: not the graph's own line of how long each state took)
	return { said: fake.said.filter((l) => !l.startsWith("done in ") && !l.startsWith("already so (")), failed, ran: fake.ran };
};

// What the seed file asks of a site just made from the starter template, section by section.
const SEEDED = [
	"POST /settings", "POST /settings", "POST /settings", "POST /settings",
	"PUT /schema/collections/posts",
	"POST /taxonomies/category/terms", "POST /taxonomies/category/terms", "POST /taxonomies/category/terms", "POST /taxonomies/tag/terms", "POST /taxonomies/tag/terms",
	"POST /admin/bylines", "POST /admin/bylines",
	"POST /content/pages", "POST /content/pages/{id}/publish", "POST /content/pages", "POST /content/pages/{id}/publish",
	// four posts, each with its photograph fetched and uploaded first
	"POST /media", "POST /content/posts", "POST /content/posts/{id}/publish",
	"POST /media", "POST /content/posts", "POST /content/posts/{id}/publish",
	"POST /media", "POST /content/posts", "POST /content/posts/{id}/publish",
	"POST /media", "POST /content/posts", "POST /content/posts/{id}/publish",
	// two drafts: one with no photograph, one with
	"POST /content/posts", "POST /media", "POST /content/posts",
	"POST /menus/primary/items", "POST /menus/primary/items", "POST /menus/primary/items", "POST /menus/primary/items", "POST /menus", "POST /menus/footer/items", "POST /menus/footer/items",
	"POST /redirects",
	"POST /widget-areas/sidebar/widgets", "POST /widget-areas/sidebar/widgets", "POST /widget-areas/sidebar/widgets", "POST /widget-areas/sidebar/widgets", "POST /widget-areas", "POST /widget-areas/footer/widgets",
	"POST /sections",
];
// Then what making each feature of the list in code asks, in order.
/** @type {[string, string[]][]} */
const MAKES = [
	["search engines", ["PUT /content/posts/{id}"]],
	["revisions", ["PUT /content/posts/{id}", "PUT /content/posts/{id}", "POST /content/posts/{id}/publish"]],
	["scheduled post", ["POST /content/posts/{id}/schedule"]],
	["comments", ["PUT /schema/collections/posts", "POST /comments/posts/{id}", "POST /comments/posts/{id}"]],
	["preview link", []], // (these three only show what is there)
	["site icon", ["POST /media", "PUT /media/{id}", "POST /settings"]],
	["shared links", ["POST /settings"]],
	["visitor's view", []],
	["search", []],
	["API token", ["POST /admin/api-tokens"]],
	["backup", ["PUT /settings/backups", "POST /settings/backups/archives"]],
];
const shows = ["preview link", "visitor's view", "search"];
/** The lines of the list in code, each up to its proof. @param {string[]} said */
const lines = (said) => said.filter((l) => /^(ok {3}|FAIL )/.test(l) && features.some((f) => l.slice(5).startsWith(`${f.name}: `))).map((l) => l.split(" — ")[0]);

test("it stands on this machine being signed in to the built site, running", () => {
	assert.deepEqual(plan(graph, "site:demo").slice(-3), ["site:built-running", "signin:token", "site:demo"]);
	// asked for the deployed site it stops at the first state, before anything signs in to that site
	assert.equal(plan(graph, "site:demo", { live: true })[0], "site:local-only");
});

test("the seed file that ships is EmDash's seed format, has every section, and has what the list in code stands on", () => {
	const seed = JSON.parse(shipped);
	assert.equal(seed.$schema, "https://emdashcms.com/seed.schema.json");
	assert.deepEqual(strangers(seed), [], "no key site:seed would not apply");
	assert.doesNotMatch(shipped, /translationOf|"avatar"|"blockTypes"/, "nothing site:seed would skip");
	for (const section of ["settings", "collections", "taxonomies", "bylines", "content", "menus", "redirects", "widgetAreas", "sections"]) assert.ok(Object.keys(seed[section]).length > 0, section);
	assert.deepEqual(Object.keys(seed.settings), ["title", "tagline", "social", "seo"], "the settings a seed file can carry: a logo and an icon it can only name by an id the site gives");
	const { lead, draft, later, redirect, linked } = parts(seed);
	assert.deepEqual([lead?.slug, draft?.slug, later?.slug, redirect?.destination, linked], ["sketch-it-on-paper-first", "notes-for-the-next-redesign", "what-we-are-reading", "/posts/sketch-it-on-paper-first", "Contact"]);
	// every post a visitor can come to see has a photograph, by its address, with alt text — and reads like a post
	const seen = seed.content.posts.filter((/** @type {any} */ e) => e.status === "published" || e === later);
	assert.equal(seen.length, 5);
	for (const post of seen) {
		assert.match(post.data.featured_image.$media.url, /^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?w=1200&h=800&fit=crop$/, post.slug);
		assert.ok(post.data.featured_image.$media.alt.length > 20 && post.data.excerpt.length > 50 && post.data.content.length >= 6, post.slug);
	}
	assert.equal(new Set(seen.map((/** @type {any} */ p) => p.data.featured_image.$media.url)).size, 5, "no photograph twice");
	assert.match(String(lead?.data.excerpt), /\. \S.*\.$/, "the lead post's excerpt has two sentences: an edit takes the last away, and the next puts it back");
});

test("a site just made: the seed file is applied, then each feature a seed cannot say is made, in order", async () => {
	const site = emdash();
	const { said, failed, ran } = await run(site);
	assert.equal(failed, "");
	assert.deepEqual([site.checked, ran], [[JSON.parse(shipped)], []], "EmDash's own check — the site's — is given the seed file; no program is started");
	assert.deepEqual(features.map((f) => f.name), MAKES.map(([name]) => name));
	assert.deepEqual(site.writes(), [...SEEDED, ...MAKES.flatMap(([, writes]) => writes)]);
	assert.equal(said[0], "-> this machine, built site (site:preview): http://localhost:4322");
	assert.ok(said.includes("ok   settings: 4 made (title, tagline, social, seo)"), "the demo's settings replace the site's own");
	assert.ok(said.includes("ok   content: 8 made (pages/about, pages/contact, posts/leave-it-overnight, posts/a-small-set-of-parts, posts/measure-twice-publish-once, posts/sketch-it-on-paper-first, posts/notes-for-the-next-redesign, posts/what-we-are-reading)"));
	assert.deepEqual(lines(said), MAKES.map(([name]) => `ok   ${name}: ${shows.includes(name) ? "nothing to make" : "made"}`));
	assert.ok(said.includes('ok   visitor\'s view: nothing to make — the front page is titled "EmDash Demo" and its menu shows Contact; /posts/sketch-it-on-paper-first answers 200 with its title and its photograph; /hello sends on, with a 301, to /posts/sketch-it-on-paper-first; /robots.txt is the file\'s'));
	assert.deepEqual(said.slice(-2), ["the seed file, applied: 35 made, 12 already there", "what a seed file cannot say, 11 features: 8 made, 0 already there, 3 with nothing to make"]);

	// what is on the site now
	const { has } = site;
	const asShipped = JSON.parse(shipped);
	assert.deepEqual(has.entries.map((e) => `${e.type}/${e.slug} ${e.status}`), ["pages/about published", "pages/contact published", "posts/leave-it-overnight published", "posts/a-small-set-of-parts published", "posts/measure-twice-publish-once published", "posts/sketch-it-on-paper-first published", "posts/notes-for-the-next-redesign draft", "posts/what-we-are-reading scheduled"]);
	const [, , guest, , , lead, , later] = has.entries;
	// each post a visitor can see has its own photograph; the one picture made here is the site's icon, and on no post
	assert.deepEqual(has.media.map((m) => m.filename), ["leave-it-overnight.jpg", "a-small-set-of-parts.jpg", "measure-twice-publish-once.jpg", "sketch-it-on-paper-first.jpg", "what-we-are-reading.jpg", "site-icon.png"]);
	assert.deepEqual([...has.entries.slice(2, 6), later].map((e) => e.data.featured_image.id), has.media.slice(0, 5).map((m) => m.id));
	const [mark] = has.media.slice(-1);
	assert.deepEqual([mark.focalX, mark.focalY, !!mark.alt, !!mark.caption], [0.5, 0.5, true, true]);
	assert.deepEqual(site.settings, { ...asShipped.settings, favicon: { mediaId: mark.id, alt: mark.alt }, seo: { ...asShipped.settings.seo, defaultOgImage: { mediaId: has.media[3].id, alt: has.media[3].alt } } }, "the file's settings — and the icon, and the picture for shared links: the newest post's photograph");
	assert.deepEqual([lead.taxonomies, lead.bylines, lead.revisions], [{ category: ["tutorials"], tag: ["process", "tools"] }, [{ bylineId: has.bylines[0].id }], 3]);
	assert.deepEqual(guest.bylines, [{ bylineId: has.bylines[1].id, roleLabel: "Guest note" }]);
	assert.equal(has.terms.find((t) => t.slug === "checklists").parentId, has.terms.find((t) => t.slug === "tutorials").id, "a category under another");
	const written = parts(asShipped).lead?.data ?? {};
	assert.deepEqual([lead.data.excerpt, lead.seo], [written.excerpt, { title: written.title, description: written.excerpt }], "after its two edits the post reads as the seed file has it; search engines read its own title and excerpt");
	assert.ok(Date.parse(later.scheduledAt) > Date.now(), "scheduled for a day to come");
	assert.deepEqual([has.collections[0].commentsEnabled, has.collections[0].commentsModeration], [true, "none"]);
	assert.equal(has.comments[1].parentId, has.comments[0].id, "the second comment answers the first");
	assert.deepEqual(has.tokens[0].scopes, ["content:read", "media:read"]);
	assert.deepEqual(has.menus[0].items.map((/** @type {any} */ i) => [i.label, i.referenceId]), [["Home", null], ["About", has.entries[0].id], ["Posts", null], ["Contact", has.entries[1].id]], "About and Contact in the menu are the pages");

	// a comment is sent as a visitor sends one, and no token or preview link is ever printed
	assert.deepEqual(site.asked.filter((a) => a.method === "POST" && a.path.includes("/comments/")).map((a) => a.signed), [false, false]);
	assert.doesNotMatch(said.join("\n"), /ec_pat_|_preview=/);
});

test("run again: everything is already there, and nothing is made or fetched", async () => {
	const site = emdash();
	await run(site);
	const before = site.writes().length;
	const { said, failed } = await run(site, () => {
		throw new Error("a photograph was fetched again");
	});
	assert.equal(failed, "");
	assert.deepEqual(site.writes().slice(before), []);
	assert.deepEqual(lines(said), MAKES.map(([name]) => `ok   ${name}: ${shows.includes(name) ? "nothing to make" : "already there"}`));
	assert.deepEqual(said.slice(-2), ["the seed file, applied: 0 made, 47 already there", "what a seed file cannot say, 11 features: 0 made, 8 already there, 3 with nothing to make"]);
});

test("a request the site refuses: that feature is a FAIL line with what the site said, the others go on, and the task fails", async () => {
	const site = emdash();
	site.refuses = /^POST \/_emdash\/api\/admin\/api-tokens$/;
	const { said, failed } = await run(site);
	assert.ok(said.includes("FAIL API token: POST /_emdash/api/admin/api-tokens answered 500 INTERNAL_ERROR the database is locked"));
	assert.equal(lines(said).filter((l) => l.startsWith("ok   ")).length, 10);
	assert.equal(said.at(-1), "what a seed file cannot say, 11 features: 7 made, 0 already there, 3 with nothing to make, 1 FAILED");
	assert.match(failed, /^site:demo: 1 thing could not be made or shown to work/);
});

test("no photograph can be fetched: the posts are made without them and the lines say so; the next run fetches them, and makes nothing twice", async () => {
	const site = emdash();
	const first = await run(site, () => ({ status: 0 }));
	assert.match(first.said.join("\n"), /FAIL content: 3 made \(pages\/about, pages\/contact, posts\/notes-for-the-next-redesign\), 5 not done — posts\/leave-it-overnight: it is there, without a picture that could not be fetched \(featured_image: GET https:\/\/images\.unsplash\.com\/photo-\S+ answered nothing\)\. Run again to fetch it; /);
	// what stands on a post still finds it; only the photograph is missed
	assert.deepEqual(lines(first.said).filter((l) => l.startsWith("FAIL")), ["FAIL shared links: sketch-it-on-paper-first has no photograph to use: the seed file's content line above says why", "FAIL visitor's view: sketch-it-on-paper-first has no photograph: the seed file's content line above says why"]);
	assert.match(first.failed, /^site:demo: 7 things could not be made or shown to work/);
	const second = await run(site);
	assert.equal(second.failed, "");
	assert.ok(second.said.includes("ok   content: 5 made (posts/leave-it-overnight, posts/a-small-set-of-parts, posts/measure-twice-publish-once, posts/sketch-it-on-paper-first, posts/what-we-are-reading), 3 already there (pages/about, pages/contact, posts/notes-for-the-next-redesign)"));
	assert.deepEqual([site.has.entries.length, site.has.media.length, site.has.comments.length], [8, 6, 2]);
	assert.deepEqual(site.has.entries.slice(2).map((e) => [e.status, !!e.data.featured_image?.id]), [["published", true], ["published", true], ["published", true], ["published", true], ["draft", false], ["scheduled", true]]);
});

test("the site's icon, made here, is a PNG: a square with a dash across its middle", () => {
	const png = icon();
	assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
	assert.deepEqual([png.subarray(12, 16).toString(), png.readUInt32BE(16), png.readUInt32BE(20)], ["IHDR", 192, 192]);
	assert.equal(png.subarray(-8, -4).toString(), "IEND");
});
