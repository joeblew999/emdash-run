#!/usr/bin/env node
/**
 * emdash.mjs
 *
 * Runs the emdash CLI that ships with the host site (.src/site/node_modules),
 * pointed at the local dev server. Appends --url after user args so the CLI
 * parses them correctly.
 *
 * Usage: node scripts/emdash.mjs content list projects
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_DIR = join(ROOT, ".src", "site");
const CLI = join(SITE_DIR, "node_modules", "emdash", "dist", "cli", "index.mjs");

if (!existsSync(CLI)) {
	console.error(`emdash CLI not found at ${CLI}`);
	console.error("Run: mise run site:setup");
	process.exit(1);
}

const args = [...process.argv.slice(2), "--url", process.env.SITE_URL ?? "http://localhost:4321"];

const child = spawn(process.execPath, [CLI, ...args], {
	stdio: "inherit",
	cwd: SITE_DIR,
});
child.on("exit", (code) => process.exit(code ?? 0));
