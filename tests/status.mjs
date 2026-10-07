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
out.push("---", "title: What works", "nav_order: 2", "---", "", "# What works", "");
out.push("Written by `tests/replay.sh` and `tests/status.mjs`. Do not edit: run a test.", "");
out.push(`**${results.filter((r) => r.result === "PASS").length} steps pass, ${failures.length} fail, ${notTested.length} of ${tasks.length} tasks have no test.**`, "");
out.push(`Last run: \`${tier}\`, tasks from ${from}, commit \`${commit}\`, ${when}, ${took}s. Each run replaces the steps it ran and keeps the rest; the table at the end says when each step last ran.`, "");
out.push("- `mise run test` — quick: the everyday tasks, one template, about a minute", "- `mise run test:full` — everything: both templates, then the tasks that act on a deployed site", "");
out.push("Every test runs as another developer would: a clean environment and an empty config folder. Only macOS so far.", "");
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
	const describe = Object.fromEntries(tasks.map((t) => [t.name, t.description]));
	const lines = [];
	for (const [where, heading] of [["cloudflare", "On this machine"], ["deployed", "On the deployed site"]]) {
		// in the order the test first USES each task (a refusal step is not a use); hidden tasks left out
		const hidden = new Set(tasks.filter((t) => t.hidden).map((t) => t.name));
		const rows = results.filter((r) => r.where === where && !r.refusal && !hidden.has(r.task)).sort((a, b) => a.order - b.order);
		const seen = new Set();
		const ordered = rows.filter((r) => !seen.has(r.task) && seen.add(r.task));
		if (!ordered.length) continue;
		lines.push(`**${heading}**`, "", "| | task | what it does | tested |", "|---|---|---|---|");
		ordered.forEach((r, i) => {
			const all = results.filter((x) => x.task === r.task && x.where === where);
			const bad = all.filter((x) => x.result === "FAIL").length;
			lines.push(`| ${i + 1} | \`${r.task}\` | ${describe[r.task] ?? ""} | ${bad ? "**FAILS**" : "yes"} |`);
		});
		lines.push("");
	}
	const block = `${begin}\n${lines.join("\n")}${end}`;
	writeFileSync(readme, text.slice(0, text.indexOf(begin)) + block + text.slice(text.indexOf(end) + end.length));
}
}
// The docs site's home page IS the README: one source. Written here with the site's front matter
// and its links pointed at the site's own pages.
{
	const text = readFileSync(join(repo, "README.md"), "utf8")
		.replaceAll("](docs/status.md)", "](status.md)")
		.replaceAll("](docs/plans/)", "](plans/README.md)")
		.replaceAll("](docs/agents/README.md)", "](agents/README.md)")
		.replaceAll("](admin/)", "](https://github.com/joeblew999/emdash-run/tree/main/admin)")
		.replace(/^Docs: .*\n/m, "Something wrong? [Open an issue](https://github.com/joeblew999/emdash-run/issues/new/choose).\n");
	writeFileSync(join(repo, "docs", "README.md"), "---\ntitle: Home\nnav_order: 1\npermalink: /\n---\n\n<!-- Written by tests/status.mjs from the repo's README.md: edit that, not this. -->\n\n" + text);
}

console.log(`${fresh.filter((r) => r.result === "PASS").length} passed, ${fresh.filter((r) => r.result === "FAIL").length} failed in this run, ${took}s — docs/status.md: ${notTested.length} of ${tasks.length} tasks have no test`);
process.exit(fresh.some((r) => r.result === "FAIL") ? 1 : 0);
