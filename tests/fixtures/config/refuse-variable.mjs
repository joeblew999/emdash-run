import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { options } from "./options.mjs";

export default defineConfig({
	integrations: [emdash(options)],
	vite: { plugins: [] },
});
