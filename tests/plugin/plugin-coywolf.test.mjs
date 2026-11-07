// The edits plugin:coywolf makes (scripts/plugin-coywolf.mjs), on the fixtures in
// fixtures/coywolf/ beside this file: two real sites' files (this repo's site/, which has no route
// cache, and one that has), their middlewares and wrangler configs. Run by `mise run check`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { CannotEdit, emdashCall, imports } from "../../scripts/plugin-astro-config.mjs";
import { editConfig, editMiddleware, editWrangler, newMiddleware, tarball } from "../../scripts/plugin-coywolf.mjs";
import { parseJsonc } from "../../scripts/wrangler-config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (/** @type {string} */ name) => readFileSync(join(here, "fixtures", "coywolf", name), "utf8");
const tmp = mkdtempSync(join(tmpdir(), "coywolf-edit-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const parses = (/** @type {string} */ text) => {
	const f = join(tmp, `c${n++}.mjs`);
	writeFileSync(f, text);
	const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
	assert.equal(r.status, 0, r.stderr);
};
const count = (/** @type {string} */ text, /** @type {string} */ s) => text.split(s).length - 1;

test("the tarball is the release's, not a github: address", () => {
	assert.equal(tarball("v0.35.11"), "https://codeload.github.com/coywolf-llc/coywolf-pack/tar.gz/refs/tags/v0.35.11");
});

for (const name of ["astro-cached.mjs", "astro-uncached.mjs"]) {
	test(`astro.config: ${name} gets the plugin and Vite's lines, Node can read it, run again changes nothing`, () => {
		const { text, added } = editConfig(fixture(name));
		parses(text);
		const { open, close } = emdashCall(text);
		assert.match(text.slice(open, close), /plugins: \[[^\]]*\bcoywolfPlugin\(\)\]/);
		assert.ok(imports(text).some((i) => i.module === "@coywolf/emdash" && i.named.some((x) => x.imported === "coywolfPlugin")));
		assert.equal(count(text, 'exclude: ["@coywolf/emdash"]'), 2);
		assert.ok(added.length >= 2);
		const again = editConfig(text);
		assert.equal(again.text, text);
		assert.deepEqual(again.added, []);
	});
}

test("astro.config: a site with its own route cache keeps it, and gets no route rules", () => {
	const before = fixture("astro-cached.mjs");
	const { text } = editConfig(before);
	assert.equal(count(text, "cacheCloudflare"), count(before, "cacheCloudflare"));
	assert.ok(!text.includes("routeRules"));
});

test("astro.config: a site with no route cache gets Cloudflare's, and route rules for every page", () => {
	const { text } = editConfig(fixture("astro-uncached.mjs"));
	assert.ok(imports(text).some((i) => i.module === "@astrojs/cloudflare/cache"));
	assert.match(text, /cache: \{ provider: cacheCloudflare\(\) \}/);
	assert.match(text, /"\/\[\.\.\.path\]": \{ maxAge: 3600, swr: 86400 \}/);
});

test("astro.config: a vite: block of its own is not edited inside", () => {
	const t = fixture("astro-uncached.mjs").replace("export default defineConfig({", "export default defineConfig({\n\tvite: { server: { port: 1 } },");
	assert.throws(() => editConfig(t), CannotEdit);
});

test("middleware: none — the file it makes is coywolfPack() alone", () => {
	const t = newMiddleware();
	assert.match(t, /export const onRequest = sequence\(coywolfPack\(\)\);/);
	assert.equal(editMiddleware(t), null);
});

test("middleware: a typed one-liner becomes the site's own, after the pack", () => {
	const t = /** @type {string} */ (editMiddleware(fixture("middleware-typed.ts")));
	assert.match(t, /const siteMiddleware: MiddlewareHandler = \(_context, next\) => next\(\);/);
	assert.match(t, /export const onRequest = sequence\(coywolfPack\(\), siteMiddleware\);/);
	assert.equal(count(t, "export const onRequest"), 1);
	assert.equal(editMiddleware(t), null);
});

test("middleware: defineMiddleware( … ) of several lines is kept whole, after the pack", () => {
	const before = fixture("middleware-define.ts");
	const t = /** @type {string} */ (editMiddleware(before));
	assert.match(t, /const siteMiddleware = defineMiddleware\(\(context, next\) => \{/);
	assert.ok(t.includes(before.slice(before.indexOf("const emdash = context.locals.emdash"), before.indexOf("return next();"))));
	assert.ok(imports(t).some((i) => i.module === "astro:middleware" && i.named.some((x) => x.imported === "sequence") && i.named.some((x) => x.imported === "defineMiddleware")));
	assert.match(t, /export const onRequest = sequence\(coywolfPack\(\), siteMiddleware\);\n$/);
});

test("middleware: sequence( … ) of its own gets coywolfPack() first in it", () => {
	const t = /** @type {string} */ (editMiddleware(fixture("middleware-sequence.ts")));
	assert.match(t, /export const onRequest = sequence\(coywolfPack\(\), auth, log\);/);
	assert.equal(count(t, 'from "astro:middleware"'), 1);
});

test("middleware: export function onRequest is not edited", () => {
	assert.throws(() => editMiddleware("export function onRequest(c, next) { return next(); }\n"), CannotEdit);
});

for (const name of ["wrangler-template.jsonc", "wrangler-previews.jsonc"]) {
	test(`wrangler: ${name} gets the four keys, SELF to its own Worker; comments kept; run again changes nothing`, () => {
		const before = fixture(name);
		const { text, added } = editWrangler(before);
		const c = parseJsonc(text);
		assert.deepEqual(c.version_metadata, { binding: "CF_VERSION_METADATA" });
		assert.deepEqual(c.services, [{ binding: "SELF", service: parseJsonc(before).name }]);
		assert.deepEqual(c.placement, { mode: "smart" });
		assert.deepEqual(c.observability, { enabled: true });
		assert.equal(added.length, 4);
		for (const line of before.split("\n").filter((l) => l.trim().startsWith("//"))) assert.ok(text.includes(line), line);
		assert.equal(editWrangler(text).text, text);
	});
}

test("wrangler: a SELF binding to another Worker, and observability turned off, are not overridden", () => {
	const base = fixture("wrangler-template.jsonc");
	assert.throws(() => editWrangler(base.replace("{", '{\n\t"services": [{ "binding": "SELF", "service": "other" }],')), CannotEdit);
	assert.throws(() => editWrangler(base.replace("{", '{\n\t"observability": { "enabled": false },')), CannotEdit);
	assert.throws(() => editWrangler(base.replace("{", '{\n\t"services": [{ "binding": "AUTH", "service": "auth" }],')), CannotEdit);
});
