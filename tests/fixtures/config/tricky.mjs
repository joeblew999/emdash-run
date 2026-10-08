// import { sandbox } from "@emdash-cms/cloudflare";   <- a comment, not an import
/* emdash({ sandboxRunner: sandbox(), plugins: [ */
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import {
	d1,
	r2,
} from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

const port = process.env.SITE_PORT || 4321;
const local = `http://localhost:${port}/{not a brace}`;
const note = "emdash({ sandboxed: [x] }) } } }";
const slashes = /[{}/]+\}/g;
const half = 10 / 2; // } a brace in a comment after a division

export default defineConfig({
	site: local,
	output: "server",
	adapter: cloudflare(),
	integrations: [
		react(),
		emdash({
			// sandboxRunner: sandbox(),   <- commented out: not set
			database: d1({ binding: "DB", session: "auto" }), // }) a brace in a comment
			storage: r2({ binding: "MEDIA" }),
			siteTitle: "Curly } and ] and ) in a string, and sandboxed: [",
			"plugins": [
				// none yet
			],
			pattern: /sandboxed: \[/,
			label: `closing }) in a template ${[note, half].join("}")}`,
		}),
	],
	vite: { plugins: [] },
});
