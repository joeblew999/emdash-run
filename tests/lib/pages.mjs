// The pages of docs/reference/ written from the records: status.md, the index, and one per group.
// charter writes them (docs/_generated.toml names `node tests/record.mjs --page …`) and checks they
// are fresh; these print them.
import { about, groups, tasks } from "./groups.mjs";
import { everyRow, rowsOf, stateOf } from "./results.mjs";

// a description can hold <name>, a | or two dashes: each would break a table on the docs site
const cell = (t) => String(t).replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "\\|").replaceAll("--", "\\-\\-").replaceAll("{", "(").replaceAll("}", ")");
const time = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);
const siteName = { cloudflare: "a Cloudflare site", node: "a Node site", deployed: "the deployed site" };

export const statusPage = () => {
	const all = tasks();
	const results = everyRow();
	const failures = results.filter((r) => r.result === "FAIL");
	const notTested = all.filter((t) => !results.some((r) => r.task === t.name));
	const out = ["# What works: every task, and what the last test run showed", ""];
	out.push(`**${results.filter((r) => r.result === "PASS").length} steps pass, ${failures.length} fail, ${notTested.length} of ${all.length} tasks have no recorded run on this machine.**`, "");
	out.push("The test is in four groups, named as the tasks are. Each runs alone, on a site of its own, and has a page of its own with every step. A group is **proven** when its everyday steps passed and nothing it depends on has changed since: its tasks, its scripts, its steps, the site. `mise run test` runs the everyday steps of the groups that are not proven, in about a minute a group. The long steps run with `mise run test --level all`. The `stages` workflow runs both on Linux, macOS and Windows. [How to help](../contributing.md) says more.", "");
	out.push("| Group | What it tests | Run it | Everyday steps | Long steps | Took | Last run | Commit |", "|---|---|---|---|---|---|---|---|");
	for (const g of groups) {
		const rows = rowsOf(g).filter((r) => r.where !== "node");
		const long = rows.filter((r) => r.long);
		const everyday = rows.filter((r) => !r.long);
		const last = rows[0];
		out.push(`| [\`${g}\`](status-${g}.md) | ${about[g]} | \`mise run test ${g}\` | ${everyday.length}: ${stateOf(everyday, g)} | ${long.length ? `${long.length}: ${stateOf(long, g)}` : g === "live" ? "" : "no run recorded"} | ${last?.runSeconds ? time(last.runSeconds) : ""} | ${last?.when ?? ""} | ${last ? `\`${last.commit}\`` : ""} |`);
	}
	const node = results.filter((r) => r.where === "node");
	if (node.length) out.push("", `On a Node site (\`mise run test --node --level all\`, before a release): ${node.filter((r) => r.result === "PASS").length} of ${node.length} steps pass, last run ${node[0].when}.`);
	if (failures.length) {
		out.push("", "## Failing", "", "| Group | Task | On | Step | Its last output |", "|---|---|---|---|---|");
		for (const r of failures) out.push(`| [\`${r.group}\`](status-${r.group}.md) | \`${r.task}\` | ${r.where} | ${cell(r.step)} | ${cell(r.detail || "")} |`);
	}
	const tally = (task, where) => {
		const rows = results.filter((r) => r.task === task && r.where === where);
		if (!rows.length) return "";
		const failed = rows.filter((r) => r.result === "FAIL").length;
		return failed ? `**FAIL** ${failed} of ${rows.length}` : `pass ×${rows.length}`;
	};
	out.push("", "## By task", "", "| Task | Cloudflare site | Node site | Deployed site | |", "|---|---|---|---|---|");
	for (const t of all) {
		const cells = ["cloudflare", "node", "deployed"].map((w) => tally(t.name, w));
		out.push(`| \`${t.name}\`${t.hidden ? " (hidden)" : ""} | ${cells.join(" | ")} | ${cells.every((c) => c === "") ? "on CI: its steps are long ones" : ""} |`);
	}
	return out.join("\n");
};

export const groupPage = (g) => {
	const rows = rowsOf(g);
	const out = [`# The ${g} tests: ${about[g]}`, ""];
	out.push(`Run them: \`mise run test ${g}\`. The steps: \`tests/${g}/steps.mjs\`. Every group: [What works](status.md).`, "");
	if (!rows.length) out.push("No run is recorded.");
	for (const where of ["cloudflare", "deployed", "node"]) {
		const mine = rows.filter((r) => r.where === where).sort((a, b) => Number(!!a.long) - Number(!!b.long) || a.order - b.order);
		if (!mine.length) continue;
		const failed = mine.filter((r) => r.result === "FAIL");
		out.push(`## On ${siteName[where]}`, "");
		out.push(`**${mine.length - failed.length} of ${mine.length} steps pass${mine[0].runSeconds ? `, in ${time(mine[0].runSeconds)}` : ""}.** ${where === "node" ? "" : `State: ${stateOf(mine.filter((r) => !r.long), g)}. `}Run ${mine[0].when} at commit \`${mine[0].commit}\`, on ${mine[0].os}${mine[0].from === "GitHub" ? ", with the tasks from GitHub" : ""}.`, "");
		out.push("| | Task | Step | Seconds |", "|---|---|---|---|");
		for (const r of mine) out.push(`| ${r.result === "PASS" ? "pass" : "**FAIL**"} | \`${r.task}\` | ${cell(r.step)}${r.refusal ? " (it must refuse)" : ""}${r.long ? " — long" : ""}${r.result === "FAIL" && r.detail ? `<br>${cell(r.detail)}` : ""} | ${r.seconds} |`);
		out.push("");
	}
	return out.join("\n").trimEnd();
};
