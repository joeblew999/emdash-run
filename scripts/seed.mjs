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
import { readFileSync, writeFileSync } from "node:fs";

import { devDb, env, out, run } from "./lib/exec.mjs";

const ROOT = env("ROOT");
const SITE_DIR = env("SITE_DIR");
const sub = process.argv[2];

/** Identifies a field across the repo's seed and the deployed database: `collection.field`. */
const fieldKey = (collection, field) => `${collection}.${field}`;

/** Alphabetical, explicitly — `Array#sort()` without a comparator is a lint error. */
const byName = (a, b) => a.localeCompare(b);

/**
 * Run an `emdash` command and parse its JSON. Skips the task banner, and matches a LINE that
 * opens JSON so an array result is not cut into by a `{` further down inside it.
 */
function cliJson(...args) {
	const stdout = out("mise", ["run", "emdash:cli", "--", ...args]);
	const parsed = JSON.parse(stdout.slice(stdout.search(/^[{[]/m)));
	return parsed.data ?? parsed;
}

if (sub === "validate") {
	run("mise", ["run", "emdash:cli", "--", "seed", "--validate", `${SITE_DIR}/seed/seed.json`]);
} else if (sub === "apply") {
	// Apply the merged seed to the dev site's database — with the official command.
	//
	// `emdash seed` is a LOCAL command, and its `--database` accepts a path. The dev server's
	// database IS a file (miniflare's D1), so pointing `--database` at it applies the seed
	// straight to the database the site reads, and `--on-conflict=update` makes it update entries
	// that already exist rather than skipping them.
	//
	// This replaces what was here before: empty the D1's state directory, restart, and let
	// dev-bypass reseed on the first request. That worked, but it was our invention — and it
	// destroyed local content and the admin session every time. The official command does the
	// same job, updates in place, and needs no restart.
	const db = devDb();
	if (!db) {
		console.error("✗ no local D1 yet — run: mise run repo:apply");
		process.exit(1);
	}
	console.log(`→ emdash seed → ${db.replace(`${SITE_DIR}/`, "")} (on-conflict=update)`);
	run("mise", [
		"run",
		"emdash:cli",
		"--",
		"seed",
		`${SITE_DIR}/seed/seed.json`,
		"--database",
		db,
		"--on-conflict=update",
	]);
	console.log("✓ seed applied");
	console.log("  then: mise run repo:verify");
} else if (sub === "export") {
	// The official round trip: read the running site's model + content back out as a seed.
	//
	// `emdash export-seed` is a local command taking `--database`, and the dev server's database
	// is a file, so this works without any Cloudflare involvement. It writes to a separate file
	// rather than over config/cad.seed.json: that one is hand-maintained and is the source of
	// truth, so overwriting it with an export would turn a review into a replacement.
	const db = devDb();
	if (!db) {
		console.error("✗ no local D1 yet — run: mise run repo:apply");
		process.exit(1);
	}
	const dest = `${ROOT}/config/seed.live.json`;
	writeFileSync(
		dest,
		out("mise", ["run", "emdash:cli", "--", "export-seed", "--database", db, "--with-content=all"]),
	);
	console.log(`✓ exported the live model → ${dest.replace(`${ROOT}/`, "")}`);
	console.log("  compare it with config/cad.seed.json — it is not written over it on purpose.");
} else if (sub === "from-remote") {
	// Compare the DEPLOYED content model against ours — through the official CLI.
	//
	// This used to query D1 directly with hand-rolled SQL, because `wrangler d1 export` cannot run
	// on EmDash at all (FTS5 virtual tables). But `emdash schema` is the documented way to read a
	// live content model, needs no Cloudflare credentials, and works against a remote instance —
	// so the SQL is gone, and with it `scripts/lib/d1.mjs`.
	//
	// Target the deployed site with EMDASH_URL=https://… ; it defaults to the local one.
	//
	// Read-only: it reports drift and writes nothing. Writing a seed only becomes correct once the
	// deployed site is AHEAD of the repo.
	const ours = JSON.parse(readFileSync(`${ROOT}/config/cad.seed.json`, "utf8"));

	const listed = cliJson("schema", "list", "--json");
	const remoteSlugs = (listed.items ?? listed.collections ?? listed).map((c) => c.slug);

	const remote = new Map();
	for (const slug of remoteSlugs) {
		for (const f of cliJson("schema", "get", slug, "--json").fields ?? []) {
			remote.set(fieldKey(slug, f.slug), f.type);
		}
	}

	const local = new Map();
	for (const c of ours.collections) {
		for (const f of c.fields ?? []) local.set(fieldKey(c.slug, f.slug), f.type);
	}

	const onlyLocal = [...local.keys()].filter((k) => !remote.has(k)).toSorted(byName);
	const onlyRemote = [...remote.keys()].filter((k) => !local.has(k)).toSorted(byName);
	const typeDiff = [...local.keys()]
		.filter((k) => remote.has(k) && remote.get(k) !== local.get(k))
		.map((k) => `${k}: repo=${local.get(k)} deployed=${remote.get(k)}`);

	const localSlugs = ours.collections.map((c) => c.slug);

	console.log(`  deployed: ${remoteSlugs.length} collections, ${remote.size} fields`);
	console.log(`  repo:     ${localSlugs.length} collections, ${local.size} fields`);
	console.log(
		`  collections only in the repo:     ${localSlugs.filter((s) => !remoteSlugs.includes(s)).join(", ") || "none"}`,
	);
	console.log(
		`  collections only deployed:        ${remoteSlugs.filter((s) => !localSlugs.includes(s)).join(", ") || "none"}`,
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
