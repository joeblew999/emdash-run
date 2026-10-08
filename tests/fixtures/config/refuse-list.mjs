import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { mine } from "./plugins.mjs";

export default defineConfig({
	integrations: [
		emdash({
			database: null,
			sandboxed: mine,
			plugins: [].concat(mine),
		}),
	],
});
