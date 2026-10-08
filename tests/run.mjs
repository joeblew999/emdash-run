// The test. A GROUP is the unit: site, signin, plugin, live — named as the tasks are. Each has a
// folder here with its steps (steps.mjs: tests of Node's own runner) and what its last run showed
// (results.json), and a page in docs/reference/. Each runs alone, on a site of its own.
//
// THREE LEVELS, the same on a developer's machine and on CI:
//   mise run dev:test --level smoke   THE BASICS, half a minute: the types and unit tests pass, a
//                                 project is made, its tasks run, the site starts, answers and
//                                 stops. Run it first; a push runs it on three OSes
//   mise run dev:test                 fast (the default): the everyday steps of site, signin and
//                                 plugin — the groups not proven. About a minute a group
//   mise run dev:test --level all     every step, the long ones too (long(…) in a steps file)
//
//   mise run dev:test plugin          one group, or several, at any level
//   mise run dev:test live            the live group: it deploys to the Worker kept for testing
//   mise run dev:test --node          on a Node site made from EmDash's template
//   mise run dev:test --again         run a group even though it is proven
//   mise run dev:test site --only site:check   only the steps named so; nothing is recorded
//
// PROVEN: the group's steps passed and nothing it depends on has changed since (tests/lib/depends.mjs;
// node tests/record.mjs --depends). A proven group is not run again; on a CI runner nothing is skipped.
// ONE TEST AT A TIME on a machine: a second one waits for the first.
// The same on a developer's machine and on a CI runner: the stages workflow only runs these tasks.
//
// This file decides which groups run and records them. The rest:
//   tests/lib/step.mjs       what a steps file is written with: step, refuses, long, setup
//   tests/lib/site.mjs       what a step does: run a task, read a file, ask the site
//   tests/lib/reporter.mjs   a line per step, and the results as rows
//   tests/lib/results.mjs    the records; depends.mjs: what a group depends on; pages.mjs: the pages
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, rmdirSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { groups, repo, whereOf } from "./lib/groups.mjs";
import { statusPage } from "./lib/pages.mjs";
import { coverage, proven, record } from "./lib/results.mjs";

const argv = process.argv.slice(2);
const flag = (name) => (argv.includes(name) ? argv.splice(argv.indexOf(name), 2)[1] : "");
const level = flag("--level") || "fast";
// smoke is the site group's steps that make a project, start the site, ask it and stop it
const only = level === "smoke" ? "site:(ports|start|stop)" : flag("--only");
if (!["smoke", "fast", "all"].includes(level) || argv.some((a) => !groups.includes(a) && !["--again", "--node"].includes(a))) {
	console.error("usage: node tests/run.mjs [site|signin|plugin|live]… [--level smoke|fast|all] [--again] [--node] [--only <words>]");
	process.exit(2);
}
const onNode = argv.includes("--node");
const all = level === "all";
const again = argv.includes("--again") || !!only || !!process.env.CI;
const asked = argv.filter((a) => groups.includes(a));
// live is run when it is asked for by name: it deploys, and takes five minutes
const want = level === "smoke" ? ["site"] : asked.length ? asked : ["site", "signin", "plugin"];
const node = (...args) => spawnSync(process.execPath, args, { cwd: repo, encoding: "utf8" });

// tasks.toml cannot change without the test changing with it
const uncovered = coverage();
if (uncovered.length) {
	console.error([...uncovered, "Change the test with the task. Nothing was run."].join("\n"));
	process.exit(1);
}
// the scripts' own functions: a third of a second, and a broken edit of a site's config fails here
const unit = node("--test", "tests/**/*.test.mjs");
if (unit.status !== 0) {
	console.error(`${unit.stdout}${unit.stderr}\nThe unit tests fail (node --test "tests/**/*.test.mjs"). Nothing was run.`);
	process.exit(1);
}
console.log(`unit tests: ${(unit.stdout.match(/pass (\d+)/) || [])[1]} pass`);

const todo = want.filter((g) => {
	if (again || !proven(g, whereOf(g, onNode), all)) return true;
	console.log(`${g}: proven — every step passed and nothing it depends on has changed. Not run again (-- --again runs it).`);
	return false;
});
if (!todo.length) process.exit(0);

// What must be undone when the test ends, however it ends. The run's folder by its real name: on
// Windows the temporary folder is given as a short name (C:\Users\RUNNER~1\…), and a dev server
// started in a folder named that way exits before it is ready.
const work = realpathSync.native(mkdtempSync(join(tmpdir(), "emdash-run-test-")));
const undo = [() => rmSync(work, { recursive: true, force: true, maxRetries: 3 })];
process.on("exit", () => {
	for (const u of undo.reverse()) try { u(); } catch {}
});
for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(s, () => process.exit(130));

// One test at a time on this machine: two at once were handed the same ports and spoiled each other.
const lock = join(homedir(), ".config", "emdash-run", "locks", "test");
mkdirSync(dirname(lock), { recursive: true });
for (let waited = 0; ; waited += 10) {
	try { mkdirSync(lock); break; } catch {}
	if (Date.now() - statSync(lock).mtimeMs > 90 * 60_000) { rmdirSync(lock); continue; }
	if (!waited) console.log("Another test is running on this machine: waiting for it to end (one at a time)…");
	if (waited > 3600) {
		console.error(`…it has not ended in an hour: not started. If none is running, remove ${lock}`);
		process.exit(1);
	}
	await new Promise((r) => setTimeout(r, 10_000));
}
undo.push(() => rmdirSync(lock));
// Running the test turns on the commit check in this clone (the generated pages, the docs lint).
if (!process.env.CI) spawnSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: repo });
if (process.env.TEST_FROM === "github") spawnSync("mise", ["cache", "clear"]); // mise keeps the first copy it fetched

let failed = false;
for (const group of todo) {
	const where = whereOf(group, onNode);
	const rowsFile = join(work, `${group}.rows.json`);
	const env = { ...process.env, TEST_GROUP: group, TEST_WHERE: where, TEST_WORK: work, TEST_ALL: all ? "1" : "" };
	console.log(`==== ${group} (${where}${group === "live" ? "" : `, level ${level}`})`);
	const began = Date.now();
	// After the group, whatever it left running is stopped — also when the test is interrupted.
	const tidy = () => {
		const dir = join(work, group);
		if (existsSync(dir)) spawnSync("mise", ["run", "site:stop"], { cwd: dir, timeout: 60_000 });
	};
	undo.push(tidy);
	// Node's own test runner on the group's steps: it times them, stops one that does not end, and
	// prints them (spec). Ours is only the second reporter, which hands the results to the record.
	spawnSync(process.execPath, ["--test", ...(only ? [`--test-name-pattern=${only}`] : []), "--test-reporter=spec", "--test-reporter-destination=stdout", `--test-reporter=${pathToFileURL(join(repo, "tests", "lib", "reporter.mjs")).href}`, `--test-reporter-destination=${rowsFile}`, join("tests", group, "steps.mjs")], { cwd: repo, env, stdio: "inherit" });
	tidy();
	undo.splice(undo.indexOf(tidy), 1);
	const steps = existsSync(rowsFile) ? JSON.parse(readFileSync(rowsFile, "utf8")) : [];
	if (!steps.length) continue; // the live group, where there is no deployed test site
	if (only) {
		const bad = steps.filter((r) => r.result === "FAIL").length;
		console.log(`${group}: ${steps.length - bad} passed, ${bad} failed. Not recorded: a part of a group is not its record`);
		if (bad) failed = true;
		continue;
	}
	const dirty = spawnSync("git", ["status", "--porcelain", "--", "tasks.toml", "scripts", "tests/run.mjs", "tests/lib", `tests/${group}/steps.mjs`], { cwd: repo, encoding: "utf8" }).stdout.trim();
	const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repo, encoding: "utf8" }).stdout.trim() + (dirty ? "+uncommitted" : "");
	const took = Math.round((Date.now() - began) / 1000);
	const bad = record(group, steps, { where, from: process.env.TEST_FROM === "github" ? "GitHub" : "the local files", commit, took, all });
	console.log(`${group}: ${steps.length - bad} passed, ${bad} failed, ${took >= 60 ? `${Math.floor(took / 60)} min ${took % 60} s` : `${took} s`}. Recorded in tests/${group}/results.json`);
	if (bad) failed = true;
}

// The pages written from what was just recorded (docs/_generated.toml): charter, one of this repo's
// tools, writes them.
const charter = spawnSync("mise", ["which", "charter"], { cwd: repo, encoding: "utf8" }).stdout?.trim();
if (charter && existsSync(charter) && spawnSync(charter, ["docs"], { cwd: repo }).status !== 0) console.log("The pages were not rewritten: mise run docs:setup");
// Where the machine keeps a summary of a run (a GitHub runner does), what this run recorded goes there.
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${statusPage()}\n`);
process.exit(failed ? 1 : 0);
