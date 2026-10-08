// What `mise run dev:test` runs: Node's own test runner (node --test) on the unit tests, then on
// the steps of the groups asked for, one after the other. Nothing else: no record, no report of
// its own. The levels, groups and flags are the task's (dev.toml): mise run dev:test --help
//
//   tests/<group>/steps.mjs   a group's steps: tests of Node's runner, named after the task each tests
//   tests/lib/step.mjs        what a steps file is written with: step, refuses, long, setup
//   tests/lib/site.mjs        what a step does: run a task, read a file, ask the site
//   tests/**/*.test.mjs       the unit tests, and that every task has a step
import { spawnSync } from "node:child_process";

const groups = ["site", "signin", "plugin", "live"];
const argv = process.argv.slice(2);
const flag = (/** @type {string} */ name) => (argv.includes(name) ? argv.splice(argv.indexOf(name), 2)[1] : "");
const level = flag("--level") || "fast";
// smoke: the steps that make a project, start the site, ask it and stop it
const only = level === "smoke" ? "site:(ports|start|stop)" : flag("--only");
const onNode = argv.includes("--node");
const asked = argv.filter((a) => groups.includes(a));
if (!["smoke", "fast", "all"].includes(level) || argv.some((a) => !groups.includes(a) && a !== "--node")) {
	console.error("usage: node tests/run.mjs [site|signin|plugin|live]… [--level smoke|fast|all] [--node] [--only <words>]");
	process.exit(2);
}
// live is run when it is asked for by name: it deploys
const want = level === "smoke" ? ["site"] : asked.length ? asked : ["site", "signin", "plugin"];

const test = (/** @type {string[]} */ ...args) => spawnSync(process.execPath, ["--test", ...args], { stdio: "inherit", env: { ...process.env, TEST_LEVEL: level, TEST_SITE: onNode ? "node" : "cloudflare" } }).status ?? 1;
// the unit tests first: a second, and a broken script fails here, not minutes in
let failed = test("tests/**/*.test.mjs") !== 0;
if (!failed) failed = test("--test-concurrency=1", ...(only ? [`--test-name-pattern=${only}`] : []), ...want.map((g) => `tests/${g}/steps.mjs`)) !== 0;
process.exit(failed ? 1 : 0);
