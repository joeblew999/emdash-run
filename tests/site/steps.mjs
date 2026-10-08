// The site group: making, running, checking and deleting a site.   mise run test:site
// On a copy of this repo's site/ (test:node: on a site made from EmDash's Node template).
export default async (t) => {
	const node = t.where === "node";
	t.project(node ? "node:starter" : "cloudflare:blog");

	await t.ok("site:ports", "gives the project two ports of its own", async () => {
		await t.mise("site:ports");
		t.check(t.port("SITE_PORT") && t.port("PREVIEW_PORT"), "two ports in mise.local.toml");
	});
	await t.ok("site:ports", "run again: it keeps them", async () => {
		const before = t.read("mise.local.toml");
		t.says(await t.mise("site:ports"), "already has its ports");
		t.check(before === t.read("mise.local.toml"), "mise.local.toml as it was");
	});
	t.addresses();

	if (node) {
		await t.no("site:start", "with no site, says so and stops", () => t.mise("site:start"));
		await t.ok("site:new", "makes the site", () => t.mise("site:new"));
	} else {
		t.copySite();
	}
	await t.ok("site:new", "run again: the site is left alone", async () => {
		t.says(await t.mise("site:new"), "already a site");
	});

	// the dev site
	await t.ok("site:start", "starts the dev site; EmDash's welcome dialog is closed", async () => {
		t.says(await t.mise("site:start"), "welcome dialog is closed");
	});
	await t.ok("site:start", "run again: it is already running", () => t.mise("site:start"));
	await t.ok("site:start", "the dev site answers; dev sign-in works", async () => {
		t.check((await t.status(`${t.SITE}/`, { seconds: 120 })) === 200, "200 from the dev site");
		const signIn = await t.status(`${t.SITE}/_emdash/api/setup/dev-bypass`, { method: "POST" });
		t.check(signIn > 0 && signIn < 400, `the dev sign-in to answer, not ${signIn}`);
	});
	await t.ok("site:logs", "shows the dev site log", async () => {
		t.check((await t.forSeconds(5, "site:logs")).trim() !== "", "some lines of the log");
	});

	// EmDash's CLI, on it
	await t.ok("emdash", "a quoted JSON argument arrives whole", async () => {
		const title = `Two words, one argument, from ${t.where}`;
		await t.mise("emdash", "content", "create", "pages", "--draft", "--slug", "audit", "--data", JSON.stringify({ title }));
		t.says(await t.mise("emdash", "content", "get", "pages", "audit", "--json"), title);
	});
	await t.ok("emdash", "whoami on the dev site", async () => {
		t.saysAnyCase(await t.mise("emdash", "whoami"), "dev-bypass");
	});
	await t.no("emdash", "--live with no LIVE_URL says so", () => t.mise("emdash", "schema", "list", "--live"));
	await t.no("content:pull", "with no LIVE_URL says so", () => t.mise("content:pull"));

	// checking it
	await t.ok("site:check", "passes on a sound site", () => t.mise("site:check"));
	await t.long(async () => {
		await t.ok("site:check", "fails on a type error", async () => {
			t.write("site/src/pages/zz.astro", '---\nconst n: number = "text";\n---\n<p>{n}</p>\n');
			const r = await t.attempt("site:check");
			t.remove("site/src/pages/zz.astro");
			t.check(r.code !== 0, "the check to fail");
		});
	});
	await t.ok("model:sync", "records an added field in .emdash/", async () => {
		await t.mise("emdash", "schema", "add-field", "pages", "subtitle", "--type", "string", "--label", "Subtitle");
		await t.mise("model:sync");
		t.check(t.read("site/.emdash/schema.json").includes("subtitle"), "the field in site/.emdash/schema.json");
	});

	// the built site
	await t.ok("site:preview", "serves the built site; dev sign-in is off there", async () => {
		await t.mise("site:preview");
		t.check((await t.status(`${t.BUILT}/_emdash/api/setup/dev-bypass`)) === 403, "403 from the dev sign-in on the built site");
	});
	await t.long(async () => {
		if (!node) await t.ok("live:check", "the deploy rehearses with no account", () => t.mise("live:check"));
		await t.ok("emdash:update", "updates, type-checks and builds", () => t.mise("emdash:update"));

		// emptying
		await t.ok("site:reset", "empties the local content", async () => {
			await t.mise("site:start");
			await t.mise({ yes: true }, "site:reset");
			t.check((await t.attempt("emdash", "content", "get", "pages", "audit", "--json")).code !== 0, "the page made earlier to be gone");
		});
		await t.no("site:reset", "refuses with nobody to ask", () => t.mise({ alone: true }, "site:reset"));
		await t.no("site:delete", "refuses with nobody to ask", () => t.mise({ alone: true }, "site:delete"));
	});

	// stopping, deleting
	await t.ok("site:stop", "stops both sites; twice is fine", async () => {
		await t.mise("site:stop");
		await t.mise("site:stop");
		t.check((await t.status(`${t.BUILT}/`, { seconds: 5 })) !== 200, "the built site to have stopped");
	});
	await t.ok("site:delete", "removes the site folder", async () => {
		await t.cmd("pnpm", ["exec", "emdash", "logout"], { cwd: "site" });
		await t.mise({ yes: true }, "site:delete");
		t.check(!t.exists("site"), "no site folder");
	});
	await t.ok("site:delete", "run again: nothing to delete", async () => {
		t.says(await t.mise({ yes: true }, "site:delete"), "nothing to delete");
	});

	// from nothing: the one thing a copy of a site that exists cannot show
	if (!node) {
		await t.long(async () => {
			await t.no("site:start", "with no site, says so and stops", () => t.mise("site:start"));
			await t.ok("site:new", "makes a site from nothing, from EmDash's template", async () => {
				await t.mise("site:new", "cloudflare:starter");
				t.check(t.exists("site/package.json"), "site/package.json");
			});
		});
	}
};
