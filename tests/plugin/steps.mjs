// The plugin group: a plugin of your own, and plugins from EmDash's registry.   mise run test:plugin
// The unit tests of the scripts' own functions are here too (*.test.mjs, fixtures/): they run first
// in every test, and in mise run check.
export default async (t) => {
	await t.aSite();
	const config = () => t.read("site/astro.config.mjs");
	const lines = (out, words) => out.split("\n").filter((l) => l.includes(words)).length;
	const forms = "@masonjames.com/contact-forms";
	const bulletin = "@meekmedia.bsky.social/bulletin";

	// the sandbox
	await t.ok("plugin:sandbox", "the site can run sandboxed plugins: the runner is in its config", async () => {
		await t.mise("plugin:sandbox");
		t.check(config().includes("sandboxRunner"), "sandboxRunner in astro.config.mjs");
	});
	await t.ok("plugin:sandbox", "run again: nothing changes", async () => {
		const before = config() + t.read("site/package.json");
		t.says(await t.mise("plugin:sandbox"), "nothing changed");
		t.check(before === config() + t.read("site/package.json"), "the config and package.json as they were");
	});

	// a plugin of your own
	await t.ok("plugin:new", "scaffolds, tests, builds and adds a plugin — to the site's config too, by itself", async () => {
		await t.mise("plugin:new", "save-log");
		t.check(t.exists("site/plugins/save-log/dist/plugin.mjs"), "the plugin built");
		t.check(t.read("site/package.json").includes("save-log"), "save-log in package.json");
		t.check(config().includes("sandboxed: [saveLog]"), "sandboxed: [saveLog] in astro.config.mjs");
	});
	await t.ok("plugin:check", "the plugin passes its checks", () => t.mise("plugin:check", "save-log"));
	await t.long(async () => {
		await t.ok("plugin:new", "run again: not scaffolded twice, still builds, the config is not touched", async () => {
			const before = config();
			t.says(await t.mise("plugin:new", "save-log"), "already there");
			t.check(t.exists("site/plugins/save-log/dist/plugin.mjs"), "the plugin built");
			t.check(before === config(), "astro.config.mjs as it was");
		});
		await t.ok("plugin:add", "a native plugin from npm: the package is added, its two lines are printed, the config is not touched", async () => {
			const before = config();
			const r = await t.attempt("plugin:add", "@emdash-cms/plugin-forms");
			t.check(r.code !== 0, "the task to end by saying the lines are yours to add");
			t.check(t.read("site/package.json").includes("plugin-forms"), "plugin-forms in package.json");
			t.says(r.out, 'import { formsPlugin } from "@emdash-cms/plugin-forms";');
			t.says(r.out, "plugins: [formsPlugin()],");
			t.check(before === config(), "astro.config.mjs as it was");
		});
		await t.no("plugin:publish", "asks first, and stops with nobody to answer (a real publish is never run)", () =>
			t.mise({ alone: true }, "plugin:publish", "save-log"));
		await t.ok("plugin", "passes any command to the plugin CLI", async () => {
			t.saysAnyCase(await t.mise("plugin", "--help"), "search");
		});
	});

	// from the registry: install, check, remove
	await t.ok("plugin:search", "finds plugins in the registry", async () => {
		t.saysAnyCase(await t.mise("plugin:search", "forms"), "forms");
	});
	await t.ok("plugin:install", "installs a registry plugin with no clicking, from a stopped site", async () => {
		t.says(await t.mise("plugin:install", forms, "--yes"), "contact-forms: installed");
	});
	await t.ok("plugin:install", "run again: it is already installed", async () => {
		t.says(await t.mise("plugin:install", forms, "--yes"), "contact-forms: already installed");
	});
	await t.no("plugin:install", "a plugin that can change things or reach outside is not installed without a yes", () =>
		t.mise({ alone: true }, "plugin:install", "@meekmedia.bsky.social/link-guardian"));
	await t.long(async () => {
		await t.no("plugin:install", "a release other than the one asked for is not installed", () => t.mise("plugin:install", "@netdollar.dev/forms@0.0.1"));
		await t.no("plugin:install", "a plugin the registry does not have: says so and fails", () => t.mise("plugin:install", "@nobody.example/nothing"));
		await t.ok("plugin:works", "the registry plugin: every check passes", async () => {
			const r = await t.attempt("plugin:works", forms, "--fresh");
			t.says(r.out, "contact-forms: loads and answers");
			t.check(!r.out.includes("FAIL"), "no FAIL line");
		});
		await t.ok("plugin:works", "the plugin plugin:new made: its route answers from the sandbox", async () => {
			t.says(await t.mise("plugin:works", "save-log"), "save-log routes: 1 declared, each asked with a GET: hello 200");
		});
		await t.no("plugin:works", "a plugin the site does not have fails", () => t.mise("plugin:works", "no-such-plugin"));
	});
	await t.ok("plugin:remove", "removes a registry plugin", async () => {
		t.says(await t.mise("plugin:remove", forms), "contact-forms: removed");
	});
	await t.ok("plugin:remove", "run again: nothing to remove", async () => {
		t.says(await t.mise("plugin:remove", forms), "nothing to remove");
	});

	await t.long(async () => {
		// the favourites
		await t.ok("plugin:favourites", "installs the favourites in one go", async () => {
			const { out } = await t.attempt("plugin:favourites", "--yes");
			t.check(!/^(FAIL|STOP)/m.test(out), "no line that starts FAIL or STOP");
			t.check(lines(out, ": installed") >= 4, "at least four installed");
		});
		await t.ok("plugin:favourites", "run again: all already installed", async () => {
			const { out } = await t.attempt("plugin:favourites", "--yes");
			t.check(!/^(FAIL|STOP)/m.test(out), "no line that starts FAIL or STOP");
			t.check(lines(out, ": installed") === 0, "nothing newly installed");
			t.says(out, "already installed");
		});
		await t.ok("plugin:favourites", "PLUGINS in the project chooses the list", async () => {
			t.says(await t.mise({ env: { PLUGINS: "@lasymphonieagency.com/comment-notify" } }, "plugin:favourites", "--yes"), "comment-notify: installed");
		});

		// a release by version, and updating it
		await t.no("plugin:update", "a plugin that is not installed: says so and fails", () => t.mise("plugin:update", `${bulletin}@0.1.1`));
		await t.ok("plugin:install", "an older release, asked for by version, is the one installed", async () => {
			t.says(await t.mise("plugin:install", "--yes", `${bulletin}@0.1.0`), "bulletin: installed — 0.1.0");
		});
		await t.no("plugin:update", "no release named: says which the site has and the registry's newest, and fails", () => t.mise("plugin:update", bulletin));
		await t.ok("plugin:update", "to the release named: prints what was granted and what each release declares; it asks for nothing more, so no yes is needed", async () => {
			const out = await t.mise({ alone: true }, "plugin:update", `${bulletin}@0.1.1`);
			t.check(/0\.1\.0, installed, was granted: .*email:send/.test(out), "what 0.1.0 was granted");
			t.check(/0\.1\.1 declares, by the registry: .*email.send/.test(out), "what 0.1.1 declares");
			t.says(out, "asks for nothing more");
			t.says(out, "bulletin: updated — 0.1.0 -> 0.1.1");
		});
		await t.ok("plugin:update", "run again: nothing to update", async () => {
			t.says(await t.mise("plugin:update", `${bulletin}@0.1.1`), "already at 0.1.1");
		});
		await t.no("plugin:update", "an older release is refused", () => t.mise("plugin:update", `${bulletin}@0.1.0`));

		// everything the site now has
		await t.ok("plugin:works", "no name: every plugin in the site loads and answers — the favourites among them", async () => {
			const { out } = await t.attempt("plugin:works");
			t.check(!/FAIL|DOES NOT WORK/.test(out), "no FAIL and no DOES NOT WORK");
			t.check(lines(out, ": loads and answers") >= 6, "at least six plugins that load and answer");
		});
	});
};
