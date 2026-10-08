// The site group: making, running, checking and deleting a site.   mise run dev:test site
// On a copy of this repo's site/ (test:node: on a site made from EmDash's Node template).
import { attempt, builtSite, check, cmd, copySite, devSite, exists, forSeconds, list, mise, ports, project, read, remove, says, saysAnyCase, status, where, write } from "../lib/site.mjs";
import { long, refuses, setup, step } from "../lib/step.mjs";

const node = where === "node";
setup(() => {
	project(node ? "node:starter" : "cloudflare:blog");
	if (!node) copySite();
});

step("site:ports", "gives the project two ports of its own", async () => {
	await mise("site:ports");
	check(ports().dev && ports().built, "two ports in mise.local.toml");
});
step("site:ports", "run again: it keeps them", async () => {
	const before = read("mise.local.toml");
	says(await mise("site:ports"), "already has its ports");
	check(before === read("mise.local.toml"), "mise.local.toml as it was");
});
if (node) {
	refuses("site:start", "with no site, says so and stops", () => mise("site:start"));
	step("site:new", "makes the site", () => mise("site:new"));
}
step("site:new", "run again: the site is left alone", async () => {
	says(await mise("site:new"), "already a site");
});

// the dev site
step("site:start", "starts the dev site; EmDash's welcome dialog is closed", async () => {
	says(await mise("site:start"), "welcome dialog is closed");
});
step("site:start", "run again: it is already running", () => mise("site:start"));
step("site:start", "the dev site answers; dev sign-in works", async () => {
	check((await status(`${devSite()}/`, { seconds: 120 })) === 200, "200 from the dev site");
	const signIn = await status(`${devSite()}/_emdash/api/setup/dev-bypass`, { method: "POST" });
	check(signIn > 0 && signIn < 400, `the dev sign-in to answer, not ${signIn}`);
});
step("site:logs", "shows the dev site log", async () => {
	check((await forSeconds(5, "site:logs")).trim() !== "", "some lines of the log");
});

// EmDash's CLI, on it
step("emdash", "a quoted JSON argument arrives whole", async () => {
	const title = `Two words, one argument, from ${where}`;
	await mise("emdash", "content", "create", "pages", "--draft", "--slug", "audit", "--data", JSON.stringify({ title }));
	says(await mise("emdash", "content", "get", "pages", "audit", "--json"), title);
});
step("emdash", "whoami on the dev site", async () => {
	saysAnyCase(await mise("emdash", "whoami"), "dev-bypass");
});
refuses("emdash", "--live with no LIVE_URL says so", () => mise("emdash", "schema", "list", "--live"));
refuses("content:pull", "with no LIVE_URL says so", () => mise("content:pull"));

// checking it
step("site:check", "passes on a sound site", () => mise("site:check"));
long(() => {
	step("site:check", "fails on a type error", async () => {
		write("site/src/pages/zz.astro", '---\nconst n: number = "text";\n---\n<p>{n}</p>\n');
		const r = await attempt("site:check");
		remove("site/src/pages/zz.astro");
		check(r.code !== 0, "the check to fail");
	});
});
step("model:sync", "records an added field in .emdash/", async () => {
	await mise("emdash", "schema", "add-field", "pages", "subtitle", "--type", "string", "--label", "Subtitle");
	await mise("model:sync");
	check(read("site/.emdash/schema.json").includes("subtitle"), "the field in site/.emdash/schema.json");
});

// the built site
step("site:preview", "serves the built site; dev sign-in is off there", async () => {
	await mise("site:preview");
	check((await status(`${builtSite()}/_emdash/api/setup/dev-bypass`)) === 403, "403 from the dev sign-in on the built site");
});
long(() => {
	if (!node) step("live:check", "the deploy rehearses with no account", () => mise("live:check"));
	step("emdash:update", "updates, type-checks and builds", () => mise("emdash:update"));

	// emptying
	step("site:reset", "empties the local content", async () => {
		await mise("site:start");
		await mise({ yes: true }, "site:reset");
		check((await attempt("emdash", "content", "get", "pages", "audit", "--json")).code !== 0, "the page made earlier to be gone");
	});
	refuses("site:reset", "refuses with nobody to ask", () => mise({ alone: true }, "site:reset"));
	refuses("site:delete", "refuses with nobody to ask", () => mise({ alone: true }, "site:delete"));
});

// stopping, deleting
step("site:stop", "stops both sites; twice is fine", async () => {
	await mise("site:stop");
	await mise("site:stop");
	check((await status(`${builtSite()}/`, { seconds: 5 })) !== 200, "the built site to have stopped");
});
step("site:delete", "removes the site folder", async () => {
	await cmd("pnpm", ["exec", "emdash", "logout"], { cwd: "site" });
	await mise({ yes: true }, "site:delete");
	check(!exists("site"), "no site folder");
});
step("site:delete", "run again: nothing to delete", async () => {
	says(await mise({ yes: true }, "site:delete"), "nothing to delete");
});

// from nothing: the one thing a copy of a site that exists cannot show
if (!node) {
	long(() => {
		refuses("site:start", "with no site, says so and stops", () => mise("site:start"));
		step("site:new", "makes a site from nothing, from EmDash's template", async () => {
			await mise("site:new", "cloudflare:starter");
			check(exists("site/package.json"), "site/package.json");
		});
	});
}
