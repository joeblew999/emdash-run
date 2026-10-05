#!/usr/bin/env node
/**
 * `mise run emdash:cli -- <args>` — the emdash CLI that ships with the host site
 * (`.src/site/node_modules`), run from `.src/site` so pnpm resolves it.
 *
 * The CLI splits into two kinds of command, and they are not interchangeable:
 *
 *   LOCAL   init, doctor, seed, migrate, export-seed, secrets
 *           Work on project files or a configured database. **No `--url`.**
 *   REMOTE  types, login, logout, whoami, content, schema, media, search,
 *           taxonomy, menu, site, plugin
 *           Talk to a running instance over REST. **Take `--url`.**
 *
 * This wrapper used to append `--url http://localhost:4321` to EVERY command. That was wrong
 * both ways: local commands have no such flag (the real `export-seed` help lists only
 * `-d/--database`, `--with-content`, `--pretty`, `--media-base-url`), and hardcoding localhost
 * meant the wrapper could not reach a deployed site at all — production work had to bypass the
 * wrapper and call the CLI directly.
 *
 * The URL is now appended only for remote commands, and it comes from the environment:
 *
 *   EMDASH_URL=https://my-site.workers.dev mise run emdash:cli -- schema get parts
 *
 * Auth resolves inside the CLI: `--token`, then `EMDASH_TOKEN`, then stored `emdash login`
 * credentials, then the localhost dev bypass. So a remote instance needs either
 * `emdash login --url …` once, or a token from the admin's Settings → API Tokens.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Commands that operate on files or a database rather than on a running instance. */
const LOCAL_COMMANDS = new Set(["init", "doctor", "seed", "migrate", "export-seed", "secrets"]);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_DIR = join(ROOT, ".src", "site");
const CLI = join(SITE_DIR, "node_modules", "emdash", "dist", "cli", "index.mjs");

if (!existsSync(CLI)) {
	console.error(`emdash CLI not found at ${CLI}`);
	console.error("Run: mise run site:setup");
	process.exit(1);
}

const args = process.argv.slice(2);
const command = args[0];
const hasUrl = args.includes("--url") || args.includes("-u");

if (command && !LOCAL_COMMANDS.has(command) && !hasUrl) {
	args.push("--url", process.env.EMDASH_URL ?? process.env.SITE_URL ?? "http://localhost:4321");
}

const child = spawn(process.execPath, [CLI, ...args], { stdio: "inherit", cwd: SITE_DIR });
child.on("exit", (code) => process.exit(code ?? 0));
