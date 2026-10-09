// plugin:demo (scripts/core/plugin-demo.mjs): what it stands on, and its recipes on a made-up site —
// one makes its thing and proves it, run again makes nothing, and a refusal is a FAIL line with what
// the site said. And what a visitor is given: a form on a page and a post in French on a site that
// can show them, and a line that says why not on one that cannot.
import assert from "node:assert/strict";
import { test } from "node:test";

import { Exit } from "../../scripts/core/calls.mjs";
import { graph } from "../../scripts/core/cli.mjs";
import { plan, reach } from "../../scripts/core/graph.mjs";
import { demo, png, recipes } from "../../scripts/core/plugin-demo.mjs";
import { savedName } from "../../scripts/core/signin.mjs";
import { fakeWorld, project } from "./fake-world.mjs";

const only = (/** @type {RegExp} */ which) => recipes.filter((r) => which.test(r.plugin));
const two = only(/seo-suite|contact-forms/);
const token = `/config/emdash-run/tokens/${savedName("http://localhost:4322", project.site)}.json`;
const CANNOT_DRAW = "it is on no page, for this site cannot draw it: plugins: [ … ] of emdash({ … }) in its Astro config has no contactFormsEmbedPlugin(), of the package @masonjames/emdash-contact-forms";

/**
 * A made-up EmDash site with five of the plugins, as far as their recipes ask: SEO Suite, whose
 * settings show on the home page; Contact Forms and Forms, which keep forms and what visitors send
 * them; LinguaDash, which makes a French copy of an entry; Instant Indexer, which has a key. And
 * of EmDash itself what they use: entries, a menu, the media library, the manifest — and the pages
 * a visitor is given, drawn from what is in it. It keeps what it was asked, and what was made in it.
 *
 * draws: the site's config has the packages that draw the two forms plugins' blocks. french: French
 * is one of its languages. unavailable: its page says the form is unavailable (EmDash 1.2.0, to a
 * visitor). engine: the plugin a visitor's browser is told holds Forms' forms. key: what Instant
 * Indexer's key address answers. photo: false when the photograph's address does not answer. late:
 * how many times LinguaDash is asked before it has heard that a translation was published.
 * @param {{ plugins?: string[], refuses?: (asked: string) => boolean, organizationName?: string, draws?: boolean, french?: boolean, unavailable?: boolean, engine?: string, key?: string, photo?: boolean, late?: number }} [given]
 */
const aSite = (given = {}) => {
	const ids = /** @type {Record<string, string>} */ ({ "seo-suite": "r_seo", "contact-forms": "r_contact", forms: "r_forms", linguadash: "r_lingua", "instant-indexer": "r_indexer" });
	const made = {
		plugins: (given.plugins ?? Object.keys(ids)).map((slug) => ({ id: ids[slug], source: "registry", registrySlug: slug })),
		settings: /** @type {Record<string, string | null>} */ ({ organizationName: given.organizationName ?? null, twitterHandle: null }),
		forms: /** @type {{ id: string, slug: string }[]} */ ([]),
		messages: /** @type {string[]} */ ([]),
		feedback: /** @type {{ id: string, status: string, title: string, answers: any[] } | null} */ (null),
		translateInto: "",
		entries: /** @type {{ id: string, type: string, slug: string, status: string, locale: string, group: string, version: number, data: any }[]} */ ([]),
		menu: /** @type {{ referenceId: string, label: string }[] | null} */ (null),
		media: /** @type {{ id: string, filename: string, alt: string, width: number, height: number, mimeType: string }[]} */ ([]),
		downloaded: /** @type {string[]} */ ([]),
		asked: /** @type {string[]} */ ([]),
	};
	let late = given.late ?? 0;
	const yes = (/** @type {unknown} */ data, status = 200) => ({ status, text: JSON.stringify({ success: true, data }) });
	const no = (/** @type {number} */ status, /** @type {string} */ code, /** @type {string} */ message) => ({ status, text: JSON.stringify({ success: false, error: { code, message } }) });
	const shown = (/** @type {(typeof made.entries)[number]} */ e) => ({ item: { id: e.id, type: e.type, slug: e.slug, status: e.status, locale: e.locale, data: e.data }, _rev: `rev${e.version}` });
	const entry = (/** @type {string} */ type, /** @type {string} */ name) => made.entries.find((e) => e.type === type && (e.id === name || (e.slug === name && e.locale === "en")));
	// A page of the site as a visitor is given it: what is published, drawn the way the site draws it.
	const page = (/** @type {string} */ pathname) => {
		if (pathname === "/") {
			const { organizationName: name, twitterHandle: handle } = made.settings;
			return { status: 200, text: `<head>${handle ? `<meta name="twitter:site" content="@${handle}">` : ""}${name ? `<script type="application/ld+json">{"@type":"Organization","name":${JSON.stringify(name)}}</script>` : ""}</head>` };
		}
		const [, french, type, slug] = /^(\/fr)?\/(pages|posts)\/([^/]+)$/.exec(pathname) ?? [];
		const e = made.entries.find((x) => x.type === type && x.slug === slug && x.locale === (french ? "fr" : "en") && x.status === "published");
		if (!e) return { status: 404, text: "<title>Page not found</title>" };
		const french2 = made.entries.find((x) => x.group === e.group && x.locale === "fr" && x.status === "published");
		const head = given.french && french2 ? `<link rel="alternate" href="http://localhost:4322/fr/posts/${french2.slug}" hreflang="fr">` : "";
		const body = (e.data.content ?? []).map((/** @type {any} */ b) => {
			if (b._type === "masonjames-registry-contact-form") {
				return given.unavailable || !made.forms.some((f) => f.id === b.formId)
					? '<div class="mjcf-unavailable">This form is currently unavailable.</div><script>closest(`[data-mjcf-form]`)</script>'
					: `<form class="mjcf-form" method="POST" data-mjcf-form><input type="hidden" name="formId" value="${b.formId}"><input name="name"><input name="email"><textarea name="message"></textarea></form>`;
			}
			if (b._type === "studio-form") return `<astro-island props="{&quot;formId&quot;:[0,&quot;${b.formId}&quot;]}"></astro-island>`;
			return `<p>${(b.children ?? []).map((/** @type {any} */ c) => c.text).join("")}</p>`;
		});
		return { status: 200, text: `<head><title>${e.data.title}</title>${head}</head><h1>${e.data.title}</h1>${body.join("")}` };
	};
	/** @param {string} url @param {RequestInit} [init] */
	const answers = (url, init = {}) => {
		const { pathname, search, searchParams } = new URL(url);
		const method = init.method ?? "GET";
		const signedIn = new Headers(init.headers).get("authorization") === "Bearer ec_pat_T";
		const sent = typeof init.body === "string" ? JSON.parse(init.body) : {};
		const asked = `${method} ${pathname}${search}${signedIn ? "" : " as a visitor"}`;
		made.asked.push(asked);
		if (given.refuses?.(asked)) return no(500, "INTERNAL_ERROR", "the database is locked");
		if (!pathname.startsWith("/_emdash/api/")) return page(pathname);
		const api = pathname.replace("/_emdash/api", "");
		// what a visitor may ask: a form's submit, Forms' three, Instant Indexer's key, and which plugin holds Forms' forms
		if (api === "/plugins/r_contact/submit") {
			made.messages.push(sent.data.message);
			return yes({ success: true, message: "Thanks." });
		}
		if (api === "/plugins/r_forms/ticket") return yes({ ok: true, ticket: "T", minimumWaitMs: 0 });
		if (api === "/plugins/r_forms/submit") return yes({ ok: !!made.feedback?.answers.push(sent.answers) });
		if (api === "/plugins/r_forms/definition") return yes({ ok: true, id: searchParams.get("id"), definition: { fields: [{ id: "name" }, { id: "email" }, { id: "message" }] } });
		if (api === "/plugins/r_indexer/key") return { status: 200, text: given.key ?? "0123456789abcdef0123456789abcdef" };
		if (api === "/plugins/forms-embed/connection") return yes({ engineId: given.engine ?? "r_forms", apiVersion: 1 });
		if (!signedIn) return no(401, "UNAUTHORIZED", "Authentication required");
		if (api === "/admin/plugins") return yes({ items: made.plugins });
		if (api === "/manifest") {
			return yes({
				i18n: given.french ? { defaultLocale: "en", locales: ["en", "fr"] } : null,
				collections: { pages: { urlPattern: "/pages/{slug}" }, posts: { urlPattern: "/posts/{slug}" } },
				plugins: given.draws ? { "masonjames-contact-forms-embed": { enabled: true, portableTextBlocks: [{ type: "masonjames-registry-contact-form" }] }, "forms-embed": { enabled: true, portableTextBlocks: [{ type: "studio-form" }] } } : {},
			});
		}
		if (api === "/admin/plugins/r_seo/settings") {
			if (method === "PUT") Object.assign(made.settings, sent.values);
			return yes({ values: made.settings });
		}
		if (api === "/admin/plugins/r_lingua/settings") {
			if (method === "PUT") made.translateInto = sent.values.targetLocales;
			return yes({ values: { targetLocales: made.translateInto } });
		}
		// EmDash's own: entries, the menu, the media library
		const [, type, name, more] = /^\/content\/(pages|posts)(?:\/([^/]+))?(?:\/(publish|translations))?$/.exec(api) ?? [];
		if (type && !name) {
			const e = { id: `${type}-${made.entries.length + 1}`, type, slug: sent.slug, status: "draft", locale: "en", group: "", version: 1, data: sent.data };
			made.entries.push({ ...e, group: e.id });
			return yes(shown(e), 201);
		}
		if (type) {
			const e = entry(type, name);
			if (!e) return no(404, "NOT_FOUND", `Content item not found: ${name}`);
			if (more === "translations") return yes({ translations: made.entries.filter((x) => x.group === e.group).map(({ id, locale, slug, status }) => ({ id, locale, slug, status })) });
			if (more === "publish") e.status = "published";
			if (method === "PUT") {
				if (sent._rev !== `rev${e.version}`) return no(409, "CONFLICT", "the entry was changed by someone else");
				Object.assign(e, { slug: sent.slug ?? e.slug, version: e.version + 1, data: { ...e.data, ...sent.data } });
			}
			return yes(shown(e));
		}
		if (api === "/menus/primary") return made.menu ? yes({ name: "primary", items: made.menu }) : no(404, "NOT_FOUND", "Menu not found");
		if (api === "/menus") return yes({ name: "primary", items: (made.menu = []) });
		if (api === "/menus/primary/items") return yes(made.menu?.push({ referenceId: sent.referenceId, label: sent.label }));
		if (api === "/media" && method === "GET") return yes({ items: made.media.filter((m) => m.filename.includes(searchParams.get("q") ?? "")) });
		if (api === "/media") {
			const file = /** @type {File} */ (/** @type {FormData} */ (init.body).get("file"));
			made.media.push({ id: `media-${made.media.length + 1}`, filename: file.name, alt: String(/** @type {FormData} */ (init.body).get("alt") ?? ""), width: 1200, height: 800, mimeType: file.type });
			return yes({ item: made.media.at(-1) }, 201);
		}
		// the plugins' own
		if (api === "/plugins/r_contact/admin") {
			if (sent.action_id === "forms:save:new") made.forms.push({ id: `form-${made.forms.length + 1}`, slug: sent.values.slug });
			return yes({ blocks: made.forms.flatMap((f) => [{ type: "context", text: `Form ID: ${f.id}` }, { type: "fields", fields: [{ label: "Slug", value: f.slug }] }]) });
		}
		if (api === "/plugins/r_contact/submissions/export") return { status: 200, text: ["ID,Name,Email,Message", ...made.messages.map((m, i) => `${i},A Visitor,visitor@example.com,${m}`)].join("\n") };
		const feedback = () => (made.feedback ? { id: made.feedback.id, record: { status: made.feedback.status, [made.feedback.status === "draft" ? "draft" : "published"]: { title: made.feedback.title } } } : null);
		if (api === "/plugins/r_forms/list") return yes({ ok: true, items: made.feedback ? [feedback()] : [] });
		if (api === "/plugins/r_forms/create") {
			made.feedback = { id: "feedback-1", status: "draft", title: sent.definition.title, answers: [] };
			return yes({ ok: true, ...feedback() });
		}
		if (api === "/plugins/r_forms/get") return yes({ ok: true, revision: "r1" });
		if (api === "/plugins/r_forms/publish" && made.feedback) return yes({ ok: !!(made.feedback.status = "published") });
		if (api === "/plugins/r_forms/entries") return yes({ ok: true, items: (made.feedback?.answers ?? []).map((a) => ({ entry: { answers: a } })) });
		if (api === "/plugins/r_lingua/admin") {
			// its button: a French copy of the entry, a draft, its slug made from the title it copied
			const source = sent.action_id === "translate-missing" ? made.entries.find((e) => e.id === sent.value.split("|")[2]) : null;
			if (source) made.entries.push({ ...source, id: `${source.id}-fr`, slug: "a-copy", status: "draft", locale: "fr", version: 1, data: { ...source.data } });
			// (what is published it lets go — once it has heard of the publish)
			const waiting = made.entries.filter((e) => e.locale === "fr" && (e.status === "draft" || late-- > 0));
			return yes({ blocks: [{ type: "tab", panels: [{ label: `To review (${waiting.length})`, blocks: [{ rows: waiting.map((e) => ({ action: { target: { id: e.id } } })) }] }] }] });
		}
		if (api === "/plugins/r_indexer/admin") return yes({ blocks: [{ type: "banner", title: "Sending is blocked for this address", description: "The site address, http://localhost:4322, is local or reserved for testing. Nothing is sent." }] });
		return no(404, "NOT_FOUND", `nothing at ${asked}`);
	};
	const downloads = (/** @type {string} */ url) => {
		made.downloaded.push(url);
		return given.photo === false ? { status: 503 } : { status: 200, bytes: new Uint8Array([0xff, 0xd8, 0xff]), headers: { "content-type": "image/jpeg" } };
	};
	return { made, answers, downloads };
};
/** The task, on a made-up site this machine is signed in to. @param {ReturnType<typeof aSite>} site @param {(plugins: string[]) => Promise<void>} [install] */
const run = (site, install = async () => {}, signedIn = true, list = two) => {
	const fake = fakeWorld({ files: signedIn ? { [token]: '{"token":"ec_pat_T"}' } : {}, answers: site.answers, downloads: site.downloads });
	return { ...fake, result: demo({ world: fake.world, project, flags: {}, args: [], argv: [], env: {}, did: [], standsOn: false }, list, install) };
};
const failed = (/** @type {unknown} */ e) => e instanceof Exit && e.code === 1;
/** What a run asked that was not only a look: every request but a GET. @param {ReturnType<typeof aSite>} site @param {number} since */
const changes = (site, since) => site.made.asked.slice(since).filter((a) => !a.startsWith("GET "));

test("it stands on the site able to run sandboxed plugins, built, running, and this machine signed in", () => {
	assert.deepEqual(plan(graph, "plugin:demo"), ["site:local-only", "site:exists", "plugin:sandbox", "site:installed", "site:key", "site:built", "site:built-running", "signin:token", "plugin:demo"]);
});

test("a recipe makes its thing and proves it: one line each, and the count", async () => {
	const site = aSite();
	const { said, result } = run(site);
	await result;
	assert.deepEqual(said, [
		"-> this machine, built site (site:preview): http://localhost:4322",
		'ok   seo-suite: the home page carries what its settings name: the organisation "Acme" as JSON-LD, and the X handle @acme',
		`ok   contact-forms: the message a visitor sent to its form "Contact" is in the export of submissions, once — ${CANNOT_DRAW}`,
		"all 2 plugins did their real thing",
	]);
	assert.deepEqual(site.made.settings, { organizationName: "Acme", twitterHandle: "acme" });
	assert.deepEqual(site.made.forms, [{ id: "form-1", slug: "contact" }]);
	assert.deepEqual(site.made.messages, ["Hello from plugin:demo"]);
});

test("the message is sent as a visitor, with no sign-in, and read back signed in", async () => {
	const site = aSite();
	await run(site).result;
	assert.ok(site.made.asked.includes("POST /_emdash/api/plugins/r_contact/submit as a visitor"));
	assert.ok(site.made.asked.includes("GET /_emdash/api/plugins/r_contact/submissions/export?formId=form-1"));
});

test("run again: every line says already so, and nothing is made — no second form, no second message, no setting saved", async () => {
	const site = aSite();
	await run(site).result;
	const before = site.made.asked.length;
	const { said, result } = run(site);
	await result;
	assert.ok(said[1].startsWith("ok   seo-suite: already so — the home page carries"));
	assert.ok(said[2].startsWith("ok   contact-forms: already so — the message a visitor sent"));
	assert.ok(said[2].includes("is in the export of submissions, once"));
	assert.equal(site.made.forms.length, 1);
	assert.equal(site.made.messages.length, 1);
	// what it asked the second time only looks: no PUT, and the one POST is the plugin's page being loaded
	assert.deepEqual(changes(site, before), ["POST /_emdash/api/plugins/r_contact/admin"]);
});

test("a setting the site already has is its owner's: kept, and the proof looks for it", async () => {
	const site = aSite({ organizationName: "Owner & Co" });
	const { said, result } = run(site);
	await result;
	assert.deepEqual(site.made.settings, { organizationName: "Owner & Co", twitterHandle: "acme" });
	assert.ok(said[1].includes('the organisation "Owner & Co" as JSON-LD'));
});

test("a plugin the site lacks is installed first — that one only, at the release that was tried", async () => {
	const site = aSite({ plugins: ["seo-suite"] });
	/** @type {string[]} */
	const asked = [];
	const { said, result } = run(site, async (plugins) => {
		asked.push(...plugins);
		site.made.plugins.push({ id: "r_contact", source: "registry", registrySlug: "contact-forms" });
	});
	await result;
	assert.deepEqual(asked, ["@masonjames.com/contact-forms@0.2.0"]);
	assert.equal(said[1], "installing what the site does not have yet: contact-forms");
	assert.equal(said.at(-1), "all 2 plugins did their real thing");
});

test("a plugin that could not be installed is a FAIL line; the others still do their thing, and the task fails", async () => {
	const site = aSite({ plugins: ["seo-suite"] });
	const { said, result } = run(site);
	await assert.rejects(result, failed);
	assert.ok(said.some((l) => l.startsWith("ok   seo-suite: ")));
	assert.ok(said.includes("FAIL contact-forms: it is not installed: the install, above, says why"));
	assert.equal(said.at(-1), "1 of 2 plugins did not do their real thing: the FAIL lines say what the site answered");
});

test("a request that fails is a FAIL line with what the site said, and the task fails", async () => {
	const site = aSite({ refuses: (asked) => asked.startsWith("PUT /_emdash/api/admin/plugins/r_seo/settings") });
	const { said, result } = run(site);
	await assert.rejects(result, failed);
	assert.ok(said.includes("FAIL seo-suite: saving its settings answered 500 INTERNAL_ERROR: the database is locked"));
	assert.ok(said.some((l) => l.startsWith("ok   contact-forms: ")), "the next plugin is still tried");
	assert.deepEqual(site.made.settings, { organizationName: null, twitterHandle: null });
});

test("a visitor's message the plugin does not take is a FAIL line, and nothing is claimed", async () => {
	const site = aSite({ refuses: (asked) => asked.endsWith("/submit as a visitor") });
	const { said, result } = run(site);
	await assert.rejects(result, failed);
	assert.ok(said.includes("FAIL contact-forms: a visitor's message answered 500 INTERNAL_ERROR: the database is locked"));
	assert.equal(site.made.forms.length, 1, "the form was made; run again finds it and makes no second one");
});

test("the site does not accept this machine's sign-in: said, with the task that signs in, and nothing is made", async () => {
	const site = aSite();
	const { result } = run(site, undefined, false);
	await assert.rejects(result, /did not accept this machine's sign-in: GET \/_emdash\/api\/admin\/plugins answered 401 UNAUTHORIZED[\s\S]*mise run signin:token/);
	assert.deepEqual(site.made.asked, ["GET /_emdash/api/admin/plugins as a visitor"]);
});

test("--live stops it at the first state: nothing is run or asked, and nothing signs in to the deployed site", async () => {
	assert.equal(plan(graph, "plugin:demo", { live: true })[0], "site:local-only");
	const site = aSite();
	const fake = fakeWorld({ files: { "/p/site/package.json": "{}" }, answers: site.answers });
	await assert.rejects(reach(graph, "plugin:demo", { world: fake.world, project: { ...project, live: "https://my.site.dev" }, flags: { live: true } }), /the site on this machine only[\s\S]*Nothing was done/);
	assert.deepEqual([fake.ran, fake.execd, fake.sqls, site.made.asked], [[], [], [], []]);
});

test("the image is made here: a PNG, 16 by 16, the same bytes each time", () => {
	const image = png();
	assert.deepEqual([...image.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	assert.equal(image.subarray(12, 16).toString("latin1"), "IHDR");
	assert.deepEqual([image.readUInt32BE(16), image.readUInt32BE(20)], [16, 16]);
	assert.equal(image.subarray(-8, -4).toString("latin1"), "IEND");
	assert.ok(image.equals(png()));
});

// ─── on a page, for a visitor ────────────────────────────────────────────────────────────────────

test("a site that can draw Contact Forms' block: a Contact page is made with the form on it, published and in the menu, and a visitor's page has the form", async () => {
	const site = aSite({ draws: true });
	const { said, result } = run(site);
	await result;
	assert.equal(said[2], 'ok   contact-forms: a visitor finds its form "Contact" on /pages/contact, with a field for each of name, email, message; and the message a visitor sent to its form "Contact" is in the export of submissions, once');
	const [page] = site.made.entries;
	assert.deepEqual([site.made.entries.length, page.type, page.slug, page.status, page.data.title], [1, "pages", "contact", "published", "Contact"]);
	assert.deepEqual(page.data.content.map((/** @type {any} */ b) => b._type), ["block", "masonjames-registry-contact-form"]);
	assert.equal(page.data.content[1].formId, "form-1");
	assert.deepEqual(site.made.menu, [{ referenceId: page.id, label: "Contact" }]);
	// run again: the page, its block and its place in the menu are found, and nothing is made
	const before = site.made.asked.length;
	const again = run(site);
	await again.result;
	assert.ok(again.said[2].startsWith('ok   contact-forms: already so — a visitor finds its form "Contact" on /pages/contact'));
	assert.deepEqual(changes(site, before), ["POST /_emdash/api/plugins/r_contact/admin"]);
	assert.deepEqual([site.made.entries.length, page.data.content.length, site.made.menu?.length], [1, 2, 1]);
});

test("a Contact page that is already there is somebody's: it keeps what it says, and the form is added under it, once", async () => {
	const site = aSite({ draws: true });
	const theirs = { _type: "block", _key: "a", children: [{ text: "Write to us: hello@example.com." }] };
	site.made.entries.push({ id: "pages-1", type: "pages", slug: "contact", status: "published", locale: "en", group: "pages-1", version: 3, data: { title: "Get in touch", content: [theirs] } });
	site.made.menu = [{ referenceId: "pages-1", label: "Get in touch" }];
	await run(site).result;
	const [page] = site.made.entries;
	assert.equal(page.data.title, "Get in touch");
	assert.deepEqual(page.data.content, [theirs, { _type: "masonjames-registry-contact-form", _key: "plugin-demo-form", formId: "form-1" }]);
	assert.ok(site.made.asked.includes("PUT /_emdash/api/content/pages/pages-1"), "added by an update that gives back the page's _rev");
	assert.deepEqual(site.made.menu, [{ referenceId: "pages-1", label: "Get in touch" }], "it was in the menu: not put there twice");
	await run(site).result;
	assert.equal(page.data.content.length, 2, "run again: no second block");
});

test("a page that tells a visitor the form is unavailable is a FAIL line: a block on a page is not a form on it", async () => {
	const site = aSite({ draws: true, unavailable: true });
	const { said, result } = run(site);
	await assert.rejects(result, failed);
	assert.ok(said.includes('FAIL contact-forms: /pages/contact does not show a visitor the form: where it should be, the page says "This form is currently unavailable."'));
});

test("Forms: a form Feedback, published and answered by a visitor, on a page of its own — and the proof asks what a visitor's browser asks", async () => {
	const site = aSite({ draws: true });
	const { said, result } = run(site, undefined, true, only(/netdollar/));
	await result;
	assert.equal(said[1], 'ok   forms: a visitor finds its form "Feedback" on /pages/feedback: the page has its place, and the browser that fills it is given the fields name, email, message; and the answers a visitor sent to its published form "Feedback" (feedback-1) are among its entries, once');
	assert.deepEqual([site.made.feedback?.status, site.made.feedback?.answers.length], ["published", 1]);
	assert.deepEqual(site.made.entries.map((e) => [e.slug, e.status, e.data.content.at(-1)]), [["feedback", "published", { _type: "studio-form", _key: "plugin-demo-form", formId: "feedback-1" }]]);
	for (const asked of ["GET /_emdash/api/plugins/forms-embed/connection as a visitor", "GET /_emdash/api/plugins/r_forms/definition?id=feedback-1 as a visitor"]) assert.ok(site.made.asked.includes(asked), asked);
	const before = site.made.asked.length;
	const again = run(site, undefined, true, only(/netdollar/));
	await again.result;
	assert.ok(again.said[1].startsWith("ok   forms: already so — "));
	assert.deepEqual([site.made.feedback?.answers.length, site.made.entries.length, site.made.menu?.length], [1, 1, 1]);
	assert.deepEqual([...new Set(changes(site, before))], ["POST /_emdash/api/plugins/r_forms/list", "POST /_emdash/api/plugins/r_forms/entries"], "only its two lists, which it gives to a POST");
});

test("Forms: a browser told that another plugin holds the forms would draw nothing — a FAIL line; and a site that cannot draw the block says so", async () => {
	const elsewhere = aSite({ draws: true, engine: "r_other" });
	const { said, result } = run(elsewhere, undefined, true, only(/netdollar/));
	await assert.rejects(result, failed);
	assert.ok(said.includes("FAIL forms: a visitor's browser is told the forms are held by the plugin r_other, and this one is r_forms"));
	const plain = aSite();
	const without = run(plain, undefined, true, only(/netdollar/));
	await without.result;
	assert.ok(without.said[1].endsWith("are among its entries, once — it is on no page, for this site cannot draw it: plugins: [ … ] of emdash({ … }) in its Astro config has no forms(), of the package @netdollar/emdash-forms"));
	assert.deepEqual(plain.made.entries, [], "no page is made that could not show the form");
});

test("LinguaDash on a site that has French: the copy it makes is given its French words and published, and a visitor reads it at the address the English page names", async () => {
	const site = aSite({ french: true });
	const { said, result } = run(site, undefined, true, only(/linguadash/));
	await result;
	assert.equal(said[1], 'ok   linguadash: a visitor reads the post in French at /fr/posts/chaque-lien-est-une-promesse ("Chaque lien est une promesse"), which /posts/plugin-demo names as its French page; it made the French entry, and no longer lists it to review');
	const [english, french] = site.made.entries;
	assert.deepEqual([english.slug, english.status, english.data.title], ["plugin-demo", "published", "Every link is a promise"]);
	assert.deepEqual([french.locale, french.slug, french.status, french.data.title], ["fr", "chaque-lien-est-une-promesse", "published", "Chaque lien est une promesse"]);
	assert.ok(JSON.stringify(french.data.content).includes("une page qui n’existe pas"), "its body is the French one");
	assert.equal(JSON.stringify(french.data.content).match(/"href":"([^"]+)"/)?.[1], JSON.stringify(english.data.content).match(/"href":"([^"]+)"/)?.[1], "with the same link in it");
	assert.equal(site.made.translateInto, "fr");
	// the post's photograph: asked for once, uploaded with alt text, and on both entries
	assert.deepEqual(site.made.downloaded, ["https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=800&fit=crop"]);
	assert.deepEqual(site.made.media.map((m) => [m.filename, m.mimeType, /Earth at night/.test(m.alt)]), [["plugin-demo-photo.jpg", "image/jpeg", true]]);
	assert.deepEqual([english.data.featured_image.id, french.data.featured_image.id], ["media-1", "media-1"]);
	// run again: nothing is translated, published, downloaded or uploaded a second time
	const before = site.made.asked.length;
	const again = run(site, undefined, true, only(/linguadash/));
	await again.result;
	assert.ok(again.said[1].startsWith("ok   linguadash: already so — a visitor reads the post in French"));
	assert.deepEqual(changes(site, before), ["POST /_emdash/api/plugins/r_lingua/admin"], "only its Translations page being loaded");
	assert.deepEqual([site.made.entries.length, site.made.media.length, site.made.downloaded.length], [2, 1, 1]);
});

test("LinguaDash hears of a publish a moment after it: it is asked until it has let the entry go, and only then is the proof", async () => {
	const site = aSite({ french: true, late: 3 });
	const { said, result } = run(site, undefined, true, only(/linguadash/));
	await result;
	assert.ok(said[1].startsWith("ok   linguadash: a visitor reads the post in French"), said[1]);
	assert.equal(site.made.asked.filter((a) => a === "POST /_emdash/api/plugins/r_lingua/admin").length, 6, "its button, the three times it still listed the entry, the time it did not, and the proof");
});

test("LinguaDash on a site with no French among its languages: the copy stays a draft, and the line says no visitor can open it", async () => {
	const site = aSite();
	const { said, result } = run(site, undefined, true, only(/linguadash/));
	await result;
	assert.equal(said[1], 'ok   linguadash: the post "plugin-demo" has the French entry it made (a-copy, a draft to review) — no visitor can open it: French is not one of this site\'s languages (i18n in its Astro config)');
	assert.deepEqual(site.made.entries.map((e) => [e.locale, e.status]), [["en", "published"], ["fr", "draft"]]);
});

test("the post an earlier release of the task made is brought up to date: its words, and a photograph", async () => {
	const site = aSite({ french: true });
	site.made.entries.push({ id: "posts-1", type: "posts", slug: "plugin-demo", status: "published", locale: "en", group: "posts-1", version: 2, data: { title: "A post made by plugin:demo", excerpt: "Made by the task plugin:demo, for the plugins it tries." } });
	await run(site, undefined, true, only(/linguadash/)).result;
	const [english, french] = site.made.entries;
	assert.deepEqual([english.id, english.status, english.data.title, english.data.featured_image.filename], ["posts-1", "published", "Every link is a promise", "plugin-demo-photo.jpg"]);
	assert.equal(french.data.title, "Chaque lien est une promesse");
	assert.equal(site.made.entries.length, 2, "the post is changed where it is: no second one");
});

test("the photograph's address does not answer: a FAIL line that names it, and no post without its picture", async () => {
	const site = aSite({ french: true, photo: false });
	const { said, result } = run(site, undefined, true, only(/linguadash/));
	await assert.rejects(result, failed);
	assert.ok(said.includes("FAIL linguadash: the post's photograph, https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=800&fit=crop, answered 503"));
	assert.deepEqual([site.made.entries, site.made.media], [[], []]);
});

test("Instant Indexer: its key address answers a visitor, and the line quotes what the plugin itself says of sending from this machine", async () => {
	const site = aSite();
	const { said, result } = run(site, undefined, true, only(/instant-indexer/));
	await result;
	assert.equal(said[1], 'ok   instant-indexer: already so — its key address answers a visitor with its key, 32 hexadecimal characters (not printed); it sends nothing from here, and says so itself — "Sending is blocked for this address": The site address, http://localhost:4322, is local or reserved for testing. Nothing is sent.');
	assert.ok(site.made.asked.includes("GET /_emdash/api/plugins/r_indexer/key as a visitor"));
	assert.ok(!said.join("\n").includes("0123456789abcdef"), "the key itself is not printed");
	const broken = run(aSite({ key: "<html>Not found</html>" }), undefined, true, only(/instant-indexer/));
	await assert.rejects(broken.result, failed);
	assert.ok(broken.said.includes("FAIL instant-indexer: its key address answered a visitor with what is not a key of 32 hexadecimal characters: <html>Not found</html>"));
});

test("there is a recipe for each of the favourites, and for the two others: seven, each held to a release", () => {
	assert.deepEqual(recipes.map((r) => r.plugin), [
		"@nookeshk.bsky.social/seo-suite@0.2.0",
		"@meekmedia.bsky.social/link-guardian@0.1.0",
		"@agenticecom.net/media-alt-text-queue@0.2.1",
		"@masonjames.com/contact-forms@0.2.0",
		"@netdollar.dev/forms@0.1.0",
		"@swiss.ky/linguadash@0.2.1",
		"@peachfinthemes.com/instant-indexer@1.0.0",
	]);
});
