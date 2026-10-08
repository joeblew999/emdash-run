// The records of the test, asked from the command line. (tests/run.mjs writes them.)
//
//   node tests/record.mjs --page status            the index page: every group, every task
//   node tests/record.mjs --page status-<group>    one group's page: every step, in the order it ran
//   node tests/record.mjs --coverage               every task has a test step, every step a task
//   node tests/record.mjs --depends [group]        what a group depends on: what re-runs it
import { closure } from "./lib/depends.mjs";
import { groups } from "./lib/groups.mjs";
import { groupPage, statusPage } from "./lib/pages.mjs";
import { coverage } from "./lib/results.mjs";

const [mode, arg] = process.argv.slice(2);
const group = arg?.replace("status-", "");

if (mode === "--page" && arg === "status") console.log(statusPage());
else if (mode === "--page" && groups.includes(group)) console.log(groupPage(group));
else if (mode === "--coverage") {
	const wrong = coverage();
	for (const line of wrong) console.error(line);
	if (wrong.length) console.error("Change the test with the task.");
	else console.log("coverage: every task in tasks.toml has a step in tests/*/steps.mjs, and every step names a real task");
	process.exitCode = wrong.length ? 1 : 0;
} else if (mode === "--depends") {
	for (const g of arg ? [arg] : groups) {
		const c = closure(g);
		console.log(`${g}\n  tasks:   ${c.tasks.filter((t) => !t.startsWith("step:")).join(" ")}\n  steps:   ${c.tasks.filter((t) => t.startsWith("step:")).length} hidden\n  scripts: ${c.scripts.filter((f) => f.endsWith(".mjs")).map((f) => f.slice(8)).join(" ")}`);
	}
} else {
	console.error("usage: node tests/record.mjs --page status | --page status-<group> | --coverage | --depends [group]");
	process.exitCode = 1;
}
