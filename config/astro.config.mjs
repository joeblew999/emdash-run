// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { formsPlugin } from "@emdash-cms/plugin-forms";
import { webhookNotifierPlugin } from "@emdash-cms/plugin-webhook-notifier";
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
			plugins: [formsPlugin(), platTrunkPlugin()],
			sandboxed: [webhookNotifierPlugin()],
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
