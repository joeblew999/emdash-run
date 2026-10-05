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
import { existsSync, readFileSync } from "node:fs";

import { env, secret } from "./exec.mjs";

export async function verify() {
	const SITE_URL = env("SITE_URL");
	const RUN_DIR = env("RUN_DIR");
	const ACCOUNT = secret("CLOUDFLARE_ACCOUNT_ID");
	const TOKEN = secret("CLOUDFLARE_API_TOKEN");
	const BUCKET = process.env.GEOMETRY_BUCKET ?? "cad-documents";

	const results = [];
	const record = (ok, label, detail = "") => {
		results.push({ ok, label, detail });
		console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
	};

	// ── 1. the site answers at all ────────────────────────────────────────────
	let siteUp = false;
	try {
		const res = await fetch(SITE_URL, { redirect: "manual" });
		siteUp = res.status < 500;
		record(siteUp, "site responds", `${res.status}`);
	} catch (error) {
		record(false, "site responds", error.message);
	}

	if (!siteUp) {
		console.log("\n✗ the site is not up — run: mise run repo:apply");
		process.exit(1);
	}

	// ── 2. the admin API is authenticated and holds the seeded content ───────
	const tokenPath = `${RUN_DIR}/token-admin.txt`;
	const adminToken = existsSync(tokenPath) ? readFileSync(tokenPath, "utf8").trim() : null;

	if (!adminToken) {
		record(false, "admin token", `missing ${tokenPath} — run: mise run repo:apply`);
	} else {
		const res = await fetch(`${SITE_URL}/_emdash/api/content/parts?limit=100`, {
			headers: { Authorization: `Bearer ${adminToken}`, "X-EmDash-Request": "1" },
		});
		const body = res.ok ? await res.json() : null;
		const parts = body?.data?.items ?? [];
		record(res.ok && parts.length > 0, "content API returns parts", `${res.status}, ${parts.length} parts`);

		// ── 3 + 4. resolve every model_id, then compare the stored snapshot ──
		if (parts.length > 0 && (!ACCOUNT || !TOKEN)) {
			const missing = !ACCOUNT ? "CLOUDFLARE_ACCOUNT_ID" : "CLOUDFLARE_API_TOKEN";
			record(false, "R2 cross-check", `cannot run: ${missing} is unset`);
		} else if (parts.length > 0) {
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

				const res = await fetch(
					`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/models/${id}/manifest.json`,
					{ headers: { Authorization: `Bearer ${TOKEN}` } },
				);
				if (!res.ok) {
					unresolved.push(`${id} (${res.status})`);
					continue;
				}

				const manifest = await res.json();
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
