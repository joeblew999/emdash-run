// @ts-nocheck
// NOTE: TS errors for missing modules are false positives.
// This file lives in config/ but is COPIED into .src/site/ by `config:apply`.
// Imports resolve from that location via pnpm (published packages, no monorepo).
//
// The host site is the official starter-cloudflare template (see docs/plans/done/0007-emdash-1.1-templates-src-rework.md).
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { formsPlugin } from "@emdash-cms/plugin-forms";
import webhookNotifier from "@emdash-cms/plugin-webhook-notifier";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
// local plugin — in plugins/, symlinked into the site's node_modules by: mise run plugin:link
// NATIVE: `.` is the descriptor factory and `./admin` the React panel. (The sandboxed
// convention is different — `.` descriptor + `./sandbox` implementation — and is what
// `sandboxed:` below uses. See docs/plugin.md.)
import { platTrunkPlugin } from "@plat-trunk/emdash-plugin";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			// D1 binding name must match wrangler.jsonc. session: "auto" enables read replicas.
			database: d1({ binding: "DB", session: "auto" }),
			// R2 storage for media
			storage: r2({ binding: "MEDIA" }),

			// Native plugins (run in the host worker)
			plugins: [
				formsPlugin(),
				platTrunkPlugin(),
			],

			// Sandboxed plugins (run in isolated Worker isolates via the LOADER binding).
			// The harness is already a sandbox host — only our own plugin is native.
			sandboxed: [webhookNotifier],
			sandboxRunner: sandbox(),

			// The plugin registry — the current name for the plugin marketplace.
			// Dev points at the LOCAL registry when EMDASH_REGISTRY_URL is set (site:dev sets
			// sets it); site:build / site:deploy leave it unset, so production uses the
			// hosted registry.
			registry: process.env.EMDASH_REGISTRY_URL ?? "https://registry.emdashcms.com",

			// MCP is enabled by default at /_emdash/api/mcp (Bearer token required).
		}),
	],
	devToolbar: { enabled: false },
});
