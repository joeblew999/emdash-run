#!/usr/bin/env node
/**
 * `mise run site:build | site:deploy:dry | site:deploy`
 *
 * A production build leaves .vite/.astro in a state `astro dev` cannot reuse (stale
 * `deps_ssr` URLs → 500s on admin routes), so always clean up afterwards and tell the
 * user to restart the dev server.
 */
import { rmSync } from "node:fs";

import { env, run } from "./lib/exec.mjs";

const SITE_DIR = env("SITE_DIR");
const sub = process.argv[2];

let rc = 0;
try {
	if (sub === "build") {
		run("pnpm", ["build"], { cwd: SITE_DIR });
	} else if (sub === "dry") {
		run("pnpm", ["build"], { cwd: SITE_DIR });
		run("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--outdir", "dist"], { cwd: SITE_DIR });
	} else if (sub === "deploy") {
		// Cloudflare creds come from fnox (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).
		run("fnox", ["exec", "--", "pnpm", "run", "deploy"], { cwd: SITE_DIR });
	} else {
		console.error(`build: unknown subcommand "${sub}" (build|dry|deploy)`);
		process.exit(1);
	}
} catch (error) {
	rc = 1;
	console.error(error instanceof Error ? error.message : String(error));
} finally {
	rmSync(`${SITE_DIR}/node_modules/.vite`, { recursive: true, force: true });
	rmSync(`${SITE_DIR}/.astro`, { recursive: true, force: true });
}

if (rc === 0) console.log("→ dev server needs a restart: mise run apply");
process.exit(rc);
