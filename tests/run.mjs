// What the dev:test tasks run: Node's own test runner (node --test), and nothing else — no record,
// no report of its own. mise runs the groups side by side (dev.toml: dev:test depends on one task a
// group), so this runs ONE thing: the unit tests, or one group's steps.
//
//   node tests/run.mjs --unit                    the unit tests, and that every task has a step
//   node tests/run.mjs <group> [--level …]       that group's steps: site, signin, plugin, live
//   node tests/run.mjs --report                  the docs page of what the last runs showed
//
// THE PROOF: a group's run at the level fast or all leaves Node's own report of it — every step,
// passed or failed, with its time — in tests/<group>/last-run.txt, under a line that says when, at
// which commit, at which level and on what. docs/reference/tests.md is those files, as they are.
//
//   tests/<group>/steps.mjs   a group's steps: tests of Node's runner, named after the task each tests
//   tests/lib/step.mjs        what a steps file is written with: step, refuses, long, setup
//   tests/lib/site.mjs        what a step does: run a task, read a file, ask the site
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const groups = ["site", "signin", "plugin", "live"];
const argv = process.argv.slice(2);
const flag = (/** @type {string} */ name) => (argv.includes(name) ? argv.splice(argv.indexOf(name), 2)[1] : "");
const report = (/** @type {string} */ g) => `tests/${g}/last-run.txt`;
if (argv.includes("--report")) {
	console.log("# What the tests showed\n\nEach block is Node's own report of a group's last run on a developer's machine: every step, passed (✔) or failed (✖), with its time. The line above it says when it ran, at which commit, at which level and on what. On Linux, macOS and Windows the same tasks run in the [stages workflow](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml).");
	for (const g of groups) if (existsSync(report(g))) console.log(`\n## ${g}\n\n\`\`\`text\n${readFileSync(report(g), "utf8").trim()}\n\`\`\``);
	process.exit(0);
}
const level = flag("--level") || "fast";
const only = flag("--only");
const [group] = argv.filter((a) => groups.includes(a));
if (!["smoke", "fast", "all"].includes(level) || argv.some((a) => !groups.includes(a) && !["--node", "--unit"].includes(a)) || (!group && !argv.includes("--unit"))) {
	console.error("usage: node tests/run.mjs --unit | <site|signin|plugin|live> [--level smoke|fast|all] [--node] [--only <words>]");
	process.exit(2);
}
const test = (/** @type {string[]} */ ...args) => spawnSync(process.execPath, ["--test", ...args], { stdio: "inherit", env: { ...process.env, TEST_LEVEL: level, TEST_SITE: argv.includes("--node") ? "node" : "cloudflare" } }).status ?? 1;

if (argv.includes("--unit")) process.exit(test("tests/**/*.test.mjs"));
// smoke is the site group's steps that make a project, start the site and ask it: the other
// groups have nothing at that level
if (level === "smoke" && group !== "site") process.exit(0);
const pattern = level === "smoke" ? "site:(ports|start)" : only;
const began = Date.now();
// a whole group at fast or all is proof worth keeping: Node writes its report to a file too
const kept = !pattern && !process.env.CI ? ["--test-reporter=spec", "--test-reporter-destination=stdout", "--test-reporter=spec", `--test-reporter-destination=${report(group)}`] : [];
const code = test(...kept, ...(pattern ? [`--test-name-pattern=${pattern}`] : []), `tests/${group}/steps.mjs`);
const took = Math.round((Date.now() - began) / 1000);
// each step's time is on its line above; this is the group's
console.log(`${group}, level ${level}: ${code === 0 ? "passed" : "FAILED"} in ${took >= 60 ? `${Math.floor(took / 60)} min ${took % 60} s` : `${took} s`}`);
if (kept.length) {
	const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim();
	const os = { darwin: "macOS", linux: "Linux", win32: "Windows" }[String(process.platform)] ?? process.platform;
	const ran = readFileSync(report(group), "utf8").replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter((l) => !/^\s+at |^ℹ (suites|cancelled|todo)/.test(l)).join("\n");
	writeFileSync(report(group), `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC, commit ${commit}, level ${level}, ${os}: ${code === 0 ? "passed" : "FAILED"} in ${took} s\n\n${ran.trim()}\n`);
}
process.exit(code);
