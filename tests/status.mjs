// What the tests saw, kept in tests/results.json, and the page of docs/ that is written from it.
// charter writes that page (docs/_generated.toml names the command below) and checks it is fresh;
// this prints it. The tasks page is charter's own: `charter docs-tasks`, from tasks.toml.
//
//   node tests/status.mjs <rows file> <tier> <tasks from> <commit> <took seconds>   record a run
//   node tests/status.mjs --page status     print docs/reference/status.md, from its # title on
//   node tests/status.mjs --coverage        every task has a test step, every step a task
//   node tests/status.mjs --green           the record has no failure and no untested task
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
// a description can hold <name>, a | or two dashes: each would break a table on the docs site
const cellText = (t) => t.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "\\|").replaceAll("--", "\\-\\-");

// `--green`: what a release needs of the record — no failing step, no task without a test run.
if (mode === "--green") {
	const failing = results.filter((r) => r.result === "FAIL");
	const untested = tasks().filter((t) => !results.some((r) => r.task === t.name));
	for (const r of failing) console.error(`FAIL  ${r.task} (${r.where}): ${r.step}`);
	if (untested.length) console.error(`no test run recorded for: ${untested.map((t) => t.name).join(", ")}`);
	if (failing.length || untested.length) {
		console.error("The record in tests/results.json is not green: mise run test:full");
		process.exit(1);
	}
	console.log(`green: ${results.length} recorded steps pass, every task has a test run`);
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
	const time = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);
	if (last) out.push(`The last run: \`${last.tier}\`, at commit \`${last.commit}\`, ${last.when}${last.runSeconds ? `, ${time(last.runSeconds)}` : ""}, on ${last.os ?? "macOS"}. A run replaces the steps it ran and keeps the rest: the last table says when each step ran. The same test runs on macOS, Linux and Windows in the \`stages\` workflow, on a release tag.`, "");
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
	// How long each run took, the last time it ran: one row per run still in the record.
	const runs = new Map();
	for (const r of results) if (r.runSeconds) runs.set(`${r.tier}|${r.when}`, r);
	if (runs.size) {
		out.push("", "## How long a run takes", "", "| Run | When | Steps recorded | Took |", "|---|---|---|---|");
		for (const r of [...runs.values()].sort((a, b) => String(b.when).localeCompare(String(a.when)))) {
			out.push(`| \`${r.tier}\` | ${r.when} | ${results.filter((x) => x.tier === r.tier && x.when === r.when).length} | ${time(r.runSeconds)} |`);
		}
	}
	out.push("", "## Every step", "", "| Task | Where | Step | | Seconds | Run | Commit | When |", "|---|---|---|---|---|---|---|---|");
	for (const r of [...results].sort((a, b) => (a.task + a.where).localeCompare(b.task + b.where) || a.order - b.order)) {
		out.push(`| \`${r.task}\` | ${r.where} | ${cellText(r.step)} | ${r.result} | ${r.seconds ?? ""} | ${r.tier}${r.from === "GitHub" ? ", from GitHub" : ""} | \`${r.commit}\` | ${r.when} |`);
	}
	console.log(out.join("\n"));
	process.exit(0);
}

// Record a run. Its rows replace older ones for the same step and the rest are kept, so a quick
// run does not wipe out what the full run or the deployed part showed. A full run is the whole
// truth for each kind of site it ran on: older steps for those go, so a renamed step cannot linger.
const [rowsFile, tier, from, commit, took] = process.argv.slice(2);
if (!rowsFile || !existsSync(rowsFile)) {
	console.error("usage: node tests/status.mjs <rows file> <tier> <tasks from> <commit> <seconds> | --page status | --coverage");
	process.exit(1);
}
// where it ran: the stages workflow shows this record for each of its three machines
const os = { darwin: "macOS", linux: "Linux", win32: "Windows" }[process.platform] ?? process.platform;
const when = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const fresh = readFileSync(rowsFile, "utf8").split("\n").filter(Boolean).map((line, order) => {
	const [task, where, step, result, detail, kind, seconds, group] = line.split("|").map((x) => x.trim());
	// seconds: how long this step took; runSeconds: how long the whole run it was part of took
	return { task, where, step, result, detail, refusal: kind === "no", seconds: Number(seconds) || 0, group: group || "", runSeconds: Number(took) || 0, tier, from, commit, when, os, order };
});
const key = (r) => `${r.task}|${r.where}|${r.step}`;
const replaced = new Set(fresh.map(key));
const ran = new Set(fresh.map((r) => r.where));
const kept = results.filter((r) => (tier === "full" ? !ran.has(r.where) : !replaced.has(key(r))));
writeFileSync(store, JSON.stringify(kept.concat(fresh), null, 1) + "\n");
const bad = fresh.filter((r) => r.result === "FAIL").length;
console.log(`${fresh.length - bad} passed, ${bad} failed in this run, ${took}s. Recorded in tests/results.json; the pages: mise run docs:setup`);
process.exit(bad ? 1 : 0);
