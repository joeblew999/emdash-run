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
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
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

// `mise run emdash:help` reaches `emdash --help`, and `mise run emdash:help -- content` reaches
// `emdash content --help`. `help` is not a subcommand, so translate it before anything else.
if (args[0] === "help") {
	const rest = args.slice(1);
	exec(rest.length === 0 ? ["--help"] : [...rest, "--help"]);
} else {
	const command = args[0];
	const hasUrl = args.includes("--url") || args.includes("-u");
	const url = process.env.EMDASH_URL ?? process.env.SITE_URL ?? "http://localhost:4321";

	if (command && !LOCAL_COMMANDS.has(command) && !hasUrl) {
		args.push("--url", url);
	}

	// Work around a bug in emdash 1.1.0's CLI: it does not send the credential that `emdash login`
	// saved, so every remote command fails with "Token is invalid or expired" while the very same
	// token works against the same URL with `curl`. Verified both ways: curl 200 with real data,
	// CLI rejected, same token, same URL, same minute.
	//
	// The token is fine; only the CLI's stored-credential lookup is broken. Passing it explicitly
	// takes the CLI's own documented first choice (`--token`), so this feeds the official tool its
	// own credential rather than replacing anything it does. A shim with an expiry: delete it when
	// the CLI reads its own credentials.
	const wantsToken =
		command && !LOCAL_COMMANDS.has(command) && !args.includes("--token") && !args.includes("-t");
	if (wantsToken) {
		const stored = readStoredToken(url);
		if (stored) args.push("--token", stored);
	}

	exec(args);
}

/** Run the CLI with `argv` and exit with its status. Declared, so it hoists above its uses. */
function exec(argv) {
	const child = spawn(process.execPath, [CLI, ...argv], { stdio: "inherit", cwd: SITE_DIR });
	child.on("exit", (code) => process.exit(code ?? 0));
}

/**
 * Read the token `emdash login` stored for `targetUrl`, from `~/.config/emdash/auth.json`.
 * The file is keyed by instance URL: `{ "<url>": { accessToken, refreshToken, … } }`.
 * Returns null rather than throwing, so a missing or malformed file just means "no token" and
 * the CLI falls back to its own resolution — the dev bypass still works with no credentials.
 */
function readStoredToken(targetUrl) {
	try {
		const path = join(homedir(), ".config", "emdash", "auth.json");
		const entry = JSON.parse(readFileSync(path, "utf8"))[targetUrl];
		return entry?.accessToken ?? null;
	} catch {
		return null;
	}
}
