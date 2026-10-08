// The graph itself (scripts/core/graph.mjs): what a task would do, in what order, with no site.
import assert from "node:assert/strict";
import { test } from "node:test";

import { graph } from "../../scripts/core/cli.mjs";
import { plan, reach } from "../../scripts/core/graph.mjs";
import { site } from "../../scripts/core/site.mjs";
import { fakeWorld, project } from "./fake-world.mjs";

test("site:start: every state it stands on, each once, in order", () => {
	assert.deepEqual(plan(site, "site:start"), ["site:exists", "site:installed", "site:key", "site:dev-running", "site:dev-cli-answers", "site:start"]);
});
test("site:stop needs only a site", () => {
	assert.deepEqual(plan(site, "site:stop"), ["site:exists", "site:stop"]);
});
test("an edge can follow a flag", () => {
	/** @type {import("../../scripts/core/graph.mjs").Graph} */
	const g = { local: { work: () => {} }, deployed: { work: () => {} }, install: { needs: (f) => (f.live ? ["deployed"] : ["local"]), work: () => {} } };
	assert.deepEqual(plan(g, "install"), ["local", "install"]);
	assert.deepEqual(plan(g, "install", { live: true }), ["deployed", "install"]);
});
test("a state nobody defined, and a circle, are said plainly", () => {
	assert.throws(() => plan(site, "site:nothing"), /is not a state the tasks know/);
	assert.throws(() => plan({ a: { needs: () => ["b"], work: () => {} }, b: { needs: () => ["a"], work: () => {} } }, "a"), /a circle: a -> b -> a/);
});
test("every task: every state it needs is one the graph has, with and without --live", () => {
	for (const name of Object.keys(graph)) for (const live of [false, true]) plan(graph, name, live ? { live } : {});
});
test("reach: a state already reached is skipped, the rest are done in order", async () => {
	/** @type {string[]} */
	const order = [];
	/** @type {import("../../scripts/core/graph.mjs").Graph} */
	const g = { a: { done: () => true, work: () => void order.push("a") }, b: { needs: () => ["a"], work: () => void order.push("b") }, c: { needs: () => ["b", "a"], work: () => void order.push("c") } };
	const result = await reach(g, "c", { world: fakeWorld().world, project, flags: {} });
	assert.deepEqual(order, ["b", "c"]);
	assert.deepEqual(result, { did: ["b", "c"], skipped: ["a"] });
});
test("reach: a node that fails stops everything after it", async () => {
	/** @type {string[]} */
	const order = [];
	/** @type {import("../../scripts/core/graph.mjs").Graph} */
	const g = { a: { work: () => { throw new Error("no"); } }, b: { needs: () => ["a"], work: () => void order.push("b") } };
	await assert.rejects(reach(g, "b", { world: fakeWorld().world, project, flags: {} }), /no/);
	assert.deepEqual(order, []);
});
