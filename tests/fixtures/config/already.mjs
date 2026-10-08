import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { access, d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { sandbox } from "@emdash-cms/cloudflare";
import saveLog from "save-log";
import { formsPlugin } from "@emdash-cms/plugin-forms";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	integrations: [
		react(),
		emdash({
			plugins: [formsPlugin({ notify: true })],
			sandboxed: [
				saveLog,
			],
			sandboxRunner: sandbox(),
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			auth: access({ teamDomain: "example.cloudflareaccess.com", audienceEnvVar: "CF_ACCESS_AUDIENCE" }),
		}),
	],
});
