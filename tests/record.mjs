// What the tests saw. Each group keeps its own record, tests/<group>/results.json, and has its own
// page in docs/reference/, written from it; status.md is the index of them. charter writes the
// pages (docs/_generated.toml names the commands below) and checks they are fresh; this prints them.
//
//   node tests/record.mjs --record <group> <rows.json> <where> <tasks from> <commit> <seconds> <all|everyday>
//   node tests/record.mjs --page status            the index: every group, every task
//   node tests/record.mjs --page status-<group>    one group: every step, in the order it ran
//   node tests/record.mjs --coverage               every task has a test step, every step a task
//   node tests/record.mjs --green                  no failure recorded, no task without a run
//   node tests/record.mjs --proven <group> [where] [all|everyday]   exit 0: passed, nothing changed since
//   node tests/record.mjs --depends [group]    what a group depends on: what re-runs it
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const groups = ["site", "signin", "plugin", "live"];
const about = {
	site: "making, running, checking and deleting a site",
	signin: "the CLI and a browser window as an administrator of the built site",
	plugin: "a plugin of your own, and plugins from EmDash's registry",
	live: "the tasks that act on a deployed site",
};
const read = (f) => (existsSync(join(repo, f)) ? readFileSync(join(repo, f), "utf8") : "");
const storeOf = (g) => join(repo, "tests", g, "results.json");
const rowsOf = (g) => (existsSync(storeOf(g)) ? JSON.parse(readFileSync(storeOf(g), "utf8")).map((r) => ({ ...r, group: g })) : []);
const everyRow = () => groups.flatMap(rowsOf);
// Every task a project gets: those in tasks.toml (this repo's own — test, docs:…, repo — are not
// counted), without the hidden steps.
const tasks = () =>
	JSON.parse(execFileSync("mise", ["tasks", "ls", "--hidden", "--json"], { cwd: repo, encoding: "utf8" }))
		.filter((t) => !t.name.startsWith("step:") && t.source.endsWith("tasks.toml"))
		.map((t) => ({ name: t.name, hidden: t.hide, description: t.description }));
// The steps of a group, by the task each names: t.ok("<task>", …) and t.no("<task>", …).
const stepped = (g) => [...read(`tests/${g}/steps.mjs`).matchAll(/\bt\.(?:ok|no)\(\s*"([a-z:]+)"/g)].map((m) => m[1]);
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
const [mode, arg, arg2] = process.argv.slice(2);

// WHAT A GROUP DEPENDS ON, as one fingerprint — worked out, not listed by hand. From the tasks its
// steps run (every task named in its steps.mjs), follow tasks.toml to every task and hidden step
// those run, and from those to every script they name and every script those import. Add the
// runner, the group's own folder and the site the test copies. A group that passed at this
// fingerprint is PROVEN. Change scripts/live-preview.mjs and only the live group's moves.
const closure = (group) => {
	const blocks = new Map();
	let preamble = "";
	for (const b of read("tasks.toml").split(/^(?=\[)/m)) {
		const name = (b.match(/^\["?([a-z][a-z:-]*)"?\]/) || [])[1];
		if (!name || ["env", "vars", "settings", "tools"].includes(name)) preamble += b;
		else blocks.set(name, b);
	}
	const tasksIn = new Set();
	const walk = (name) => {
		if (tasksIn.has(name) || !blocks.has(name)) return;
		tasksIn.add(name);
		// what the task runs is its lines that are not its description (which names tasks it only mentions)
		const body = blocks.get(name).split("\n").filter((l) => !/^\s*(description|#)/.test(l)).join("\n");
		for (const m of body.matchAll(/task\s*=\s*"([^"]+)"|mise run (?:--yes )?([a-z][a-z:-]*)/g)) walk(m[1] || m[2]);
		for (const d of body.matchAll(/^depends\s*=\s*\[([^\]]*)\]/gm)) for (const m of d[1].matchAll(/"([^"]+)"/g)) walk(m[1]);
	};
	for (const m of read(`tests/${group}/steps.mjs`).matchAll(/"([a-z][a-z:-]*)"/g)) walk(m[1]);
	const scripts = new Set();
	const have = new Set(git("ls-files", "scripts").split("\n").filter(Boolean));
	const follow = (f) => {
		if (scripts.has(f) || !have.has(f)) return;
		scripts.add(f);
		// a script it imports ("./x.mjs") or starts (join(here, "x.mjs"))
		for (const m of read(f).matchAll(/"\.\/([\w-]+\.mjs)"|here,\s*"([\w-]+\.mjs)"/g)) follow(`scripts/${m[1] || m[2]}`);
	};
	for (const t of tasksIn) for (const m of blocks.get(t).matchAll(/scripts\/([\w\/-]+\.mjs)/g)) follow(`scripts/${m[1]}`);
	for (const f of have) if (!f.endsWith(".mjs")) scripts.add(f); // package.json, the lock file, quiet/
	return { preamble, tasks: [...tasksIn].sort(), blocks, scripts: [...scripts].sort() };
};
const fingerprint = (group) => {
	const h = createHash("sha256");
	const c = closure(group);
	h.update(c.preamble);
	for (const t of c.tasks) h.update(c.blocks.get(t));
	for (const f of c.scripts) h.update(f).update(read(f));
	h.update(read("tests/run.mjs"));
	for (const f of readdirSync(join(repo, "tests", group), { recursive: true }).map(String).sort()) {
		if (!f.endsWith("results.json") && !f.includes("fixtures") && /\.[a-z]+$/.test(f)) h.update(f).update(read(join("tests", group, f)));
	}
	if (group !== "live") h.update(git("ls-files", "-s", "site")).update(git("diff", "--", "site"));
	return h.digest("hex").slice(0, 12);
};
// `--depends [group]`: what each group depends on, by name — and so what re-runs it.
if (process.argv[2] === "--depends") {
	for (const g of process.argv[3] ? [process.argv[3]] : groups) {
		const c = closure(g);
		console.log(`${g}\n  tasks:   ${c.tasks.filter((t) => !t.startsWith("step:")).join(" ")}\n  steps:   ${c.tasks.filter((t) => t.startsWith("step:")).length} hidden\n  scripts: ${c.scripts.filter((f) => f.endsWith(".mjs")).map((f) => f.slice(8)).join(" ")}`);
	}
	process.exit(0);
}
// A group's state is that of its everyday steps: the ones a developer's own run makes.
const stateOf = (every, group, rows = every.filter((r) => !r.long)) =>
	!rows.length ? "no run recorded" : rows.some((r) => r.result === "FAIL") ? "**a step fails**" : rows.every((r) => r.proof === fingerprint(group)) ? "proven" : "changed since it passed";
if (mode === "--fingerprint") {
	for (const g of arg ? [arg] : groups) console.log(`${g} ${fingerprint(g)}`);
	process.exit(0);
}
if (mode === "--proven") {
	const rows = rowsOf(arg).filter((r) => r.where === (arg2 || (arg === "live" ? "deployed" : "cloudflare")));
	// every step: the long ones too have to have been run, and passed at this fingerprint
	const whole = process.argv[5] === "all" && arg !== "live";
	process.exit(stateOf(rows, arg) === "proven" && (!whole || stateOf(rows, arg, rows.filter((r) => r.long)) === "proven") ? 0 : 1);
}

// PROVENANCE. It runs first in every test and in the commit check, and fails them: tasks.toml
// cannot change without the test changing with it.
if (mode === "--coverage") {
	const names = tasks().map((t) => t.name);
	const have = new Set(groups.flatMap(stepped));
	const untested = names.filter((n) => !have.has(n));
	const unknown = [...have].filter((n) => !names.includes(n));
	if (untested.length) console.error(`tasks.toml has tasks with no step in tests/*/steps.mjs: ${untested.join(", ")}`);
	if (unknown.length) console.error(`tests/*/steps.mjs has steps for tasks that are not in tasks.toml: ${unknown.join(", ")}`);
	if (untested.length || unknown.length) {
		console.error("Change the test with the task. Nothing was run.");
		process.exit(1);
	}
	console.log(`provenance: all ${names.length} tasks in tasks.toml have a step in tests/*/steps.mjs, and every step names a real task`);
	process.exit(0);
}

// `--green`: what a release needs of the record — no failing step, no task without a test run.
if (mode === "--green") {
	const results = everyRow();
	const failing = results.filter((r) => r.result === "FAIL");
	const untested = tasks().filter((t) => !results.some((r) => r.task === t.name));
	for (const r of failing) console.error(`FAIL  ${r.task} (${r.group}, ${r.where}): ${r.step}`);
	if (untested.length) console.error(`no test run recorded for: ${untested.map((t) => t.name).join(", ")}`);
	if (failing.length || untested.length) {
		console.error("The record is not green: mise run test");
		process.exit(1);
	}
	console.log(`green: ${results.length} recorded steps pass, every task has a test run`);
	process.exit(0);
}

// a description can hold <name>, a | or two dashes: each would break a table on the docs site
const cellText = (t) => String(t).replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "\\|").replaceAll("--", "\\-\\-").replaceAll("{", "(").replaceAll("}", ")");
const time = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);
const siteName = { cloudflare: "a Cloudflare site", node: "a Node site", deployed: "the deployed site" };

if (mode === "--page" && arg === "status") {
	const all = tasks();
	const results = everyRow();
	const failures = results.filter((r) => r.result === "FAIL");
	const notTested = all.filter((t) => !results.some((r) => r.task === t.name));
	const out = ["# What works: every task, and what the last test run showed", ""];
	out.push(`**${results.filter((r) => r.result === "PASS").length} steps pass, ${failures.length} fail, ${notTested.length} of ${all.length} tasks have no test.**`, "");
	out.push("The test is in four groups, named as the tasks are. Each runs alone, on a site of its own, and has a page of its own with every step. A group is **proven** when its everyday steps passed and nothing it depends on has changed since: its tasks, its scripts, its steps, the site. `mise run test` runs the everyday steps of the groups that are not proven, in about a minute a group. The long steps run with `mise run test:all`, which is what CI runs on Linux, macOS and Windows. [How to help](../contributing.md) says more.", "");
	out.push("| Group | What it tests | Run it | Everyday steps | Long steps | Took | Last run | Commit |", "|---|---|---|---|---|---|---|---|");
	for (const g of groups) {
		const rows = rowsOf(g).filter((r) => r.where !== "node");
		const last = rows[0];
		const long = rows.filter((r) => r.long);
		out.push(`| [\`${g}\`](status-${g}.md) | ${about[g]} | \`mise run test:${g}\` | ${rows.length - long.length}: ${stateOf(rows, g)} | ${long.length ? `${long.length}: ${stateOf(rows, g, long)}` : g === "live" ? "" : "no run recorded"} | ${last?.runSeconds ? time(last.runSeconds) : ""} | ${last?.when ?? ""} | ${last ? `\`${last.commit}\`` : ""} |`);
	}
	const node = results.filter((r) => r.where === "node");
	if (node.length) out.push("", `On a Node site (\`mise run test:node\`, before a release): ${node.filter((r) => r.result === "PASS").length} of ${node.length} steps pass, last run ${node[0].when}.`);
	if (failures.length) {
		out.push("", "## Failing", "", "| Group | Task | On | Step | Its last output |", "|---|---|---|---|---|");
		for (const r of failures) out.push(`| [\`${r.group}\`](status-${r.group}.md) | \`${r.task}\` | ${r.where} | ${cellText(r.step)} | ${cellText(r.detail || "")} |`);
	}
	const cell = (task, where) => {
		const rows = results.filter((r) => r.task === task && r.where === where);
		if (!rows.length) return "";
		const failed = rows.filter((r) => r.result === "FAIL").length;
		return failed ? `**FAIL** ${failed} of ${rows.length}` : `pass ×${rows.length}`;
	};
	out.push("", "## By task", "", "| Task | Cloudflare site | Node site | Deployed site | |", "|---|---|---|---|---|");
	for (const t of all) {
		const cells = ["cloudflare", "node", "deployed"].map((w) => cell(t.name, w));
		out.push(`| \`${t.name}\`${t.hidden ? " (hidden)" : ""} | ${cells.join(" | ")} | ${cells.every((c) => c === "") ? "**NOT TESTED**" : ""} |`);
	}
	console.log(out.join("\n"));
	process.exit(0);
}

if (mode === "--page" && groups.includes(arg?.replace("status-", ""))) {
	const g = arg.replace("status-", "");
	const rows = rowsOf(g);
	const out = [`# The ${g} tests: ${about[g]}`, ""];
	out.push(`Run them: \`mise run test:${g}\`. The steps: \`tests/${g}/steps.mjs\`. Every group: [What works](status.md).`, "");
	if (!rows.length) out.push("No run is recorded.");
	for (const where of ["cloudflare", "deployed", "node"]) {
		const mine = rows.filter((r) => r.where === where).sort((a, b) => !!a.long - !!b.long || a.order - b.order);
		if (!mine.length) continue;
		const failed = mine.filter((r) => r.result === "FAIL");
		out.push(`## On ${siteName[where]}`, "");
		out.push(`**${mine.length - failed.length} of ${mine.length} steps pass${mine[0].runSeconds ? `, in ${time(mine[0].runSeconds)}` : ""}.** ${where === "node" ? "" : `State: ${stateOf(mine, g)}. `}Run ${mine[0].when} at commit \`${mine[0].commit}\`, on ${mine[0].os}${mine[0].from === "GitHub" ? ", with the tasks from GitHub" : ""}.`, "");
		out.push("| | Task | Step | Seconds |", "|---|---|---|---|");
		for (const r of mine) out.push(`| ${r.result === "PASS" ? "pass" : "**FAIL**"} | \`${r.task}\` | ${cellText(r.step)}${r.refusal ? " (it must refuse)" : ""}${r.long ? " — long" : ""}${r.result === "FAIL" && r.detail ? `<br>${cellText(r.detail)}` : ""} | ${r.seconds} |`);
		out.push("");
	}
	console.log(out.join("\n").trimEnd());
	process.exit(0);
}

// Record a group's run. A run of every step is the whole truth for that group on that kind of
// site: everything recorded for it before goes, so a step that was renamed or removed cannot
// linger. A run of the everyday steps replaces those, and leaves the long steps as last recorded.
if (mode === "--record") {
	const [group, rowsFile, where, from, commit, took, depth] = process.argv.slice(3);
	if (!groups.includes(group) || !existsSync(rowsFile)) {
		console.error("usage: node tests/record.mjs --record <group> <rows.json> <where> <tasks from> <commit> <seconds> <all|everyday>");
		process.exit(1);
	}
	// where it ran: the stages workflow shows this record for each of its three machines
	const os = { darwin: "macOS", linux: "Linux", win32: "Windows" }[process.platform] ?? process.platform;
	const when = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
	const proof = fingerprint(group);
	// seconds: how long this step took; runSeconds: how long the group's run took
	const fresh = JSON.parse(readFileSync(rowsFile, "utf8")).map((r, order) => ({ task: r.task, where, step: r.step, result: r.result, detail: r.detail, refusal: r.refusal, long: !!r.long, seconds: r.seconds, proof, runSeconds: Number(took) || 0, from, commit, when, os, order }));
	const kept = rowsOf(group).filter((r) => r.where !== where || (depth !== "all" && r.long)).map(({ group: _, ...r }) => r);
	writeFileSync(storeOf(group), JSON.stringify(fresh.concat(kept), null, 1) + "\n");
	const bad = fresh.filter((r) => r.result === "FAIL").length;
	console.log(`${group}: ${fresh.length - bad} passed, ${bad} failed, ${time(Number(took) || 0)}. Recorded in tests/${group}/results.json`);
	process.exit(bad ? 1 : 0);
}
console.error("usage: node tests/record.mjs --record … | --page status | --page status-<group> | --coverage | --green | --proven <group> | --fingerprint");
process.exit(1);
