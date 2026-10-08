// What the dev:test tasks run: Node's own test runner (node --test), and nothing else — no record,
// no report of its own. mise runs the groups side by side (dev.toml: dev:test depends on one task a
// group), so this runs ONE thing: the unit tests, or one group's steps.
//
//   node tests/run.mjs --unit                    the unit tests, and that every task has a step
//   node tests/run.mjs <group> [--level …]       that group's steps: site, signin, plugin, live
//
//   tests/<group>/steps.mjs   a group's steps: tests of Node's runner, named after the task each tests
//   tests/lib/step.mjs        what a steps file is written with: step, refuses, long, setup
//   tests/lib/site.mjs        what a step does: run a task, read a file, ask the site
import { spawnSync } from "node:child_process";

const groups = ["site", "signin", "plugin", "live"];
const argv = process.argv.slice(2);
const flag = (/** @type {string} */ name) => (argv.includes(name) ? argv.splice(argv.indexOf(name), 2)[1] : "");
const level = flag("--level") || "fast";
const only = flag("--only");
const [group] = argv.filter((a) => groups.includes(a));
if (!["smoke", "fast", "all"].includes(level) || argv.some((a) => !groups.includes(a) && !["--node", "--unit"].includes(a)) || (!group && !argv.includes("--unit"))) {
	console.error("usage: node tests/run.mjs --unit | <site|signin|plugin|live> [--level smoke|fast|all] [--node] [--only <words>]");
	process.exit(2);
}
const test = (/** @type {string[]} */ ...args) => spawnSync(process.execPath, ["--test", ...args], { stdio: "inherit", env: { ...process.env, TEST_LEVEL: level, TEST_SITE: argv.includes("--node") ? "node" : "cloudflare" } }).status ?? 1;

if (argv.includes("--unit")) process.exit(test("tests/**/*.test.mjs"));
// smoke is the site group's steps that make a project, start the site, ask it and stop it: the
// other groups have nothing at that level
if (level === "smoke" && group !== "site") process.exit(0);
const pattern = level === "smoke" ? "site:(ports|start|stop)" : only;
process.exit(test(...(pattern ? [`--test-name-pattern=${pattern}`] : []), `tests/${group}/steps.mjs`));
