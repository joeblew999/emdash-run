import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

const one = emdash({ database: null });

export default defineConfig({
	integrations: [process.env.OTHER ? one : emdash({ database: undefined })],
});
