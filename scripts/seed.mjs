#!/usr/bin/env node
/**
 * `mise run seed:validate` — validate the merged site seed.
 *
 * EmDash silently skips an invalid seed (no error, no collections), so this fails loudly
 * instead. `config:apply` runs it after merging.
 */
import { env, run } from "./lib/exec.mjs";

const SITE_DIR = env("SITE_DIR");
const sub = process.argv[2];

if (sub === "validate") {
	run("mise", ["run", "emdash:cli", "--", "seed", "--validate", `${SITE_DIR}/seed/seed.json`]);
} else {
	console.error(`seed: unknown subcommand "${sub}" (validate)`);
	process.exit(1);
}
