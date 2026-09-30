// @ts-nocheck
// NOTE: TS errors for missing modules are false positives.
// This file lives in config/ but is COPIED into emdash/demos/cloudflare/ by config:apply.
// All imports resolve correctly from that location via pnpm workspaces.
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
// built-in emdash plugins
import { auditLogPlugin } from "@emdash-cms/plugin-audit-log";
import { colorPlugin } from "@emdash-cms/plugin-color";
import { embedsPlugin } from "@emdash-cms/plugin-embeds";
import { formsPlugin } from "@emdash-cms/plugin-forms";
// sandboxed built-in plugins (require network access)
// ai-moderation: use the descriptor factory (has entrypoint: "@emdash-cms/plugin-ai-moderation/plugin").
// createPlugin from ./plugin returns a ResolvedPlugin (no entrypoint) which breaks the virtual module generator.
import { aiModerationPlugin } from "@emdash-cms/plugin-ai-moderation";
import { atprotoPlugin } from "@emdash-cms/plugin-atproto";
import { webhookNotifierPlugin } from "@emdash-cms/plugin-webhook-notifier";
// local plugins — in plugins/, symlinked into node_modules by: mise run plugins:link
import { platTrunkPlugin } from "@plat-trunk/emdash-plugin";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";

export default defineConfig({
	output: "server",
	adapter: cloudflare({ imageService: "compile" }),
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB" }),
			storage: r2({ binding: "MEDIA" }),
			mcp: true,
			plugins: [
				formsPlugin(),
				auditLogPlugin(),
				colorPlugin(),
				embedsPlugin(),
				aiModerationPlugin(), // native — needs Workers AI binding, cannot be sandboxed
				platTrunkPlugin(),
			],
			sandboxed: [
				webhookNotifierPlugin(),
				atprotoPlugin(),
			],
			sandboxRunner: sandbox(),
			marketplace: "http://localhost:8787",
		}),
	],
	devToolbar: { enabled: false },
	vite: {
		optimizeDeps: {
			// packages/blocks/dist/index.js imports @cloudflare/kumo/components/chart
			// but Vite's dep scan doesn't pick it up automatically when processing
			// workspace packages outside the root. Force-include it here.
			include: ["@cloudflare/kumo/components/chart"],
			// @modelcontextprotocol/sdk uses native ESM patterns incompatible with
			// Vite's SSR dep optimizer — exclude it so Vite serves it directly.
			exclude: ["@modelcontextprotocol/sdk"],
		},
		server: {
			fs: {
				// Allow Vite to serve workspace packages outside the Vite root.
				// This config runs from emdash/demos/cloudflare/, so ../../ = emdash/.
				allow: [fileURLToPath(new URL("../../", import.meta.url))],
			},
		},
	},
});
