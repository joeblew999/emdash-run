#!/usr/bin/env node
/**
 * Shared helpers for the scripts mise calls. Keeps each script short and means the
 * scripts can run with stdio inherited (so pitchfork can supervise them).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Run a command in the foreground; throws on a non-zero exit. */
export function run(cmd, args = [], opts = {}) {
	return execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

/** Run a shell snippet in the foreground; throws on a non-zero exit. */
export function sh(script, opts = {}) {
	return execFileSync("sh", ["-c", script], { stdio: "inherit", ...opts });
}

/** Capture stdout as a trimmed string. */
export function out(cmd, args = [], opts = {}) {
	return execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
}

/** Read a required environment variable (mise supplies these — see [env] in mise.toml). */
export function env(name) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set — run this via mise (mise run …)`);
	return value;
}

/** Read the dev admin token from the registry aggregator's .env. */
export function registryToken() {
	const envFile = `${env("EMDASH_DIR")}/apps/aggregator/.env`;
	const line = readFileSync(envFile, "utf8")
		.split("\n")
		.find((l) => l.startsWith("ADMIN_TOKEN="));
	if (!line) throw new Error(`no ADMIN_TOKEN in ${envFile} — run: mise run registry:env`);
	return line.slice("ADMIN_TOKEN=".length).trim();
}

/**
 * Read a credential from fnox, the single source of truth for secrets.
 *
 * Prefers the ambient environment, so a caller that already ran under `fnox exec` pays
 * nothing. Returns null rather than throwing when the secret is unavailable, so a caller can
 * report the gap instead of dying — a missing credential is a finding, not a crash.
 */
export function secret(name) {
	if (process.env[name]) return process.env[name];
	try {
		return out("fnox", ["exec", "--", "sh", "-c", `printf %s "$${name}"`]) || null;
	} catch {
		return null;
	}
}

/**
 * The dev server's ACTUAL database, as a path a file-based CLI can read.
 *
 * EmDash's file-based commands (`doctor`, `seed`, `export-seed`) all default to `./data.db`,
 * which a Cloudflare site never uses: the dev server reads miniflare's D1 under
 * `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`. So the default silently reports on the
 * wrong database — `emdash doctor` cheerfully announced "no users" while the real local
 * database had one, and `emdash seed` printed "Seed applied successfully" into a file the site
 * never reads.
 *
 * Returns null when there is no local D1 yet, so a caller can say so rather than guess.
 */
export function devDb() {
	const dir = join(env("SITE_DIR"), ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
	if (!existsSync(dir)) return null;
	const db = readdirSync(dir).find(
		(name) => name.endsWith(".sqlite") && name !== "metadata.sqlite",
	);
	return db ? join(dir, db) : null;
}
