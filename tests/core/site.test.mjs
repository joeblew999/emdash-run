// The site's states (scripts/core/site.mjs), each with a made-up outside: what it runs, in what
// order, and when it does nothing.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { reach } from "../../scripts/core/graph.mjs";
import { site } from "../../scripts/core/site.mjs";
import { fakeWorld, project } from "./fake-world.mjs";

const aSite = { "/p/site/package.json": "{}" };
/** @param {Parameters<typeof fakeWorld>[0]} given */
const start = (given) => {
	const fake = fakeWorld(given);
	return { ...fake, result: reach(site, "site:start", { world: fake.world, project, flags: {} }) };
};

test("no site: says so, with the task that makes one, and runs nothing", async () => {
	const fake = start({});
	await assert.rejects(fake.result, /There is no site in \[site\]\. Make one with: mise run site:new/);
	assert.deepEqual(fake.ran, []);
});

test("site:start on a fresh site: install, key, start, the CLI, the welcome dialog — in that order", async () => {
	// a dev site that answers once it has been started
	/** @type {string[]} */
	let ran = [];
	const fake = fakeWorld({
		files: { ...aSite },
		answers: (url) => (ran.some((c) => c.includes("astro dev --background")) ? { status: 200, text: url.includes("dev-bypass") ? '{"data":{"token":"t"}}' : "" } : { status: 0 }),
	});
	ran = fake.ran;
	const result = await reach(site, "site:start", { world: fake.world, project, flags: {} });
	assert.deepEqual(fake.ran, [
		"pnpm install",
		"pnpm exec emdash secrets generate --write .env",
		"pnpm exec astro dev --background --host 127.0.0.1 --port 4321",
		`${process.execPath} ${join("/emdash-run/scripts", "emdash.mjs")} http://localhost:4321 /p/site schema list`,
	]);
	assert.deepEqual(result.skipped, ["site:exists"]);
	assert.ok(fake.said.includes("welcome: EmDash's welcome dialog is closed for the dev user"));
});

test("run again, the site running and its key made: nothing is started, no key is made", async () => {
	const fake = start({ files: { ...aSite, "/p/site/.env": "EMDASH_ENCRYPTION_KEY=abc\n" }, answers: (url) => ({ status: 200, text: url.includes("dev-bypass") ? '{"token":"t"}' : "" }) });
	const result = await fake.result;
	assert.deepEqual(result.skipped, ["site:exists", "site:key", "site:dev-running"]);
	assert.ok(!fake.ran.some((c) => c.includes("astro dev") || c.includes("secrets generate")));
});

test("the dev site dies on start: its own log is shown, and the task fails", async () => {
	const fake = start({ files: { ...aSite }, exits: (c) => (c.includes("astro dev --background") ? 1 : 0) });
	await assert.rejects(fake.result, /the dev site did not start/);
	assert.equal(fake.ran.at(-1), "pnpm exec astro dev logs");
});

test("a command that fails stops the task there", async () => {
	const fake = start({ files: { ...aSite }, exits: (c) => (c === "pnpm install" ? 1 : 0) });
	await assert.rejects(fake.result, /pnpm install failed \(exit 1\)/);
	assert.deepEqual(fake.ran, ["pnpm install"]);
});

test("the welcome dialog cannot be closed: said, and the task does not fail", async () => {
	const fake = start({ files: { ...aSite, "/p/site/.env": "EMDASH_ENCRYPTION_KEY=abc\n" }, answers: (url) => ({ status: url.includes("/_emdash/") ? 500 : 200 }) });
	await fake.result;
	assert.ok(fake.said.some((l) => l.includes("could not close EmDash's welcome dialog")));
});

// (the sandbox process is a thing of macOS and Linux: on Windows site:stop stops the two sites only)
test("site:stop: both sites, and only this site's own sandbox process", { skip: process.platform === "win32" }, async () => {
	const fake = fakeWorld({
		files: { ...aSite, "/p/site/node_modules/workerd": "" },
		output: () => "  11 /p/site/node_modules/.pnpm/workerd/bin/workerd serve x\n  22 /other/site/node_modules/workerd/bin/workerd serve x\n  33 /p/site/node_modules/x/bin/node serve\n",
	});
	await reach(site, "site:stop", { world: fake.world, project, flags: {} });
	assert.deepEqual(fake.ran, ["pnpm exec astro dev stop", "pnpm exec astro preview stop"]);
	assert.deepEqual(fake.killed, [11]);
});

test("site:status only looks: it says each state and the task that reaches it, and runs nothing", async () => {
	const fake = fakeWorld({ files: { ...aSite, "/p/site/node_modules": "" }, answers: () => ({ status: 0 }) });
	await reach(site, "site:status", { world: fake.world, project, flags: {} });
	assert.deepEqual(fake.ran, []);
	assert.ok(fake.said.includes("yes  a site"));
	assert.ok(fake.said.includes("yes  its packages"));
	assert.ok(fake.said.includes("no   the dev site running   — to get there: mise run site:start"));
	assert.ok(fake.said.includes("no   this machine signed in to the built site   — to get there: mise run signin:token"));
});
