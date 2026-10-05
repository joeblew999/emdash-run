#!/usr/bin/env node
/**
 * Shared helpers for the scripts mise calls. Keeps each script short and means the
 * scripts can run with stdio inherited (so pitchfork can supervise them).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
