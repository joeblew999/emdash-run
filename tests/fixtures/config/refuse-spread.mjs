import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { shared } from "./shared.mjs";

export default defineConfig({
	integrations: [
		emdash({
			...shared,
			database: shared.database,
		}),
	],
});
