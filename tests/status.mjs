// Keeps the record of what works, by task. `tests/replay.sh` hands it the rows of the run it just
// made; they replace older rows for the same step, the rest are kept — so a quick run does not
// wipe out what the full run or the deployed run showed. Then it writes docs/status.md with one
// line for EVERY task in tasks.toml, tested or not.
//
//   node tests/status.mjs <rows file> <tier> <tasks from> <commit> <took seconds>
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
// `node tests/status.mjs --coverage`: PROVENANCE. Every task in tasks.toml must be tested by at
// least one step in tests/replay.sh, and every step must name a task that exists. It runs first in
// every test, and fails it — so tasks.toml cannot change without the test changing with it.
if (process.argv[2] === "--coverage") {
	const all = JSON.parse(execFileSync("mise", ["tasks", "ls", "--hidden", "--json"], { cwd: repo, encoding: "utf8" }));
	const names = all.filter((t) => !t.name.startsWith("step:") && t.source.endsWith("tasks.toml")).map((t) => t.name);
	const stepped = new Set([...readFileSync(join(repo, "tests", "replay.sh"), "utf8").matchAll(/^\s*(?:\[[^\n]*?\]\s*\|\|\s*|case[^\n]*?\)\s*)?(?:ok|no)\s+([a-z:]+)\s+"/gm)].map((m) => m[1]));
	const untested = names.filter((n) => !stepped.has(n));
	const unknown = [...stepped].filter((n) => !names.includes(n));
	if (untested.length) console.error(`tasks.toml has tasks with no step in tests/replay.sh: ${untested.join(", ")}`);
	if (unknown.length) console.error(`tests/replay.sh has steps for tasks that are not in tasks.toml: ${unknown.join(", ")}`);
	if (untested.length || unknown.length) {
		console.error("Change the test with the task. Nothing was run.");
		process.exit(1);
	}
	console.log(`provenance: all ${names.length} tasks in tasks.toml have a step in tests/replay.sh, and every step names a real task`);
	process.exit(0);
}

// `node tests/status.mjs --rebuild` rewrites the pages from the record as it is, without a new run.
const rebuild = process.argv[2] === "--rebuild";
const [rowsFile, tier, from, commit, took] = rebuild ? [null, "—", "—", "—", "0"] : process.argv.slice(2);
const store = join(repo, "tests", "results.json");
const when = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

let results = existsSync(store) ? JSON.parse(readFileSync(store, "utf8")) : [];
const fresh = rebuild ? [] : readFileSync(rowsFile, "utf8").split("\n").filter(Boolean).map((line) => {
	const [task, where, step, result, detail, kind] = line.split("|").map((x) => x.trim());
	return { task, where, step, result, detail, refusal: kind === "no", tier, from, commit, when };
}).map((r, i) => ({ ...r, order: i }));
const key = (r) => `${r.task}|${r.where}|${r.step}`;
const replaced = new Set(fresh.map(key));
// The full run is the whole truth for each kind of site it ran on: older steps for those go, so a
// renamed or removed step cannot linger. A quick run replaces only the steps it ran.
const ran = new Set(fresh.map((r) => r.where));
results = results.filter((r) => (tier === "full" ? !ran.has(r.where) : !replaced.has(key(r)))).concat(fresh);
writeFileSync(store, JSON.stringify(results, null, 1) + "\n");

// Every task there is: the visible ones, and the hidden ones that are run by name.
const listed = JSON.parse(execFileSync("mise", ["tasks", "ls", "--hidden", "--json"], { cwd: repo, encoding: "utf8" }));
// the tasks a project gets — those in tasks.toml; this repo's own (test, issues, docs:…) are not counted
const tasks = listed.filter((t) => !t.name.startsWith("step:") && t.source.endsWith("tasks.toml")).map((t) => ({ name: t.name, hidden: t.hide, description: t.description }));
const wheres = ["cloudflare", "node", "deployed"];
const cell = (task, where) => {
	const rows = results.filter((r) => r.task === task && r.where === where);
	if (!rows.length) return "—";
	const failed = rows.filter((r) => r.result === "FAIL").length;
	return failed ? `**FAIL** ${failed} of ${rows.length}` : `pass ×${rows.length}`;
};
const notTested = tasks.filter((t) => !results.some((r) => r.task === t.name));
const failures = results.filter((r) => r.result === "FAIL");
const out = [];
out.push("---", "title: What works", "nav_order: 50", "---", "", "# What works", "");
out.push("Written by `tests/replay.sh` and `tests/status.mjs`. Do not edit: run a test.", "");
out.push(`**${results.filter((r) => r.result === "PASS").length} steps pass, ${failures.length} fail, ${notTested.length} of ${tasks.length} tasks have no test.**`, "");
// a rebuild is not a run: it keeps the line the last run wrote
const statusFile = join(repo, "docs", "status.md");
const lastRun = rebuild && existsSync(statusFile) ? readFileSync(statusFile, "utf8").split("\n").find((l) => l.startsWith("Last run:")) : null;
out.push(lastRun ?? `Last run: \`${tier}\`, tasks from ${from}, commit \`${commit}\`, ${when}, ${took}s. Each run replaces the steps it ran and keeps the rest; the table at the end says when each step last ran.`, "");
out.push("- `mise run test` — quick: the everyday tasks, one template, about a minute", "- `mise run test:full` — everything: both templates, then the tasks that act on a deployed site", "");
out.push("Every test runs as another developer would: a clean environment and an empty config folder. This page is from a Mac; the same test runs on macOS, Linux and Windows in the `stages` workflow.", "");
out.push("## By task — every task in `tasks.toml`", "");
out.push("| task | Cloudflare site | Node site | deployed site | |", "|---|---|---|---|---|");
for (const t of tasks) {
	const cells = wheres.map((w) => cell(t.name, w));
	const none = cells.every((c) => c === "—");
	out.push(`| \`${t.name}\`${t.hidden ? " (hidden)" : ""} | ${cells.join(" | ")} | ${none ? "**NOT TESTED**" : ""} |`);
}
if (failures.length) {
	out.push("", "## Failing", "", "| task | where | step | last output |", "|---|---|---|---|");
	for (const r of failures) out.push(`| \`${r.task}\` | ${r.where} | ${r.step} | ${r.detail} |`);
}
out.push("", "## Every step", "", "| task | where | step | | tier | commit | when |", "|---|---|---|---|---|---|---|");
for (const r of [...results].sort((a, b) => (a.task + a.where).localeCompare(b.task + b.where))) {
	out.push(`| \`${r.task}\` | ${r.where} | ${r.step} | ${r.result} | ${r.tier}${r.from === "GitHub" ? ", from GitHub" : ""} | \`${r.commit}\` | ${r.when} |`);
}
writeFileSync(join(repo, "docs", "status.md"), out.join("\n") + "\n");

// The README's "in order" block: the tasks in the order the test uses them — which is the order a
// developer does — each with its one-line description and what the test saw. Between two markers.
for (const readme of [join(repo, "README.md")]) {
if (!existsSync(readme)) continue;
const text = readFileSync(readme, "utf8");
const begin = "<!-- in-order:begin (written by tests/status.mjs — run a test, do not edit) -->";
const end = "<!-- in-order:end -->";
if (text.includes(begin) && text.includes(end)) {
	// a description can hold <name> or a | — either would break the table on the docs site
	const describe = Object.fromEntries(tasks.map((t) => [t.name, t.description.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "\\|").replaceAll("--", "\\-\\-")]));
	// The order is the order of the steps in tests/replay.sh itself — not of whichever run came last.
	const script = readFileSync(join(repo, "tests", "replay.sh"), "utf8");
	const part = { cloudflare: script.slice(script.indexOf("local_site() {"), script.indexOf("live_site() {")), deployed: script.slice(script.indexOf("live_site() {")) };
	const firstUse = (where) => [...part[where].matchAll(/^\s*(?:\[[^\n]*?\]\s*\|\|\s*|case[^\n]*?\)\s*)?ok\s+([a-z:]+)\s+"/gm)].map((m) => m[1]).filter((n, i, all) => all.indexOf(n) === i);
	const lines = [];
	for (const [where, heading] of [["cloudflare", "On this machine"], ["deployed", "On the deployed site"]]) {
		// in the order the test first USES each task (a refusal step is not a use); hidden tasks left out
		const hidden = new Set(tasks.filter((t) => t.hidden).map((t) => t.name));
		// on the deployed table, only the tasks that are about the deployed site
		const ordered = firstUse(where).filter((n) => !hidden.has(n) && describe[n] !== undefined && !(where === "deployed" && n.startsWith("site:"))).map((n) => ({ task: n }));
		if (!ordered.length) continue;
		lines.push(`**${heading}**`, "", "| | task | what it does | tested |", "|---|---|---|---|");
		ordered.forEach((r, i) => {
			const all = results.filter((x) => x.task === r.task && x.where === where);
			const bad = all.filter((x) => x.result === "FAIL").length;
			lines.push(`| ${i + 1} | \`${r.task}\` | ${describe[r.task] ?? ""} | ${bad ? "**FAILS**" : "yes"} |`);
		});
		lines.push("");
	}
	const block = `${begin}\n${lines.join("\n")}\n${end}`;
	let next = text.slice(0, text.indexOf(begin)) + block + text.slice(text.indexOf(end) + end.length);
	// A section's own list of tasks: `<!-- tasks:PREFIX -->` … `<!-- /tasks -->` is filled with every
	// visible task whose name starts with PREFIX and its description, in the order the test uses
	// them. So a section says only what is not a task; what a task does is written once, on it.
	const used = [...firstUse("cloudflare"), ...firstUse("deployed")];
	const rank = (n) => (used.indexOf(n) < 0 ? 999 : used.indexOf(n));
	next = next.replace(/<!-- tasks:([a-z:]+) -->[\s\S]*?<!-- \/tasks -->/g, (_, prefix) => {
		const rows = tasks.filter((t) => !t.hidden && t.name.startsWith(prefix)).sort((a, b) => rank(a.name) - rank(b.name));
		return [`<!-- tasks:${prefix} -->`, "| task | what it does |", "|---|---|", ...rows.map((t) => `| \`${t.name}\` | ${describe[t.name]} |`), "<!-- /tasks -->"].join("\n");
	});
	writeFileSync(readme, next);
}
}
// The docs site is the README, one page per section: one source, so the two cannot drift. The home
// page is the README's opening and its "Set up"; every other `## ` section becomes a page of its
// own, in the README's order. Pages written here carry a marker, and stale ones are removed.
{
	const { readdirSync, unlinkSync } = await import("node:fs");
	const docs = join(repo, "docs");
	const marker = "<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->";
	for (const f of readdirSync(docs)) {
		if (f.endsWith(".md") && readFileSync(join(docs, f), "utf8").includes(marker)) unlinkSync(join(docs, f));
	}
	const fix = (t) => t
		.replaceAll("](docs/status.md)", "](status.md)")
		.replaceAll("](docs/tasks.md)", "](tasks.md)")
		.replaceAll("](docs/)", "](README.md)")
		.replaceAll("](docs/plans/)", "](plans/README.md)")
		.replaceAll("](docs/agents/README.md)", "](agents/README.md)")
		.replaceAll("](docs/favourite-plugins.md)", "](favourite-plugins.md)")
		.replaceAll("](docs/upstream.md)", "](upstream.md)")
		.replaceAll("](admin/)", "](https://github.com/joeblew999/emdash-run/tree/main/admin)")
		.replace(/^Docs: .*\n/m, "");
	const [intro, ...sections] = fix(readFileSync(join(repo, "README.md"), "utf8")).split(/^## /m);
	const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	const pages = sections.map((sec, i) => {
		const title = sec.slice(0, sec.indexOf("\n")).trim();
		return { title, file: `${slug(title)}.md`, body: sec.slice(sec.indexOf("\n") + 1).trim(), order: i + 2 };
	});
	const home = pages.find((p) => p.title === "Set up");
	// "The tasks" is not a page of its own: its table opens tasks.md, above what mise writes
	const order = pages.find((p) => p.title === "The tasks");
	const rest = pages.filter((p) => p !== home && p !== order);
	for (const p of rest) {
		writeFileSync(join(docs, p.file), `---\ntitle: "${p.title}"\nnav_order: ${p.order}\n---\n\n${marker}\n\n# ${p.title}\n\n${p.body}\n`);
	}
	// Every task, with its arguments and flags: written by mise itself (`mise generate task-docs`)
	// from tasks.toml, so a task's description is its documentation and there is one place to
	// write it. Asked from an empty project that includes only tasks.toml — what a developer's
	// project gets — so this repo's own tasks (test, docs, hooks…) are not in it.
	{
		const { mkdtempSync, rmSync } = await import("node:fs");
		const { tmpdir } = await import("node:os");
		const view = mkdtempSync(join(tmpdir(), "emdash-run-tasks-"));
		writeFileSync(join(view, "mise.toml"), `[task_config]\nincludes = [${JSON.stringify(join(repo, "tasks.toml").replaceAll("\\", "/"))}]\n`);
		const made = execFileSync("mise", ["generate", "task-docs", "--style", "detailed"], { cwd: view, encoding: "utf8", env: { ...process.env, MISE_TRUSTED_CONFIG_PATHS: view } });
		rmSync(view, { recursive: true, force: true });
		// the hidden steps a task depends on are not something a developer runs
		// mise lists tasks alphabetically, whatever their order in the file. Here they go in the order
		// a developer uses them — the order of the table above, which is the test's — and any the
		// test does not reach follow in tasks.toml's own order.
		const inUse = [...readFileSync(join(repo, "README.md"), "utf8").matchAll(/^\| \d+ \| `([a-z:]+)`/gm)].map((m) => m[1]);
		const inFile = [...readFileSync(join(repo, "tasks.toml"), "utf8").matchAll(/^\["?([a-z:]+)"?\]/gm)].map((m) => m[1]);
		const wanted = [...inUse, ...inFile].filter((n, i, all) => all.indexOf(n) === i);
		const place = (block) => {
			const at = wanted.indexOf((block.match(/^## `([a-z:]+)`/) || [])[1]);
			return at < 0 ? wanted.length : at;
		};
		const blocks = made.split(/^(?=## `)/m).sort((x, y) => place(x) - place(y));
		const body = blocks.join("\n").split("\n").filter((l) => !l.startsWith("- Depends:")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
		writeFileSync(join(docs, "tasks.md"), `---\ntitle: "Every task"\nnav_order: 3\n---\n\n${marker.replace("from a section of the repo's README.md: edit that, not this.", "by mise from tasks.toml (mise generate task-docs): edit a task's description there, not this.")}\n\n# Every task\n\n${order ? order.body.replaceAll("](tasks.md)", "](#reference)") : ""}\n\n## Reference\n\nWritten by mise itself from [\`tasks.toml\`](https://github.com/joeblew999/emdash-run/blob/main/tasks.toml): each task's description, arguments and flags. In your own project the same is one command away: \`mise tasks\`, or \`mise run <task> --help\`. What the last test showed for each, step by step, is on [What works](status.md).\n\n${body}\n`);
	}
	const about = {
		"Templates": "the eight kinds of site `site:new` can make",
		"An existing site": "using the tasks on a repo that already is an EmDash site",
		"This machine or deployed": "one rule: no flag is this machine, `--live` is the deployed site",
		"Signing in": "the four ways, and which to use",
		"Deploying": "putting a site on Cloudflare, undoing, logs, backups",
		"Plugins": "searching the registry, installing with no clicking, knowing one works, making your own",
		"Settings": "everything you can set in `mise.toml`",
		"Good to know": "what asks first, what stops the site, what is not there",
		"Working on emdash-run": "the tests, and where the rules are",
	};
	const index = ["| | |", "|---|---|", ...rest.map((p) => `| [${p.title}](${p.file}) | ${about[p.title] ?? ""} |`),
		"| [Every task](tasks.md) | in the order you use them; each one's description, arguments and flags — written by mise from `tasks.toml` |",
		"| [Favourite plugins](favourite-plugins.md) | the registry plugins `plugin:favourites` installs, why, and what was rejected |",
		"| [What works](status.md) | every task, and what the last test run showed |",
		"| [Upstream bugs](upstream.md) | where EmDash, Astro or wrangler do not behave as documented |",
		"| [For agents](agents/README.md) | the rules for working on this repo |",
		"| [Plans](plans/README.md) | what is next, and what was done |",
		"| [Writing docs](writing.md) | how these pages are written |"].join("\n");
	writeFileSync(join(docs, "README.md"), `---\ntitle: Home\nnav_order: 1\npermalink: /\n---\n\n${marker}\n\n${intro.trim()}\n\n## Set up\n\n${home ? home.body : ""}\n\n## In these docs\n\n${index}\n`);
}

console.log(`${fresh.filter((r) => r.result === "PASS").length} passed, ${fresh.filter((r) => r.result === "FAIL").length} failed in this run, ${took}s — docs/status.md: ${notTested.length} of ${tasks.length} tasks have no test`);
process.exit(fresh.some((r) => r.result === "FAIL") ? 1 : 0);
