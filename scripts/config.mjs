#!/usr/bin/env node
/**
 *   mise run config:apply      — write our config into .src/site, merge + validate the seed
 *
 * (Seed validation lives in scripts/seed.mjs, so it maps to the seed: namespace.)
 */
import { copyFileSync, existsSync } from "node:fs";

import { env, run } from "./lib/exec.mjs";

const ROOT = env("ROOT");
const SITE_DIR = env("SITE_DIR");
const sub = process.argv[2];

if (sub === "apply") {
	if (!existsSync(`${SITE_DIR}/package.json`)) {
		console.error("✗ .src/site is missing — run: mise run site:setup");
		process.exit(1);
	}
	copyFileSync(`${ROOT}/config/site.astro.config.mjs`, `${SITE_DIR}/astro.config.mjs`);
	copyFileSync(`${ROOT}/config/site.wrangler.jsonc`, `${SITE_DIR}/wrangler.jsonc`);
	run("node", [`${ROOT}/scripts/lib/merge-seed.mjs`]);
	// An invalid seed is skipped by EmDash with no error — fail loudly here instead.
	run("mise", ["run", "seed:validate"]);
	console.log("  ✓ config applied to .src/site");
} else {
	console.error(`config: unknown subcommand "${sub}" (apply)`);
	process.exit(1);
}
