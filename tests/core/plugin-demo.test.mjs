// plugin:demo (scripts/core/plugin-demo.mjs): what it stands on, and its recipes on a made-up site —
// one makes its thing and proves it, run again makes nothing, and a refusal is a FAIL line with what
// the site said.
import assert from "node:assert/strict";
import { test } from "node:test";

import { Exit } from "../../scripts/core/calls.mjs";
import { graph } from "../../scripts/core/cli.mjs";
import { plan, reach } from "../../scripts/core/graph.mjs";
import { demo, png, recipes } from "../../scripts/core/plugin-demo.mjs";
import { savedName } from "../../scripts/core/signin.mjs";
import { fakeWorld, project } from "./fake-world.mjs";

const two = recipes.filter((r) => /seo-suite|contact-forms/.test(r.plugin));
const token = `/config/emdash-run/tokens/${savedName("http://localhost:4322", project.site)}.json`;

/**
 * A made-up EmDash site with two of the plugins, as far as their recipes ask: SEO Suite, whose
 * settings show on the home page, and Contact Forms, which keeps forms and what visitors send them.
 * It keeps what it was asked, and what was made in it.
 * @param {{ plugins?: string[], refuses?: (asked: string) => boolean, organizationName?: string }} [given]
 */
const aSite = (given = {}) => {
	const ids = /** @type {Record<string, string>} */ ({ "seo-suite": "r_seo", "contact-forms": "r_contact" });
	const made = {
		plugins: (given.plugins ?? Object.keys(ids)).map((slug) => ({ id: ids[slug], source: "registry", registrySlug: slug })),
		settings: /** @type {Record<string, string | null>} */ ({ organizationName: given.organizationName ?? null, twitterHandle: null }),
		forms: /** @type {{ id: string, slug: string }[]} */ ([]),
		messages: /** @type {string[]} */ ([]),
		asked: /** @type {string[]} */ ([]),
	};
	const yes = (/** @type {unknown} */ data) => ({ status: 200, text: JSON.stringify({ success: true, data }) });
	const no = (/** @type {number} */ status, /** @type {string} */ code, /** @type {string} */ message) => ({ status, text: JSON.stringify({ success: false, error: { code, message } }) });
	/** @param {string} url @param {RequestInit} [init] */
	const answers = (url, init = {}) => {
		const { pathname, search } = new URL(url);
		const method = init.method ?? "GET";
		const signedIn = new Headers(init.headers).get("authorization") === "Bearer ec_pat_T";
		const sent = typeof init.body === "string" ? JSON.parse(init.body) : {};
		const asked = `${method} ${pathname}${search}${signedIn ? "" : " as a visitor"}`;
		made.asked.push(asked);
		if (given.refuses?.(asked)) return no(500, "INTERNAL_ERROR", "the database is locked");
		if (pathname === "/") {
			const { organizationName: name, twitterHandle: handle } = made.settings;
			return { status: 200, text: `<head>${handle ? `<meta name="twitter:site" content="@${handle}">` : ""}${name ? `<script type="application/ld+json">{"@type":"Organization","name":${JSON.stringify(name)}}</script>` : ""}</head>` };
		}
		const api = pathname.replace("/_emdash/api", "");
		if (!signedIn && api !== "/plugins/r_contact/submit") return no(401, "UNAUTHORIZED", "Authentication required");
		if (api === "/admin/plugins") return yes({ items: made.plugins });
		if (api === "/admin/plugins/r_seo/settings") {
			if (method === "PUT") Object.assign(made.settings, sent.values);
			return yes({ values: made.settings });
		}
		if (api === "/plugins/r_contact/admin") {
			if (sent.action_id === "forms:save:new") made.forms.push({ id: `form-${made.forms.length + 1}`, slug: sent.values.slug });
			return yes({ blocks: made.forms.flatMap((f) => [{ type: "context", text: `Form ID: ${f.id}` }, { type: "fields", fields: [{ label: "Slug", value: f.slug }] }]) });
		}
		if (api === "/plugins/r_contact/submit") {
			made.messages.push(sent.data.message);
			return yes({ success: true, message: "Thanks." });
		}
		if (api === "/plugins/r_contact/submissions/export") return { status: 200, text: ["ID,Name,Email,Message", ...made.messages.map((m, i) => `${i},A Visitor,visitor@example.com,${m}`)].join("\n") };
		return no(404, "NOT_FOUND", `nothing at ${asked}`);
	};
	return { made, answers };
};
/** The task, on a made-up site this machine is signed in to. @param {ReturnType<typeof aSite>} site @param {(plugins: string[]) => Promise<void>} [install] */
const run = (site, install = async () => {}, signedIn = true) => {
	const fake = fakeWorld({ files: signedIn ? { [token]: '{"token":"ec_pat_T"}' } : {}, answers: site.answers });
	return { ...fake, result: demo({ world: fake.world, project, flags: {}, args: [], argv: [], env: {}, did: [], standsOn: false }, two, install) };
};
const failed = (/** @type {unknown} */ e) => e instanceof Exit && e.code === 1;

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
		'ok   contact-forms: the message a visitor sent to its form "Contact" is in the export of submissions, once',
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
	assert.ok(said[2].endsWith(", once"));
	assert.equal(site.made.forms.length, 1);
	assert.equal(site.made.messages.length, 1);
	// what it asked the second time only looks: no PUT, and the one POST is the plugin's page being loaded
	const again = site.made.asked.slice(before);
	assert.deepEqual(again.filter((a) => !a.startsWith("GET ")), ["POST /_emdash/api/plugins/r_contact/admin"]);
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
