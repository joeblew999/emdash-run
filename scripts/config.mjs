#!/usr/bin/env node
/**
 *   mise run config:apply      — write our config into .src/site, merge + validate the seed
 *
 * (Seed validation lives in scripts/seed.mjs, so it maps to the seed: namespace.)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { env, run } from "./lib/exec.mjs";
import { mergeSeeds } from "./lib/merge-seed.mjs";

const ROOT = env("ROOT");
const SITE_DIR = env("SITE_DIR");
const TEMPLATE = process.env.TEMPLATE ?? "starter-cloudflare";
const sub = process.argv[2];

/**
 * Merge the template's seed with ours, and write it where the site reads it.
 *
 * The merge itself is in `lib/merge-seed.mjs` and is pure, so its rules are unit-tested.
 * This is the I/O half: read two files, call it, write one.
 */
function applySeed() {
	const basePath = join(ROOT, ".src", "templates", TEMPLATE, "seed", "seed.json");
	const cadPath = join(ROOT, "config", "cad.seed.json");
	const outPath = join(SITE_DIR, "seed", "seed.json");

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
}

if (sub === "apply") {
	if (!existsSync(`${SITE_DIR}/package.json`)) {
		console.error("✗ .src/site is missing — run: mise run site:setup");
		process.exit(1);
	}
	copyFileSync(`${ROOT}/config/site.astro.config.mjs`, `${SITE_DIR}/astro.config.mjs`);
	copyFileSync(`${ROOT}/config/site.wrangler.jsonc`, `${SITE_DIR}/wrangler.jsonc`);
	applySeed();
	// An invalid seed is skipped by EmDash with no error — fail loudly here instead.
	run("mise", ["run", "seed:validate"]);
	console.log("  ✓ config applied to .src/site");
} else {
	console.error(`config: unknown subcommand "${sub}" (apply)`);
	process.exit(1);
}
