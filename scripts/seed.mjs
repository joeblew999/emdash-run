#!/usr/bin/env node
/**
 * `mise run seed:build`       — merge the template's seed with ours → .src/site/seed/seed.json
 * `mise run seed:validate`    — validate the merged seed.
 * `mise run seed:apply`       — get the seed into the RUNNING dev site.
 * `mise run seed:export`      — read the running site's model + content back out.
 * `mise run seed:from-remote` — diff the DEPLOYED site's content model against ours.
 *
 * Build and validate are separate on purpose: EmDash silently skips an invalid seed (no error,
 * no collections), so `build` writes one and `validate` fails loudly about it afterward.
 *
 * `apply` exists because validating is not applying. `emdash seed <file>` writes a FILE
 * database (`-d/--database`, default `./data.db`), and the dev server does not read that file —
 * it reads miniflare's D1 under `.wrangler/state/v3/d1`. So seeding the default changes nothing
 * the site can see, and reports success while doing it ("Content: 11 created", "✔ Seed applied
 * successfully"). Pointing `--database` at the real D1 is what makes it land.
 *
 * With `--on-conflict=update` the official command updates entries in place, so this is no longer
 * the destructive rebuild it once was: local content and the admin session survive.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { devDb, env, out, run } from "./lib/exec.mjs";
import { mergeSeeds } from "./lib/merge-seed.mjs";

const ROOT = env("ROOT");
const SITE_DIR = env("SITE_DIR");
const TEMPLATE = process.env.TEMPLATE ?? "starter-cloudflare";
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

if (sub === "build") {
	// Merge the template's seed with ours, and write it where the site reads it. The merge rules
	// are pure and live in lib/merge-seed.mjs so they can be unit-tested — this is the I/O half.
	const basePath = `${ROOT}/.src/templates/${TEMPLATE}/seed/seed.json`;
	const cadPath = `${ROOT}/config/cad.seed.json`;
	const outPath = `${SITE_DIR}/seed/seed.json`;

	for (const path of [basePath, cadPath]) {
		if (!existsSync(path)) {
			console.error(`✗ missing ${path} — run: mise run site:setup`);
			process.exit(1);
		}
	}

	const merged = mergeSeeds(
		JSON.parse(readFileSync(basePath, "utf8")),
		JSON.parse(readFileSync(cadPath, "utf8")),
	);

	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, `${JSON.stringify(merged, null, "\t")}\n`);

	const entries = Object.values(merged.content).reduce((total, list) => total + list.length, 0);
	console.log(
		`  ✓ seed → .src/site/seed/seed.json (${merged.collections.length} collections, ${entries} entries)`,
	);
} else if (sub === "validate") {
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
	console.error(`seed: unknown subcommand "${sub}" (build|validate|apply|export|from-remote)`);
	process.exit(1);
}
