// The types of EmDash's requests (scripts/core/emdash-api.d.ts) are what `mise run dev:api-types`
// writes from the copy of EmDash's own list that is kept beside them (emdash-openapi.json): one
// cannot change without the other. And the copy says which EmDash it is from.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const core = new URL("../../scripts/core/", import.meta.url);
// The program dev:api-types runs, called here as that command calls it. (Named in a variable, so that
// the type check does not read the program's own declarations: they are not this repo's to keep right.)
const program = "openapi-typescript";

test("emdash-api.d.ts is what dev:api-types writes from emdash-openapi.json", async () => {
	const { default: openapiTS, astToString } = /** @type {{ default: (file: URL, options: { defaultNonNullable: boolean }) => Promise<unknown>, astToString: (ast: unknown) => string }} */ (await import(program));
	const written = astToString(await openapiTS(new URL("emdash-openapi.json", core), { defaultNonNullable: false }));
	// (the command puts a few lines above the types, saying that a program wrote the file)
	const kept = readFileSync(new URL("emdash-api.d.ts", core), "utf8");
	assert.equal(kept.slice(kept.indexOf("export interface paths")), written.slice(written.indexOf("export interface paths")), "run: mise run dev:api-types");
});

test("the copy of EmDash's list says which EmDash it is from", () => {
	const list = JSON.parse(readFileSync(new URL("emdash-openapi.json", core), "utf8"));
	assert.match(list["x-emdash-run"].from, /^EmDash \d+\.\d+\.\d+/);
	assert.ok(Object.keys(list.paths).length > 50);
});
