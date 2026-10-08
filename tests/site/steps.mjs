// The site group: making, running, checking and deleting a site.   mise run dev:test site
// On a copy of this repo's site/ (test:node: on a site made from EmDash's Node template).
import { aSite, attempt, builtSite, check, cmd, devSite, exists, forSeconds, mise, ports, project, read, remove, says, saysAnyCase, status, where, write } from "../lib/site.mjs";
import { long, refuses, setup, step } from "../lib/step.mjs";

const node = where === "node";
const audit = `audit-${Date.now()}`; // a page of this run's own: the site may be one kept from the last run
// a site made from EmDash's Node template is made by a step below; otherwise a copy of site/
setup(async () => {
	if (node) project("node:starter");
	else await aSite();
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

// where it is, and what a task would do: both only look
step("site:status", "says where the site is, state by state, and for what is not so the task that gets it there", async () => {
	const out = await mise("site:status");
	says(out, "yes  a site");
	check(/(yes {2}the dev site running|no {3}the dev site running {3}— to get there: mise run site:start)/.test(out), "the dev site: yes, or no with the task that starts it");
});
step("plan", "prints the states a task stands on, in order, and starts nothing", async () => {
	const out = await mise("plan", "signin:token");
	check(out.indexOf("site:built") < out.indexOf("site:built-running") && out.indexOf("site:built-running") < out.indexOf("signin:token"), "site:built, then site:built-running, then signin:token");
	says(await mise("plan", "signin:token", "--live"), "live:answers");
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
	check((await forSeconds(2, "site:logs")).trim() !== "", "some lines of the log");
});

// EmDash's CLI, on it
step("emdash", "a quoted JSON argument arrives whole", async () => {
	const title = `Two words, one argument, from ${where}`;
	await mise("emdash", "content", "create", "pages", "--draft", "--slug", audit, "--data", JSON.stringify({ title }));
	says(await mise("emdash", "content", "get", "pages", audit, "--json"), title);
});
step("emdash", "whoami on the dev site", async () => {
	saysAnyCase(await mise("emdash", "whoami"), "dev-bypass");
});
refuses("emdash", "--live with no LIVE_URL says so", () => mise("emdash", "schema", "list", "--live"));
refuses("content:pull", "with no LIVE_URL says so", () => mise("content:pull"));

// checking it
long(() => {
	step("site:check", "passes on a sound site", () => mise("site:check"));
	step("site:check", "fails on a type error", async () => {
		write("site/src/pages/zz.astro", '---\nconst n: number = "text";\n---\n<p>{n}</p>\n');
		const r = await attempt("site:check");
		remove("site/src/pages/zz.astro");
		check(r.code !== 0, "the check to fail");
	});
});
step("model:sync", "records an added field in .emdash/", async () => {
	await attempt("emdash", "schema", "add-field", "pages", "subtitle", "--type", "string", "--label", "Subtitle"); // (a kept site has it already)
	await mise("model:sync");
	check(read("site/.emdash/schema.json").includes("subtitle"), "the field in site/.emdash/schema.json");
});

// the built site
step("site:preview", "serves the built site; dev sign-in is off there", async () => {
	await mise("site:preview");
	check((await status(`${builtSite()}/_emdash/api/setup/dev-bypass`)) === 403, "403 from the dev sign-in on the built site");
});
long(() => {
	// a seed file, applied to the built site while it runs and has content in it
	step("site:seed", "applies the site's own seed file, and run again makes nothing", async () => {
		const first = await mise("site:seed");
		says(first, "the seed file, applied: ");
		check(!first.includes("FAIL"), "nothing in the file to fail");
		says(await mise("site:seed"), "the seed file, applied: 0 made, ");
	});
	// something in every feature, asked of the built site as a visitor would ask it
	step("site:demo", "fills every core feature, and run again changes nothing", async () => {
		const first = await mise("site:demo");
		says(first, "ok   backup:");
		check(!first.includes("FAIL"), "no section and no feature to fail");
		check((await status(`${builtSite()}/hello`)) === 301, "301 from the redirect the seed file has");
		const again = await mise("site:demo");
		says(again, "the seed file, applied: 0 made, ");
		says(again, "features: 0 made, ");
	});
	if (!node) step("live:check", "the deploy rehearses with no account", () => mise("live:check"));
	step("emdash:update", "updates, type-checks and builds", () => mise("emdash:update"));

	// emptying
	step("site:reset", "empties the local content", async () => {
		await mise("site:start");
		await mise({ yes: true }, "site:reset");
		check((await attempt("emdash", "content", "get", "pages", audit, "--json")).code !== 0, "the page made earlier to be gone");
	});
	refuses("site:reset", "refuses with nobody to ask", () => mise({ alone: true }, "site:reset"));
	refuses("site:delete", "refuses with nobody to ask", () => mise({ alone: true }, "site:delete"));
});

// stopping, deleting: at the level all, where the site is this run's own
long(() => {
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
