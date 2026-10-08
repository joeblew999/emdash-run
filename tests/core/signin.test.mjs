// signin:token (scripts/core/signin.mjs): which site it stands on, and what it writes.
import assert from "node:assert/strict";
import { test } from "node:test";

import { plan, reach } from "../../scripts/core/graph.mjs";
import { graph } from "../../scripts/core/cli.mjs";
import { savedName, tokenSql } from "../../scripts/core/signin.mjs";
import { fakeWorld, project } from "./fake-world.mjs";

// a site whose build was made from the config and packages it has now (dist/.built-from holds what they held)
const built = { "/p/site/package.json": "{}", "/p/site/.env": "EMDASH_ENCRYPTION_KEY=k\n", "/p/site/dist/.built-from": "||{}||||EMDASH_ENCRYPTION_KEY=k\n" };
const fresh = { "/p/site/dist/server": 2, "/p/site/src": 1 }; // the build is newer than what it is made from // the build is newer than what it is made from

test("this machine: it stands on the built site, running", () => {
	assert.deepEqual(plan(graph, "signin:token"), ["site:exists", "site:installed", "site:key", "site:built", "site:built-running", "signin:token"]);
});
test("--live: it stands on the deployed site answering, and builds and starts nothing here", () => {
	assert.deepEqual(plan(graph, "signin:token", { live: true }), ["live:set", "site:exists", "live:answers", "signin:token"]);
});

test("the SQL: an administrator, the site set up, one token per machine — safe to run again", () => {
	const sql = tokenSql({ email: "o'neil@x.test", name: "Site Admin", origin: "http://localhost:4322", tokenName: "emdash-run:m", hash: "H", prefix: "ec_pat_RAW", ids: ["A", "B"], now: "T" });
	assert.match(sql, /INSERT INTO users .* WHERE NOT EXISTS \(SELECT 1 FROM users WHERE email = 'o''neil@x\.test'\)/);
	assert.match(sql, /'emdash:setup_complete', 'true'/);
	assert.match(sql, /DELETE FROM _emdash_api_tokens WHERE name = 'emdash-run:m'; INSERT INTO _emdash_api_tokens/);
	assert.ok(!sql.includes("ec_pat_RAW_"), "only the token's prefix and hash are written, never the token");
});

test("a saved token is named after the site: a deployed host, or this machine's port and folder", () => {
	assert.equal(savedName("https://my.site.dev/x", "/p/site"), "my.site.dev");
	assert.match(savedName("http://localhost:4322", "/p/site"), /^localhost_4322_[0-9a-f]{10}$/);
	assert.notEqual(savedName("http://localhost:4322", "/p/site"), savedName("http://localhost:4322", "/q/site"));
});

test("a Node site, built and running: the SQL goes to its database file, the token is saved, nothing is built or started", async () => {
	const fake = fakeWorld({ files: { ...built }, changed: fresh, answers: () => ({ status: 200 }) });
	const result = await reach(graph, "signin:token", { world: fake.world, project, flags: {} });
	assert.deepEqual(result.did, ["site:installed", "signin:token"]);
	assert.deepEqual(fake.ran, ["pnpm install"]); // (this made-up site has no record of an install)
	assert.equal(fake.sqls[0].file, "/p/site/data.db");
	const saved = JSON.parse(Object.entries(fake.files).find(([f]) => f.startsWith("/config/emdash-run/tokens/"))?.[1] ?? "{}");
	assert.deepEqual(saved, { url: "http://localhost:4322", token: "ec_pat_RAW" });
	assert.ok(fake.said.some((l) => l.includes("agent@emdash.local is an administrator of http://localhost:4322")));
});

test("the build is older than the source: it is built again, and the built site started again", async () => {
	const fake = fakeWorld({ files: { ...built }, changed: { "/p/site/dist/server": 1, "/p/site/src": 2 }, answers: () => ({ status: 200 }) });
	const result = await reach(graph, "signin:token", { world: fake.world, project, flags: {} });
	assert.deepEqual(result.did, ["site:installed", "site:built", "site:built-running", "signin:token"]);
	assert.deepEqual(fake.ran.slice(1), ["astro preview stop", "astro build", "astro preview stop", "astro preview --background --host 127.0.0.1 --port 4322"]);
});

test("a Cloudflare site: wrangler writes it; 'no such table' is asked again, another refusal is the reason given", async () => {
	const files = { ...built, "/p/site/wrangler.jsonc": "{}", "/p/site/node_modules/wrangler/package.json": '{"bin":{"wrangler":"bin/wrangler.js"}}' };
	let asked = 0;
	const again = fakeWorld({ files: { ...files }, changed: fresh, answers: () => ({ status: 200 }), execs: () => (++asked < 3 ? { code: 1, err: "no such table: users" } : { code: 0 }) });
	await reach(graph, "signin:token", { world: again.world, project, flags: {} });
	assert.equal(again.execd.length, 3);
	assert.match(again.execd[0], /wrangler\.js d1 execute DB --local --yes --command INSERT INTO users/);
	const refused = fakeWorld({ files: { ...files }, changed: fresh, answers: () => ({ status: 200 }), execs: () => ({ code: 1, err: "not authorised" }) });
	await assert.rejects(reach(graph, "signin:token", { world: refused.world, project, flags: {} }), /the database refused it[\s\S]*not authorised/);
	assert.equal(refused.execd.length, 1);
});

test("ADMIN_EMAIL is used and never printed", async () => {
	const fake = fakeWorld({ files: { ...built }, changed: fresh, answers: () => ({ status: 200 }) });
	await reach(graph, "signin:token", { world: fake.world, project, flags: {}, env: { ADMIN_EMAIL: "owner@private.test" } });
	assert.ok(fake.sqls[0].sql.includes("owner@private.test"));
	assert.ok(!fake.said.join("\n").includes("owner@private.test"));
});

test("a build with only its client half is not a build: it is built again", async () => {
	const fake = fakeWorld({ files: { ...built }, changed: { "/p/site/dist/client": 9, "/p/site/src": 1 }, answers: () => ({ status: 200 }) });
	const result = await reach(graph, "site:built", { world: fake.world, project, flags: {} });
	assert.ok(result.did.includes("site:built"));
	assert.ok(fake.ran.includes("astro build"));
});
