// The plugin group: a plugin of your own, and plugins from EmDash's registry.   mise run dev:test plugin
// The unit tests of the scripts' own functions are here too (*.test.mjs, fixtures/): they run first
// in every test, and in mise run check.
import { aSite, attempt, body, builtSite, check, exists, mise, read, says, saysAnyCase, where } from "../lib/site.mjs";
import { registryClean, registrySteps } from "../both/registry.mjs";
import { long, refuses, setup, step } from "../lib/step.mjs";

// (what a run stopped half way may have left installed is taken out first)
setup(async () => {
	await aSite();
	await registryClean({ live: false });
});

const config = () => read("site/astro.config.mjs");

// the sandbox
step("plugin:sandbox", "the site can run sandboxed plugins: the runner is in its config", async () => {
	await mise("plugin:sandbox");
	check(config().includes("sandboxRunner"), "sandboxRunner in astro.config.mjs");
});
step("plugin:sandbox", "run again: nothing changes", async () => {
	const before = config() + read("site/package.json");
	says(await mise("plugin:sandbox"), "nothing changed");
	check(before === config() + read("site/package.json"), "the config and package.json as they were");
});

// a plugin of your own: scaffolded, tested and built — half a minute, so at the level all
long(() => {
	step("plugin:new", "scaffolds, tests, builds and adds a plugin — to the site's config too, by itself", async () => {
		await mise("plugin:new", "save-log");
		check(exists("site/plugins/save-log/dist/plugin.mjs"), "the plugin built");
		check(read("site/package.json").includes("save-log"), "save-log in package.json");
		check(config().includes("sandboxed: [saveLog]"), "sandboxed: [saveLog] in astro.config.mjs");
	});
	step("plugin:check", "the plugin passes its checks", () => mise("plugin:check", "save-log"));
	step("plugin:new", "run again: not scaffolded twice, still builds, the config is not touched", async () => {
		const before = config();
		says(await mise("plugin:new", "save-log"), "already there");
		check(exists("site/plugins/save-log/dist/plugin.mjs"), "the plugin built");
		check(before === config(), "astro.config.mjs as it was");
	});
	step("plugin:add", "a native plugin from npm: the package is added, its two lines are printed, the config is not touched", async () => {
		const before = config();
		const r = await attempt("plugin:add", "@emdash-cms/plugin-forms");
		check(r.code !== 0, "the task to end by saying the lines are yours to add");
		check(read("site/package.json").includes("plugin-forms"), "plugin-forms in package.json");
		says(r.out, 'import { formsPlugin } from "@emdash-cms/plugin-forms";');
		says(r.out, "plugins: [formsPlugin()],");
		check(before === config(), "astro.config.mjs as it was");
	});
	refuses("plugin:publish", "asks first, and stops with nobody to answer (a real publish is never run)", () =>
		mise({ alone: true }, "plugin:publish", "save-log"));
	step("plugin", "passes any command to the plugin CLI", async () => {
		saysAnyCase(await mise("plugin", "--help"), "search");
	});
});

step("plugin:search", "finds plugins in the registry", async () => {
	saysAnyCase(await mise("plugin:search", "forms"), "forms");
});

// from the registry: the same steps the live group runs on the deployed site
registrySteps({ live: false });

// what only a site on this machine has: a full check that rebuilds it, and the plugin made above
long(() => {
	step("plugin:works", "--fresh: checks, builds and restarts the site first, then every check passes", async () => {
		await mise("plugin:install", "@masonjames.com/contact-forms", "--yes");
		const r = await attempt("plugin:works", "@masonjames.com/contact-forms", "--fresh");
		says(r.out, "contact-forms: loads and answers");
		check(!r.out.includes("FAIL"), "no FAIL line");
		await mise("plugin:remove", "@masonjames.com/contact-forms");
	});
	step("plugin:works", "the plugin plugin:new made: its route answers from the sandbox", async () => {
		says(await mise("plugin:works", "save-log"), "save-log routes: 1 declared, each asked with a GET: hello 200");
	});
});

// seven registry plugins, each doing what it is for — it installs them and asks the internet, so at the level all
long(() => {
	step("plugin:demo", "each plugin does its real thing, and run again changes nothing", async () => {
		const seven = ["seo-suite", "link-guardian", "media-alt-text-queue", "contact-forms", "forms", "linguadash", "instant-indexer"];
		const first = await mise("plugin:demo");
		for (const plugin of seven) says(first, `ok   ${plugin}: `);
		says(first, "all 7 plugins did their real thing");
		const again = await mise("plugin:demo");
		for (const plugin of seven) says(again, `ok   ${plugin}: already so — `);
		check(!again.includes(": installed"), "nothing installed the second time");
		// no second message in either form
		says(again, "is in the export of submissions, once");
		says(again, "are among its entries, once");
		// What a visitor is given. This repo's site/ can show it: its config has the two packages that
		// draw a form, and French among its languages. A site made from EmDash's template has neither,
		// and each line says so.
		if (where === "cloudflare") {
			says(again, 'a visitor finds its form "Contact" on /pages/contact');
			says(again, 'a visitor finds its form "Feedback" on /pages/feedback');
			says(again, "a visitor reads the post in French at /fr/posts/chaque-lien-est-une-promesse");
			const home = await body(`${builtSite()}/`);
			check(home.includes("Every link is a promise") && home.includes('alt="The Earth at night'), "the home page to show the post, with its photograph");
			check((await body(`${builtSite()}/fr/`)).includes("Chaque lien est une promesse"), "the French home page to show the post in French");
		} else {
			says(again, "it is on no page, for this site cannot draw it");
			says(again, "no visitor can open it: French is not one of this site's languages");
		}
	});
});
