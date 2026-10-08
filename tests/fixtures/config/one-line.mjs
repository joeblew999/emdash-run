import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

export default defineConfig({
	output: "server",
	adapter: node({ mode: "standalone" }),
	integrations: [emdash({ database: sqlite({ url: "file:./data.db" }), storage: local({ directory: "./uploads", baseUrl: "/_emdash/api/media/file" }), sandboxed: [] })],
});
