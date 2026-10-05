#!/usr/bin/env node
/**
 * `mise run registry:<sub>` — the local plugin registry (emdash's aggregator) on :8788.
 * Optional: the site uses the hosted registry unless it is running.
 *
 *   install | migrate | env | start | up | logs | backfill | project
 *
 * `wrangler dev`, NOT the package's `vite dev`: the Cloudflare vite plugin resolves
 * miniflare@4.20260507.1 + workerd@1.20260507.1, and that workerd build crashes on
 * Durable Object SQLite (`table _cf_ALARM has 3 columns but 2 values were supplied`).
 */
import { copyFileSync, existsSync } from "node:fs";

import { env, registryToken, run, sh } from "./lib/exec.mjs";

const EMDASH_DIR = env("EMDASH_DIR");
const APP = `${EMDASH_DIR}/apps/aggregator`;
const sub = process.argv[2];

/** POST to an /_admin route with the dev token; print status + a short body. */
async function admin(path, body) {
	const res = await fetch(`http://localhost:8788${path}`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${registryToken()}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body ?? {}),
	});
	const text = await res.text();
	console.log(`[${res.status}] ${text.slice(0, 600)}`);
	if (!res.ok) process.exit(1);
}

switch (sub) {
	case "install":
		run("pnpm", ["install", "--frozen-lockfile"], { cwd: EMDASH_DIR });
		run("pnpm", ["--filter", "@emdash-cms/aggregator", "run", "prebuild"], { cwd: EMDASH_DIR });
		break;
	case "migrate":
		run("pnpm", ["run", "db:migrate:local"], { cwd: APP });
		break;
	case "env":
		// Without this the aggregator uses wrangler.jsonc's default LISTING_POLICY_MODE=
		// projection, which fails closed (it needs positive labels from the emdashcms
		// labeller) — so every read returns empty. `.env.example` sets `open`.
		if (existsSync(`${APP}/.env`)) {
			console.log("  ✓ .env already present");
			break;
		}
		copyFileSync(`${APP}/.env.example`, `${APP}/.env`);
		console.log(`  ✓ wrote ${APP}/.env (LISTING_POLICY_MODE=open, dev ADMIN_TOKEN)`);
		break;
	case "start":
		run("pnpm", ["exec", "wrangler", "dev", "--port", "8788"], { cwd: APP });
		break;
	case "up":
		sh("pitchfork start registry");
		console.log("→ registry: http://localhost:8788/health  (JSON API under /xrpc/com.emdashcms.experimental.aggregator.*)");
		break;
	case "logs":
		run("pitchfork", ["logs", "registry", "--follow"]);
		break;
	case "backfill":
		// Jetstream only streams NEW records, so a fresh registry is empty until backfill:
		// this discovers publishers on the relay and fans out one job per (DID × collection).
		await admin("/_admin/backfill");
		break;
	case "project":
		// Reads gate on public_projection_state.active_generation, and the generation is
		// built by the LABEL ingest DO — locally there is no label stream, so a labels
		// replay is what builds it. Without this, reads return empty even after backfill.
		await admin("/_admin/labels/replay");
		break;
	default:
		console.error(`registry: unknown subcommand "${sub}"`);
		process.exit(1);
}
