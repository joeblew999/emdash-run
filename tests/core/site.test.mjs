// The site's states (scripts/core/site.mjs), each with a made-up outside: what it runs, in what
// order, and when it does nothing.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { reach } from "../../scripts/core/graph.mjs";
import { lockCovers, site } from "../../scripts/core/site.mjs";
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
		"emdash secrets generate --write .env",
		"astro dev --background --host 127.0.0.1 --port 4321",
		`${process.execPath} ${join("/emdash-run/scripts", "emdash.mjs")} http://localhost:4321 /p/site schema list`,
	]);
	assert.deepEqual(result.skipped, ["site:exists"]);
	assert.ok(fake.said.includes("welcome: EmDash's welcome dialog is closed for the dev user"));
});

test("packages installed from this lockfile: pnpm is not asked. A lockfile that changed: it is", async () => {
	const running = { answers: (/** @type {string} */ url) => ({ status: 200, text: url.includes("dev-bypass") ? '{"token":"t"}' : "" }) };
	const lock = "importers:\n  .:\n    dependencies:\n      astro:\n        specifier: ^7.3.5\n        version: 7.3.6\n      '@emdash-cms/cloudflare':\n        specifier: 1.2.0\n        version: 1.2.0\n";
	const pkg = '{"dependencies":{"astro":"^7.3.5","@emdash-cms/cloudflare":"1.2.0"}}';
	assert.equal(lockCovers(pkg, lock), true);
	assert.equal(lockCovers('{"dependencies":{"astro":"^7.3.5","added-by-hand":"1.0.0"}}', lock), false, "a package the lockfile does not have");
	assert.equal(lockCovers('{"dependencies":{"astro":"^8.0.0"}}', lock), false, "asked for differently than it was installed");
	const installed = { ...aSite, "/p/site/package.json": pkg, "/p/site/.env": "EMDASH_ENCRYPTION_KEY=abc\n", "/p/site/pnpm-lock.yaml": lock, "/p/site/node_modules/.pnpm/lock.yaml": lock };
	const fake = fakeWorld({ files: { ...installed }, ...running });
	await reach(site, "site:start", { world: fake.world, project, flags: {} });
	assert.ok(!fake.ran.includes("pnpm install"));
	const stale = fakeWorld({ files: { ...installed, "/p/site/node_modules/.pnpm/lock.yaml": "an older lock" }, ...running });
	await reach(site, "site:start", { world: stale.world, project, flags: {} });
	assert.ok(stale.ran.includes("pnpm install"));
});

test("a dev site that answers 500 is not running: it is stopped and started again", async () => {
	let started = false;
	/** @type {string[]} */
	let ran = [];
	const fake = fakeWorld({
		files: { ...aSite, "/p/site/.env": "EMDASH_ENCRYPTION_KEY=abc\n" },
		answers: (url) => ({ status: (started ||= ran.some((c) => c.includes("astro dev --background"))) ? 200 : 500, text: url.includes("dev-bypass") ? '{"token":"t"}' : "" }),
	});
	ran = fake.ran;
	const result = await reach(site, "site:start", { world: fake.world, project, flags: {} });
	assert.ok(result.did.includes("site:dev-running"));
	assert.ok(fake.ran.indexOf("astro dev stop") < fake.ran.indexOf("astro dev --background --host 127.0.0.1 --port 4321"));
});

test("the dev site dies on start: its own log is shown, and the task fails", async () => {
	const fake = start({ files: { ...aSite }, exits: (c) => (c.includes("astro dev --background") ? 1 : 0) });
	await assert.rejects(fake.result, /the dev site did not start/);
	assert.equal(fake.ran.at(-1), "astro dev logs");
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
	assert.deepEqual(fake.ran, ["astro dev stop", "astro preview stop"]);
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
