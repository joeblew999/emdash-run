#!/usr/bin/env node
/**
 * `mise run seed:validate` — validate the merged site seed.
 * `mise run seed:apply`    — get the seed into the RUNNING dev site.
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
import { rmSync } from "node:fs";

import { env, run, sh } from "./lib/exec.mjs";

const SITE_DIR = env("SITE_DIR");
const SITE_URL = env("SITE_URL");
const sub = process.argv[2];

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
} else {
	console.error(`seed: unknown subcommand "${sub}" (validate|apply)`);
	process.exit(1);
}
