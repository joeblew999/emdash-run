import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { mine } from "./plugin.mjs";

export default defineConfig({
	integrations: [
		emdash({
			database: null,
			sandboxed: mine,
			plugins: [].concat(mine),
		}),
	],
});
