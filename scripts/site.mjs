#!/usr/bin/env node
/**
 * `mise run site:build | site:deploy-dry | site:deploy`
 *
 * Only the subcommands with real logic live here. `sync`, `install`, `reset`, `clean`, `regen`,
 * `doctor`, `migrate` and `check` were one-line relays to `cp`, `rm`, `pnpm` and `emdash doctor`;
 * they are written directly as tasks in mise.toml now, in nushell, because a script that only
 * dispatches to a shell line is a layer mise already provides.
 */
import { rmSync } from "node:fs";

import { env, out, run, sh } from "./lib/exec.mjs";

const SITE_DIR = env("SITE_DIR");
const sub = process.argv[2];

/** Is the dev-server daemon currently running? Parsed per line, so `disabled` cannot match. */
function devServerRunning() {
	try {
		return out("pitchfork", ["list"])
			.split("\n")
			.some((line) => line.trim().startsWith("emdash-run/emdash") && line.includes("running"));
	} catch {
		return false;
	}
}

function build(mode) {
	// A production build must use the HOSTED registry, so drop the dev override set in
	// mise.toml's [env].
	delete process.env.EMDASH_REGISTRY_URL;

	// Building in .src/site re-runs the Vite optimizer, which re-hashes the `deps_ssr/*?v=…` URLs
	// the RUNNING dev server is already serving. Clearing the on-disk caches is not enough — the
	// server holds the stale module graph in memory and starts returning 500s ("The file does not
	// exist at .../deps_ssr/…"). So stop it first, and put it back afterwards. This is the same
	// hazard `site:check` handles, and the reason `repo:apply` clears .vite.
	const wasRunning = devServerRunning();
	if (wasRunning) sh("pitchfork stop emdash || true");

	let rc = 0;
	try {
		if (mode === "build") {
			run("pnpm", ["build"], { cwd: SITE_DIR });
		} else if (mode === "deploy-dry") {
			run("pnpm", ["build"], { cwd: SITE_DIR });
			run("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--outdir", "dist"], {
				cwd: SITE_DIR,
			});
		} else {
			// Cloudflare creds come from fnox (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).
			run("fnox", ["exec", "--", "pnpm", "run", "deploy"], { cwd: SITE_DIR });
		}
	} catch (error) {
		rc = 1;
		console.error(error instanceof Error ? error.message : String(error));
	} finally {
		// A production build leaves .vite/.astro in a state `astro dev` cannot reuse
		// (stale deps_ssr URLs → 500s), so clean up either way.
		rmSync(`${SITE_DIR}/node_modules/.vite`, { recursive: true, force: true });
		rmSync(`${SITE_DIR}/.astro`, { recursive: true, force: true });
		if (wasRunning) {
			console.log("  → restarting the dev server (the build invalidated its module graph)");
			run("pitchfork", ["start", "emdash"]);
		}
	}
	if (rc === 0) console.log("→ dev server needs a restart: mise run repo:apply");
	process.exit(rc);
}

switch (sub) {
	case "build":
	case "deploy-dry":
	case "deploy":
		build(sub);
		break;
	default:
		console.error(`site: unknown subcommand "${sub}" (build|deploy-dry|deploy)`);
		process.exit(1);
}
