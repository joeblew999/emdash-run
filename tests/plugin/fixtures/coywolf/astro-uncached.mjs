import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { contactFormsEmbedPlugin } from "@masonjames/emdash-contact-forms/registry-embed";
import { forms } from "@netdollar/emdash-forms";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	// Two languages: English at the root, French under /fr (its pages are in src/pages/fr).
	// The first language is never given a prefix: with one, the admin's pages answer 404.
	i18n: {
		defaultLocale: "en",
		locales: ["en", "fr"],
		fallback: { fr: "en" },
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			sandboxRunner: sandbox(),
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			// What puts a registry plugin's form on a page. A plugin from the registry runs in a
			// sandbox and cannot add markup to the site, so each of the two forms plugins has a
			// package that draws its block: Contact Forms' "Contact Form (registry)", Forms' "Form".
			plugins: [contactFormsEmbedPlugin(), forms()],
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Inter",
			cssVariable: "--font-body",
			weights: [400, 500, 600, 700],
			fallbacks: ["sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-mono",
			weights: [400, 500],
			fallbacks: ["monospace"],
		},
	],
	devToolbar: { enabled: false },
});
