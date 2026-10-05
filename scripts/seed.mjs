#!/usr/bin/env node
/**
 * `mise run seed:validate` — validate the merged site seed.
 * `mise run seed:apply`    — get the seed into the RUNNING dev site.
 * `mise run seed:from-remote` — diff the DEPLOYED site's content model against ours.
 *
 * EmDash silently skips an invalid seed (no error, no collections), so `validate` fails
 * loudly instead. `config:apply` runs it after merging.
 *
 * `apply` exists because validating is not applying, and there was no apply:
 *
 *   `emdash seed <file>` writes a FILE database (`-d/--database`, default `./data.db`), and
 *   the dev server does not read that file — it reads miniflare's D1 under
 *   `.wrangler/state/v3/d1`. So seeding the file changes nothing the site can see, and it
 *   reports success while doing it ("Content: 11 created", "✔ Seed applied successfully").
 *
 *   `repo:apply` does apply the seed, via dev-bypass on the first request — but with
 *   skip-on-conflict, so an entry that already exists is left alone. New seed content lands;
 *   EDITS to existing content never do. That is the real trap: change a part's data, run
 *   `repo:apply`, and the admin keeps showing the old values with no error anywhere.
 *
 * So picking up content edits requires emptying the D1 and letting EmDash rebuild it. This
 * does that. It is destructive to local state — content edited through the admin, and the
 * admin session itself, are discarded.
 */
import { rmSync, readFileSync } from "node:fs";

import { env, run, sh } from "./lib/exec.mjs";

const ROOT = env("ROOT");
const SITE_DIR = env("SITE_DIR");
const SITE_URL = env("SITE_URL");
const sub = process.argv[2];

/** Identifies a field across the repo's seed and the deployed database: `collection.field`. */
const fieldKey = (collection, field) => `${collection}.${field}`;

/** Alphabetical, explicitly — `Array#sort()` without a comparator is a lint error. */
const byName = (a, b) => a.localeCompare(b);

if (sub === "validate") {
	run("mise", ["run", "emdash:cli", "--", "seed", "--validate", `${SITE_DIR}/seed/seed.json`]);
} else if (sub === "apply") {
	console.log("→ emptying the local D1 (the seed CLI writes data.db, which the site never reads)");
	sh("pitchfork stop emdash || true");
	rmSync(`${SITE_DIR}/.wrangler/state`, { recursive: true, force: true });

	// repo:apply restarts the site and polls dev-bypass, which migrates and re-applies the seed.
	run("mise", ["run", "repo:apply"]);

	// That poll is a server-side POST, so it cannot set the BROWSER's session cookie. The D1
	// it just replaced held the old sessions, so any open admin tab is now signed out. Say
	// so, and hand over the URL that signs in — otherwise the first thing you see after a
	// successful seed is a login page, and it reads as a failure.
	console.log("✓ seed applied");
	console.log("  the D1 was replaced, so your admin session is gone. Sign in again at:");
	console.log(`  ${SITE_URL}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`);
	console.log("  then: mise run repo:verify");
} else if (sub === "from-remote") {
	// Compare the DEPLOYED site's content model against ours.
	//
	// The docs' recipe for this (`wrangler d1 export --remote`) cannot run on EmDash — FTS5
	// virtual tables — so the model is read back with targeted queries instead. Read-only:
	// this reports drift, it does not write a seed. Writing one is only correct once the
	// deployed site is AHEAD of the repo, and it is not (production has no model_id).
	const { queryRemote } = await import("./lib/d1.mjs");

	const remoteCollections = queryRemote(
		"SELECT slug, label FROM _emdash_collections ORDER BY slug",
	);
	const remoteFields = queryRemote(
		"SELECT c.slug AS collection, f.slug AS field, f.type AS type FROM _emdash_fields f " +
			"JOIN _emdash_collections c ON c.id = f.collection_id ORDER BY c.slug, f.sort_order",
	);

	const ours = JSON.parse(readFileSync(`${ROOT}/config/cad.seed.json`, "utf8"));

	const remote = new Map(remoteFields.map((r) => [fieldKey(r.collection, r.field), r.type]));
	const local = new Map();
	for (const c of ours.collections) {
		for (const f of c.fields ?? []) local.set(fieldKey(c.slug, f.slug), f.type);
	}

	const onlyLocal = [...local.keys()].filter((k) => !remote.has(k)).toSorted(byName);
	const onlyRemote = [...remote.keys()].filter((k) => !local.has(k)).toSorted(byName);
	const typeDiff = [...local.keys()]
		.filter((k) => remote.has(k) && remote.get(k) !== local.get(k))
		.map((k) => `${k}: repo=${local.get(k)} deployed=${remote.get(k)}`);

	const remoteSlugs = new Set(remoteCollections.map((c) => c.slug));
	const localSlugs = ours.collections.map((c) => c.slug);

	console.log(`  deployed: ${remoteCollections.length} collections, ${remoteFields.length} fields`);
	console.log(`  repo:     ${localSlugs.length} collections, ${local.size} fields`);
	console.log(
		`  collections only in the repo:     ${localSlugs.filter((s) => !remoteSlugs.has(s)).join(", ") || "none"}`,
	);
	console.log(
		`  collections only deployed:        ${[...remoteSlugs].filter((s) => !localSlugs.includes(s)).join(", ") || "none"}`,
	);

	if (onlyLocal.length || onlyRemote.length || typeDiff.length) {
		console.log("\n  drift:");
		for (const k of onlyLocal) console.log(`    missing from the deployed site: ${k}`);
		for (const k of onlyRemote) console.log(`    only on the deployed site:      ${k}`);
		for (const d of typeDiff) console.log(`    type differs:                   ${d}`);
		console.log("\n  the deployed site is behind. Evolve it with `emdash schema` — not a seed.");
	} else {
		console.log("\n  ✓ the deployed content model matches the repo's seed");
	}
} else {
	console.error(`seed: unknown subcommand "${sub}" (validate|apply)`);
	process.exit(1);
}
