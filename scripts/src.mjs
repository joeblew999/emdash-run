#!/usr/bin/env node
/**
 * `mise run src:clone:templates` | `mise run src:clone:emdash`
 *
 * Clones/updates the gitignored checkouts under .src/. Templates are always needed;
 * the emdash monorepo is optional (reading EmDash source, running the local registry).
 */
import { existsSync, mkdirSync } from "node:fs";

import { env, out, run } from "./lib/exec.mjs";

const SRC_DIR = env("SRC_DIR");
mkdirSync(SRC_DIR, { recursive: true });

const target = process.argv[2];

if (target === "templates") {
	const dir = env("TEMPLATES_DIR");
	if (existsSync(`${dir}/.git`)) {
		run("git", ["-C", dir, "fetch", "--depth", "1", "origin", "main"]);
		run("git", ["-C", dir, "checkout", "-q", "FETCH_HEAD"]);
	} else {
		run("git", ["clone", "--depth", "1", env("TEMPLATES_REPO"), dir]);
	}
	console.log(`  ✓ templates @ ${out("git", ["-C", dir, "rev-parse", "--short", "HEAD"])}`);
} else if (target === "emdash") {
	const dir = env("EMDASH_DIR");
	const tag = `emdash@${env("EMDASH_VERSION")}`;
	if (existsSync(`${dir}/.git`)) {
		run("git", ["-C", dir, "fetch", "--depth", "1", "origin", `refs/tags/${tag}`]);
		run("git", ["-C", dir, "checkout", "-q", "FETCH_HEAD"]);
	} else {
		run("git", ["clone", "--depth", "1", "--branch", tag, env("EMDASH_REPO"), dir]);
	}
	console.log(`  ✓ emdash @ ${tag} → ${dir}`);
} else {
	console.error(`src: unknown target "${target}" — expected "templates" or "emdash"`);
	process.exit(1);
}
