import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import inspect from "vite-plugin-inspect";

// A list called plugins that is NOT EmDash's comes after the emdash({ … }) call, and one before it.
const early = { plugins: [], sandboxed: [] };

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			marketplace: { plugins: ["not-this-one"] },
		}),
	],
	vite: {
		plugins: [inspect()],
		sandboxRunner: "not EmDash's",
		sandboxed: [early],
	},
});
