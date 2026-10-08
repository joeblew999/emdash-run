// What the tests saw, kept in tests/results.json, and the two pages of docs/ that are written
// from it and from tasks.toml. charter writes those pages (docs/_generated.toml names the two
// commands below) and checks they are fresh; this prints them.
//
//   node tests/status.mjs <rows file> <tier> <tasks from> <commit> <took seconds>   record a run
//   node tests/status.mjs --page tasks      print docs/reference/tasks.md, from its # title on
//   node tests/status.mjs --page status     print docs/reference/status.md
//   node tests/status.mjs --coverage        every task has a test step, every step a task
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const store = join(repo, "tests", "results.json");
const script = readFileSync(join(repo, "tests", "replay.sh"), "utf8");
// Every task a project gets: those in tasks.toml (this repo's own — test, docs:…, repo — are not
// counted), without the hidden steps.
const tasks = () =>
	JSON.parse(execFileSync("mise", ["tasks", "ls", "--hidden", "--json"], { cwd: repo, encoding: "utf8" }))
		.filter((t) => !t.name.startsWith("step:") && t.source.endsWith("tasks.toml"))
		.map((t) => ({ name: t.name, hidden: t.hide, description: t.description }));
// The steps of the test, by the task each names: `ok <task> "…"` and `no <task> "…"`.
const stepped = (text, kinds = "ok|no") => [...text.matchAll(new RegExp(`^\\s*(?:\\[[^\\n]*?\\]\\s*\\|\\|\\s*|case[^\\n]*?\\)\\s*)?(?:${kinds})\\s+([a-z:]+)\\s+"`, "gm"))].map((m) => m[1]);
const [mode, arg] = process.argv.slice(2);

// PROVENANCE. It runs first in every test and in the commit check, and fails them: tasks.toml
// cannot change without the test changing with it.
if (mode === "--coverage") {
	const names = tasks().map((t) => t.name);
	const have = new Set(stepped(script));
	const untested = names.filter((n) => !have.has(n));
	const unknown = [...have].filter((n) => !names.includes(n));
	if (untested.length) console.error(`tasks.toml has tasks with no step in tests/replay.sh: ${untested.join(", ")}`);
	if (unknown.length) console.error(`tests/replay.sh has steps for tasks that are not in tasks.toml: ${unknown.join(", ")}`);
	if (untested.length || unknown.length) {
		console.error("Change the test with the task. Nothing was run.");
		process.exit(1);
	}
	console.log(`provenance: all ${names.length} tasks in tasks.toml have a step in tests/replay.sh, and every step names a real task`);
	process.exit(0);
}

const results = existsSync(store) ? JSON.parse(readFileSync(store, "utf8")) : [];
// The order a developer uses the tasks in is the order the test first USES each one (a refusal
// is not a use): on this machine, then on the deployed site.
const part = { local: script.slice(script.indexOf("local_site() {"), script.indexOf("live_site() {")), deployed: script.slice(script.indexOf("live_site() {")) };
const firstUse = (where) => stepped(part[where], "ok").filter((n, i, all) => all.indexOf(n) === i);
// a description can hold <name>, a | or two dashes: each would break a table on the docs site
const cellText = (t) => t.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "\\|").replaceAll("--", "\\-\\-");

if (mode === "--page" && arg === "tasks") {
	const all = tasks();
	const visible = all.filter((t) => !t.hidden);
	const describe = Object.fromEntries(visible.map((t) => [t.name, cellText(t.description)]));
	const out = ["# Tasks: every one, in the order you use them", ""];
	out.push("Run one with `mise run <task>`; arguments and flags go after `--`. In your own project `mise tasks` lists them, and `mise run <task> --help` shows one. What each showed in the last test run: [What works](status.md).", "");
	for (const [where, heading] of [["local", "On this machine"], ["deployed", "On the deployed site"]]) {
		const ordered = firstUse(where).filter((n) => describe[n] !== undefined && !(where === "deployed" && n.startsWith("site:")));
		out.push(`## ${heading}`, "", "| | Task | What it does |", "|---|---|---|");
		ordered.forEach((n, i) => out.push(`| ${i + 1} | [\`${n}\`](#${n.replaceAll(":", "")}) | ${describe[n]} |`));
		out.push("");
	}
	// Each task with its arguments and flags, as mise itself documents it (mise generate
	// task-docs), asked from an empty project that includes only tasks.toml — what a developer's
	// project gets. mise lists them alphabetically: here they follow the order above.
	const view = mkdtempSync(join(tmpdir(), "emdash-run-tasks-"));
	writeFileSync(join(view, "mise.toml"), `[task_config]\nincludes = [${JSON.stringify(join(repo, "tasks.toml").replaceAll("\\", "/"))}]\n`);
	const made = execFileSync("mise", ["generate", "task-docs", "--style", "detailed"], { cwd: view, encoding: "utf8", env: { ...process.env, MISE_TRUSTED_CONFIG_PATHS: view } });
	rmSync(view, { recursive: true, force: true });
	const inFile = [...readFileSync(join(repo, "tasks.toml"), "utf8").matchAll(/^\["?([a-z:]+)"?\]/gm)].map((m) => m[1]);
	const wanted = [...firstUse("local"), ...firstUse("deployed"), ...inFile].filter((n, i, list) => list.indexOf(n) === i);
	const place = (block) => {
		const at = wanted.indexOf((block.match(/^## `([a-z:]+)`/) || [])[1]);
		return at < 0 ? wanted.length : at;
	};
	const blocks = made.split(/^(?=## `)/m).filter((b) => b.startsWith("## `")).sort((x, y) => place(x) - place(y));
	out.push("## Each task", "");
	// one level down, under "Each task"; the hidden steps a task depends on are not something to run
	out.push(blocks.join("\n").split("\n").filter((l) => !l.startsWith("- Depends:")).map((l) => l.replace(/^## `/, "### `").replace(/^### (Arguments|Flags)$/, "**$1**")).join("\n").replace(/\n{3,}/g, "\n\n").trim());
	console.log(out.join("\n"));
	process.exit(0);
}

if (mode === "--page" && arg === "status") {
	const all = tasks();
	const wheres = ["cloudflare", "node", "deployed"];
	const cell = (task, where) => {
		const rows = results.filter((r) => r.task === task && r.where === where);
		if (!rows.length) return "";
		const failed = rows.filter((r) => r.result === "FAIL").length;
		return failed ? `**FAIL** ${failed} of ${rows.length}` : `pass ×${rows.length}`;
	};
	const notTested = all.filter((t) => !results.some((r) => r.task === t.name));
	const failures = results.filter((r) => r.result === "FAIL");
	const last = [...results].sort((a, b) => String(b.when).localeCompare(String(a.when)))[0];
	const out = ["# What works: every task, and what the last test run showed", ""];
	out.push(`**${results.filter((r) => r.result === "PASS").length} steps pass, ${failures.length} fail, ${notTested.length} of ${all.length} tasks have no test.**`, "");
	if (last) out.push(`The last run: \`${last.tier}\`, at commit \`${last.commit}\`, ${last.when}, on a Mac. A run replaces the steps it ran and keeps the rest: the last table says when each step ran. The same test runs on macOS, Linux and Windows in the \`stages\` workflow, on a release tag.`, "");
	out.push("Every test runs as another developer would: a clean environment, an empty config folder, a site of its own in a temporary folder. Run them: [How to help](../contributing.md).", "");
	out.push("## By task", "", "| Task | Cloudflare site | Node site | Deployed site | |", "|---|---|---|---|---|");
	for (const t of all) {
		const cells = wheres.map((w) => cell(t.name, w));
		out.push(`| \`${t.name}\`${t.hidden ? " (hidden)" : ""} | ${cells.join(" | ")} | ${cells.every((c) => c === "") ? "**NOT TESTED**" : ""} |`);
	}
	if (failures.length) {
		out.push("", "## Failing", "", "| Task | Where | Step | Its last output |", "|---|---|---|---|");
		for (const r of failures) out.push(`| \`${r.task}\` | ${r.where} | ${cellText(r.step)} | ${cellText(r.detail || "").replaceAll("{", "(").replaceAll("}", ")")} |`);
	}
	out.push("", "## Every step", "", "| Task | Where | Step | | Run | Commit | When |", "|---|---|---|---|---|---|---|");
	for (const r of [...results].sort((a, b) => (a.task + a.where).localeCompare(b.task + b.where) || a.order - b.order)) {
		out.push(`| \`${r.task}\` | ${r.where} | ${cellText(r.step)} | ${r.result} | ${r.tier}${r.from === "GitHub" ? ", from GitHub" : ""} | \`${r.commit}\` | ${r.when} |`);
	}
	console.log(out.join("\n"));
	process.exit(0);
}

// Record a run. Its rows replace older ones for the same step and the rest are kept, so a quick
// run does not wipe out what the full run or the deployed part showed. A full run is the whole
// truth for each kind of site it ran on: older steps for those go, so a renamed step cannot linger.
const [rowsFile, tier, from, commit, took] = process.argv.slice(2);
if (!rowsFile || !existsSync(rowsFile)) {
	console.error("usage: node tests/status.mjs <rows file> <tier> <tasks from> <commit> <seconds> | --page tasks|status | --coverage");
	process.exit(1);
}
const when = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const fresh = readFileSync(rowsFile, "utf8").split("\n").filter(Boolean).map((line, order) => {
	const [task, where, step, result, detail, kind] = line.split("|").map((x) => x.trim());
	return { task, where, step, result, detail, refusal: kind === "no", tier, from, commit, when, order };
});
const key = (r) => `${r.task}|${r.where}|${r.step}`;
const replaced = new Set(fresh.map(key));
const ran = new Set(fresh.map((r) => r.where));
const kept = results.filter((r) => (tier === "full" ? !ran.has(r.where) : !replaced.has(key(r))));
writeFileSync(store, JSON.stringify(kept.concat(fresh), null, 1) + "\n");
const bad = fresh.filter((r) => r.result === "FAIL").length;
console.log(`${fresh.length - bad} passed, ${bad} failed in this run, ${took}s. Recorded in tests/results.json; the pages: mise run docs:setup`);
process.exit(bad ? 1 : 0);
