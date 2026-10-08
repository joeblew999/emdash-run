// The plugin group: a plugin of your own, and plugins from EmDash's registry.   mise run dev:test plugin
// The unit tests of the scripts' own functions are here too (*.test.mjs, fixtures/): they run first
// in every test, and in mise run check.
import { aSite, attempt, check, env, exists, list, mise, project, read, remove, says, saysAnyCase } from "../lib/site.mjs";
import { long, refuses, setup, step } from "../lib/step.mjs";

setup(aSite);

const config = () => read("site/astro.config.mjs");
const lines = (out, words) => out.split("\n").filter((l) => l.includes(words)).length;
const forms = "@masonjames.com/contact-forms";
const bulletin = "@meekmedia.bsky.social/bulletin";

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

// a plugin of your own
step("plugin:new", "scaffolds, tests, builds and adds a plugin — to the site's config too, by itself", async () => {
	await mise("plugin:new", "save-log");
	check(exists("site/plugins/save-log/dist/plugin.mjs"), "the plugin built");
	check(read("site/package.json").includes("save-log"), "save-log in package.json");
	check(config().includes("sandboxed: [saveLog]"), "sandboxed: [saveLog] in astro.config.mjs");
});
step("plugin:check", "the plugin passes its checks", () => mise("plugin:check", "save-log"));
long(() => {
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

// from the registry: install, check, remove
step("plugin:search", "finds plugins in the registry", async () => {
	saysAnyCase(await mise("plugin:search", "forms"), "forms");
});
step("plugin:install", "installs a registry plugin with no clicking, from a stopped site", async () => {
	says(await mise("plugin:install", forms, "--yes"), "contact-forms: installed");
});
step("plugin:install", "run again: it is already installed", async () => {
	says(await mise("plugin:install", forms, "--yes"), "contact-forms: already installed");
});
refuses("plugin:install", "a plugin that can change things or reach outside is not installed without a yes", () =>
	mise({ alone: true }, "plugin:install", "@meekmedia.bsky.social/link-guardian"));
long(() => {
	refuses("plugin:install", "a release other than the one asked for is not installed", () => mise("plugin:install", "@netdollar.dev/forms@0.0.1"));
	refuses("plugin:install", "a plugin the registry does not have: says so and fails", () => mise("plugin:install", "@nobody.example/nothing"));
	step("plugin:works", "the registry plugin: every check passes", async () => {
		const r = await attempt("plugin:works", forms, "--fresh");
		says(r.out, "contact-forms: loads and answers");
		check(!r.out.includes("FAIL"), "no FAIL line");
	});
	step("plugin:works", "the plugin plugin:new made: its route answers from the sandbox", async () => {
		says(await mise("plugin:works", "save-log"), "save-log routes: 1 declared, each asked with a GET: hello 200");
	});
	refuses("plugin:works", "a plugin the site does not have fails", () => mise("plugin:works", "no-such-plugin"));
});
step("plugin:remove", "removes a registry plugin", async () => {
	says(await mise("plugin:remove", forms), "contact-forms: removed");
});
step("plugin:remove", "run again: nothing to remove", async () => {
	says(await mise("plugin:remove", forms), "nothing to remove");
});

long(() => {
	// the favourites
	step("plugin:favourites", "installs the favourites in one go", async () => {
		const { out } = await attempt("plugin:favourites", "--yes");
		check(!/^(FAIL|STOP)/m.test(out), "no line that starts FAIL or STOP");
		check(lines(out, ": installed") >= 4, "at least four installed");
	});
	step("plugin:favourites", "run again: all already installed", async () => {
		const { out } = await attempt("plugin:favourites", "--yes");
		check(!/^(FAIL|STOP)/m.test(out), "no line that starts FAIL or STOP");
		check(lines(out, ": installed") === 0, "nothing newly installed");
		says(out, "already installed");
	});
	step("plugin:favourites", "PLUGINS in the project chooses the list", async () => {
		says(await mise({ env: { PLUGINS: "@lasymphonieagency.com/comment-notify" } }, "plugin:favourites", "--yes"), "comment-notify: installed");
	});

	// a release by version, and updating it
	refuses("plugin:update", "a plugin that is not installed: says so and fails", () => mise("plugin:update", `${bulletin}@0.1.1`));
	step("plugin:install", "an older release, asked for by version, is the one installed", async () => {
		says(await mise("plugin:install", "--yes", `${bulletin}@0.1.0`), "bulletin: installed — 0.1.0");
	});
	refuses("plugin:update", "no release named: says which the site has and the registry's newest, and fails", () => mise("plugin:update", bulletin));
	step("plugin:update", "to the release named: prints what was granted and what each release declares; it asks for nothing more, so no yes is needed", async () => {
		const out = await mise({ alone: true }, "plugin:update", `${bulletin}@0.1.1`);
		check(/0\.1\.0, installed, was granted: .*email:send/.test(out), "what 0.1.0 was granted");
		check(/0\.1\.1 declares, by the registry: .*email.send/.test(out), "what 0.1.1 declares");
		says(out, "asks for nothing more");
		says(out, "bulletin: updated — 0.1.0 -> 0.1.1");
	});
	step("plugin:update", "run again: nothing to update", async () => {
		says(await mise("plugin:update", `${bulletin}@0.1.1`), "already at 0.1.1");
	});
	refuses("plugin:update", "an older release is refused", () => mise("plugin:update", `${bulletin}@0.1.0`));

	// everything the site now has
	step("plugin:works", "no name: every plugin in the site loads and answers — the favourites among them", async () => {
		const { out } = await attempt("plugin:works");
		check(!/FAIL|DOES NOT WORK/.test(out), "no FAIL and no DOES NOT WORK");
		check(lines(out, ": loads and answers") >= 6, "at least six plugins that load and answer");
	});
});
