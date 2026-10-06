/**
 * `repo:verify` — assert the RUNNING site is in the state this repo claims.
 *
 * Every check here exists because the opposite happened, and nothing said so:
 *
 *   - the seed pointed at model paths (`cad/parts/mp-002.step`) that exist in no bucket,
 *     and carried vertices/volume/watertight values nothing could source;
 *   - `brep_file` / `step_file` were declared on every entry and `null` on every entry;
 *   - `emdash seed` printed "Seed applied successfully" into a database the site never reads;
 *   - `repo:apply` re-applied the seed with skip-on-conflict, so edits to existing entries
 *     never landed and the admin kept showing the old values.
 *
 * `plugin:audit` checks the FILES are coherent. This checks the LIVE state agrees with them,
 * which is the part that was missing: every file can be right while the running site is wrong.
 *
 * The R2 checks are the centrepiece — they follow each part's `model_id` to the real object in
 * the geometry bucket and compare it against the stored snapshot. That is what would have
 * caught the fiction on its first run rather than six commits later.
 *
 * Those checks need CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID. Without them the script
 * reports the gap as a failure rather than passing quietly.
 *
 * Env knobs: GEOMETRY_BUCKET (default `cad-documents`), VERIFY_MODEL_LIMIT (default 5).
 */
import { env, out, secret } from "./exec.mjs";

/**
 * Run an `emdash` command and parse its JSON, skipping the task banner. Returns the RAW parsed
 * value: the envelopes differ per command (`content list` wraps its items in `data`, while
 * `content get` IS the entry, with its own `data` holding the field values), so unwrapping here
 * would silently hand back the wrong level.
 */
function cliJson(...args) {
	const stdout = out("mise", ["run", "emdash:cli", "--", ...args]);
	return JSON.parse(stdout.slice(stdout.search(/^[{[]/m)));
}

export async function verify() {
	const SITE_URL = env("SITE_URL");

	const ACCOUNT = secret("CLOUDFLARE_ACCOUNT_ID");
	const TOKEN = secret("CLOUDFLARE_API_TOKEN");
	const BUCKET = process.env.GEOMETRY_BUCKET ?? "cad-documents";

	const results = [];
	const record = (ok, label, detail = "") => {
		results.push({ ok, label, detail });
		console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
	};

	// ── 1. the site answers at all ────────────────────────────────────────────
	// Retried, deliberately. `config:apply` writes files Vite watches (`astro.config.mjs`,
	// `wrangler.jsonc`, `seed/seed.json`), so the dev server restarts underneath you and a
	// verify run straight afterwards races it. A single attempt reports "fetch failed" for
	// what is really "not ready yet" — the kind of false alarm that teaches people to ignore
	// the check. The site binds IPv6-only (`[::1]:4321`), so `localhost` is the right host.
	let siteUp = false;
	let lastError = "";
	const deadline = Date.now() + 20_000;
	for (;;) {
		try {
			const res = await fetch(SITE_URL, { redirect: "manual" });
			siteUp = res.status < 500;
			record(siteUp, "site responds", `${res.status}`);
			break;
		} catch (error) {
			lastError = error.message;
			if (Date.now() >= deadline) {
				record(false, "site responds", `${lastError} — gave up after 20s`);
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	if (!siteUp) {
		console.log("\n✗ the site is not up — run: mise run repo:apply");
		process.exit(1);
	}

	// ── 2. read the content through the official CLI ──────────────────────────
	//
	// This used to fetch `/_emdash/api/content/parts` with a token read out of
	// run/token-admin.txt. `emdash content list` is the documented way to read content from an
	// instance and it resolves auth itself, so the raw endpoint and the hand-held token both go.
	//
	// It reads the running site — the local one by default, or a deployment when EMDASH_URL is
	// set, which makes this the same command that can check production.
	let parts = [];
	try {
		const listed = cliJson("content", "list", "parts", "--json").items ?? [];
		// `content list` is slim — it carries no `data`. The checks below need field values, so each
		// entry is fetched with `content get`. That matters more than it looks: with the slim list,
		// every part had `data === undefined`, so nothing resolved and nothing mismatched — the R2
		// checks PASSED VACUOUSLY. A check that passes because it read nothing is worse than one
		// that fails, so the guard below also asserts the data actually arrived.
		parts = listed.map((item) => cliJson("content", "get", "parts", item.slug, "--json"));
		const withData = parts.filter((part) => part.data).length;
		record(
			withData === parts.length && withData > 0,
			"content get returns data",
			`${withData} of ${parts.length} entries`,
		);
	} catch (error) {
		record(false, "content get returns data", String(error.message).slice(0, 90));
	}

	if (parts.length > 0) {
		// ── 3 + 4. resolve every model_id, then compare the stored snapshot ──
		if (!ACCOUNT || !TOKEN) {
			const missing = !ACCOUNT ? "CLOUDFLARE_ACCOUNT_ID" : "CLOUDFLARE_API_TOKEN";
			record(false, "R2 cross-check", `cannot run: ${missing} is unset`);
		} else {
			const limit = Number(process.env.VERIFY_MODEL_LIMIT ?? 5);
			const samples = parts.slice(0, limit);

			const missingJoin = parts.filter((part) => !part.data?.model_id).map((part) => part.slug);
			record(
				missingJoin.length === 0,
				"every part declares a model_id",
				missingJoin.join(", ") || `${parts.length} parts`,
			);

			const unresolved = [];
			const drift = [];

			for (const part of samples) {
				const id = part.data?.model_id;
				if (!id) continue;

				const manifestRes = await fetch(
					`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/models/${id}/manifest.json`,
					{ headers: { Authorization: `Bearer ${TOKEN}` } },
				);
				if (!manifestRes.ok) {
					unresolved.push(`${id} (${manifestRes.status})`);
					continue;
				}

				const manifest = await manifestRes.json();
				const snap = part.data?.geometry_meta ?? {};

				// The snapshot must equal the live manifest, field for field. Drift means the
				// entry describes a model that has since changed — or never matched at all.
				const pairs = [
					["model_name", manifest.name],
					["objects", manifest.objectCount],
					["model_version", manifest.version],
					["model_updated", manifest.updatedAt],
				];
				for (const [key, live] of pairs) {
					if (snap[key] !== live) {
						drift.push(`${part.slug}/${id}: ${key} is "${snap[key]}", live is "${live}"`);
					}
				}
			}

			record(
				unresolved.length === 0,
				`model_id resolves in ${BUCKET}`,
				unresolved.join(", ") || `${samples.length} models`,
			);
			record(
				drift.length === 0,
				"stored snapshot matches the live manifest",
				drift.slice(0, 6).join("; ") || `${samples.length} models`,
			);
		}
	}

	// ── summary ──────────────────────────────────────────────────────────────
	const failed = results.filter((result) => !result.ok);
	console.log();
	if (failed.length > 0) {
		console.log(`✗ repo:verify failed — ${failed.length} of ${results.length} checks`);
		process.exit(1);
	}
	console.log(`✓ repo:verify passed — ${results.length} checks`);
}

// Also runnable directly, so mise can call it: `node scripts/lib/verify.mjs`.
if (import.meta.filename === process.argv[1]) await verify();
