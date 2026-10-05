/**
 * Query the DEPLOYED D1 from a script.
 *
 * `wrangler d1 execute --remote --json` is the only way to read a deployed EmDash database
 * from here, because the documented `wrangler d1 export --remote` refuses outright:
 *
 *   D1 Export error: cannot export databases with Virtual Tables (fts5)
 *
 * EmDash uses FTS5 for search (`_emdash_fts_pages`, `_emdash_fts_posts` plus ten shadow
 * tables), so the export command the docs prescribe for syncing a seed cannot run on any
 * EmDash site with search enabled. Per-table reads work fine, so that is what this does.
 *
 * Arguments are passed as an argv array rather than a shell string, so SQL quoting is not a
 * problem — which matters, because every earlier attempt to do this through `sh -c` broke on
 * nested quotes.
 *
 * Credentials come from fnox (`secret()`), so this needs no EmDash admin token — the
 * Cloudflare API is enough.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { env, secret } from "./exec.mjs";

const SITE_DIR = env("SITE_DIR");

/** Run one SQL statement against the deployed D1 and return its rows. */
export function queryRemote(sql, { database } = {}) {
	const db = database ?? deployedD1Name();
	const token = secret("CLOUDFLARE_API_TOKEN");
	const account = secret("CLOUDFLARE_ACCOUNT_ID");
	if (!token || !account) {
		throw new Error(
			"CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID unavailable — is fnox configured?",
		);
	}

	const stdout = execFileSync(
		"pnpm",
		["exec", "wrangler", "d1", "execute", db, "--remote", "--json", "--command", sql],
		{
			cwd: SITE_DIR,
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
			env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account },
		},
	);

	// wrangler prints human lines before the JSON array; find the array itself.
	const start = stdout.indexOf("[");
	if (start < 0) throw new Error(`no JSON in wrangler output:\n${stdout.slice(0, 400)}`);
	const parsed = JSON.parse(stdout.slice(start));
	const first = parsed[0];
	if (!first?.success)
		throw new Error(`query failed: ${JSON.stringify(first?.error ?? parsed).slice(0, 300)}`);
	return first.results ?? [];
}

/** The deployed database's name, read from the wrangler config so a rename cannot desync it. */
export function deployedD1Name() {
	const wrangler = readFileSync(`${env("ROOT")}/config/site.wrangler.jsonc`, "utf8");
	const name = /"database_name"\s*:\s*"([^"]+)"/.exec(wrangler)?.[1];
	if (!name) throw new Error("no d1_databases[].database_name in config/site.wrangler.jsonc");
	return name;
}
