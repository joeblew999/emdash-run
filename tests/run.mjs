// The test. A GROUP is the unit: site, signin, plugin, live — named as the tasks are. Each has a
// folder here with its steps (steps.mjs) and what its last run showed (results.json), and a page in
// docs/reference/ written from that. Each runs alone, on a site of its own.
//
//   mise run test             the everyday steps of site, signin and plugin: those not proven.
//                             About a minute a group. Never deploys
//   mise run test:plugin      one group (test:site, test:signin, test:plugin)
//   mise run test:live        the live group: it deploys to the Worker kept for testing, 5 minutes
//   mise run test:all         EVERY step of site, signin and plugin: what CI runs, on three OSes
//   mise run test:node        every step, on a Node site made from EmDash's template
//   … -- --again              run it even though it is proven
//
// EVERYDAY AND LONG: a steps file puts its long steps in t.long(…). They run with --all; a run
// without it leaves what was last recorded for them as it is. The stages workflow runs both, as
// two jobs: `mise run test` for an answer in minutes, `mise run test:all` for every step.
// PROVEN: every step of the group passed, and nothing it depends on has changed since
// (tests/record.mjs --depends). A proven group is not run again. On a CI runner nothing is skipped.
// A RUN IS THE WHOLE TRUTH FOR ITS GROUP: it replaces everything recorded for that group.
// ONE TEST AT A TIME on a machine: a second one waits for the first.
// TEST_FROM=github fetches the tasks from GitHub (main) instead of the local files.
//
// It runs as another developer would: every task is started with a clean environment (none of your
// shell's variables) and an empty config folder, in a copy of this repo's site/ in a temporary
// folder — the site you are looking at, and its database, are never touched.
//
// Node only: no shell, no Unix program. The same file runs on macOS, Linux and Windows.
//
// WHAT A STEP IS WRITTEN WITH (the `t` each steps.mjs is given):
//   t.ok(task, what, fn)        a step that must succeed: fn runs to its end
//   t.no(task, what, fn)        a step that must refuse: fn throws (a task it runs fails)
//   t.long(fn)                  steps that only run with --all
//   t.need(task, fn)            what the steps stand on: not a step, but its failure is the group's
//   t.mise(task, ...args)       mise run <task> -- <args>; its output; throws when the task fails
//   t.mise({ yes, env, alone }, task, ...args)   --yes; extra variables; alone: nobody to answer and
//                               nothing that answers for them (no CI, no MISE_YES)
//   t.attempt(task, ...args)    the same, never throws: { code, out }
//   t.forSeconds(n, task, ...)  a task that never ends, stopped after n seconds; its output
//   t.says(out, words)  t.saysAnyCase(out, words)  t.check(condition, what was expected)
//   t.read  t.write  t.remove  t.exists          files, by a path inside the project
//   t.status(url)               the HTTP status a GET gets, redirects not followed; 0 when no answer
//   t.until(fn)                 fn every 3 seconds until it returns true, ten times
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";
const groups = ["site", "signin", "plugin", "live"];
const argv = process.argv.slice(2);
const unknown = argv.filter((a) => !groups.includes(a) && !["--again", "--node", "--all"].includes(a));
if (unknown.length) {
	console.error("usage: node tests/run.mjs [site|signin|plugin|live]… [--all] [--again] [--node]");
	process.exit(2);
}
const onNode = argv.includes("--node");
const all = argv.includes("--all");
const again = argv.includes("--again") || !!process.env.CI;
const asked = argv.filter((a) => groups.includes(a));
// live is run when it is asked for by name: it deploys, and takes five minutes
const want = asked.length ? asked : ["site", "signin", "plugin"];
const fromGitHub = process.env.TEST_FROM === "github";
const include = fromGitHub ? `git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=${process.env.TEST_REF || "main"}` : join(repo, "tasks.toml").replaceAll("\\", "/");
// A step that has not ended in five minutes is stopped and fails: the longest real one, a first
// install on Windows, takes under two.
const stepLimit = Number(process.env.STEP_LIMIT) || 300;
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const plain = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");
const node = (...args) => spawnSync(process.execPath, args, { cwd: repo, encoding: "utf8" });

// Every task in tasks.toml has a step, and every step names a real task.
let r = node("tests/record.mjs", "--coverage");
process.stdout.write(r.stdout + r.stderr);
if (r.status !== 0) process.exit(1);
// The scripts' own functions: a third of a second, and a broken edit of a site's config fails here,
// not minutes in.
r = node("--test", "tests/**/*.test.mjs");
if (r.status !== 0) {
	console.log(plain(r.stdout + r.stderr).split("\n").slice(-30).join("\n"));
	console.log('The unit tests fail (node --test "tests/**/*.test.mjs"). Nothing was run.');
	process.exit(1);
}
console.log(`unit tests: ${(r.stdout.match(/pass (\d+)/) || [])[1]} pass`);

// What is left to run?
const whereOf = (g) => (g === "live" ? "deployed" : onNode ? "node" : "cloudflare");
const todo = want.filter((g) => {
	if (!again && node("tests/record.mjs", "--proven", g, whereOf(g), all ? "all" : "everyday").status === 0) {
		console.log(`${g}: proven — every step passed and nothing it depends on has changed. Not run again (-- --again runs it).`);
		return false;
	}
	return true;
});
if (!todo.length) process.exit(0);

// What must be undone when the test ends, however it ends.
// (its real name: on Windows the temporary folder is given as a short name, C:\\Users\\RUNNER~1\\…,
// and a dev server started in a folder named that way exits before it is ready)
const work = realpathSync.native(mkdtempSync(join(tmpdir(), "emdash-run-test-")));
const undo = [() => rmSync(work, { recursive: true, force: true, maxRetries: 3 })];
let ended = false;
const end = () => {
	if (ended) return;
	ended = true;
	for (const u of undo.reverse()) try { u(); } catch {}
};
process.on("exit", end);
for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(s, () => process.exit(130));

// One test at a time on this machine: two at once were handed the same ports and spoiled each other.
const lock = join(homedir(), ".config", "emdash-run", "locks", "test");
mkdirSync(dirname(lock), { recursive: true });
for (let waited = 0; ; waited += 10) {
	try { mkdirSync(lock); break; } catch {}
	if (Date.now() - statSync(lock).mtimeMs > 90 * 60_000) { rmdirSync(lock); continue; }
	if (!waited) console.log("Another test is running on this machine: waiting for it to end (one at a time)…");
	if (waited > 3600) {
		console.log(`…it has not ended in an hour: not started. If none is running, remove ${lock}`);
		process.exit(1);
	}
	await sleep(10);
}
undo.push(() => rmdirSync(lock));
// Running the test turns on the commit check in this clone (the generated pages, the docs lint).
if (!process.env.CI) spawnSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: repo });
if (fromGitHub) spawnSync("mise", ["cache", "clear"]); // mise keeps the first copy it fetched

class Failed extends Error {}

// One group's run: its project folder, the environment its tasks are given, its steps.
const runGroup = async (group) => {
	const where = whereOf(group);
	const rows = [];
	const dir = join(work, group);
	let log = ""; // what the step being run has printed
	let running = null; // the task being run, so a step that does not end can be stopped
	let stuck = "";
	let long = false; // inside t.long(…)
	// Another developer's machine: nothing but HOME, PATH and a config folder that is empty and this
	// group's own. (EmDash's CLI keeps every sign-in in ONE file there, read and written with no
	// lock — Upstream: emdash-cms/emdash#3996.) On Windows a program needs more than that to start.
	const keep = ["HOME", "PATH", "TERM", "CI", "GITHUB_TOKEN", "GIGET_AUTH", "TEST_LIVE_URL", "TEST_LIVE_NAME"];
	const env = win ? { ...process.env } : Object.fromEntries(keep.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
	// who is asking GitHub, where the machine says: EmDash's template is fetched from there (giget),
	// and anonymous downloads are limited per address
	if (env.GITHUB_TOKEN && !env.GIGET_AUTH) env.GIGET_AUTH = env.GITHUB_TOKEN;
	env.XDG_CONFIG_HOME = join(work, `config-${group}`);
	mkdirSync(env.XDG_CONFIG_HOME, { recursive: true });

	// A program, to its end. Its output goes to a file, not a pipe: a site the task leaves running
	// would keep a pipe open, and the step would wait for ever.
	const start = (program, args, o = {}) => {
		const file = join(work, `out-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
		const fd = openSync(file, "w");
		const child = spawn(program, args, { cwd: o.cwd || dir, env: o.env || env, stdio: ["ignore", fd, fd], detached: !win, shell: win && program !== "mise" && program !== process.execPath });
		closeSync(fd);
		const stop = () => {
			if (win) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
			else try { process.kill(-child.pid, "SIGTERM"); } catch {}
		};
		const done = new Promise((resolve) => {
			child.on("error", (e) => resolve({ code: 1, out: String(e) }));
			child.on("exit", (code) => {
				const out = plain(readFileSync(file, "utf8"));
				log += out;
				resolve({ code: code ?? 1, out });
			});
		});
		return { done, stop };
	};
	const envFor = (o) => {
		const e = { ...env, ...(o.env || {}) };
		if (o.alone) for (const k of ["CI", "MISE_YES"]) delete e[k];
		return e;
	};
	const split = (a) => (typeof a[0] === "object" ? [a[0], a.slice(1)] : [{}, a]);
	const miseArgs = (o, task, args) => ["run", ...(o.yes ? ["--yes"] : []), task, ...(args.length ? ["--", ...args] : [])];
	const attempt = async (...a) => {
		const [o, [task, ...args]] = split(a);
		running = start("mise", miseArgs(o, task, args), { env: envFor(o) });
		const res = await running.done;
		running = null;
		return res;
	};
	const t = {
		group, where, repo, dir, env, sleep, all,
		ci: !!process.env.CI,
		attempt,
		mise: async (...a) => {
			const res = await attempt(...a);
			if (res.code !== 0) throw new Failed(`the task failed (exit ${res.code})`);
			return res.out;
		},
		forSeconds: async (seconds, task, ...args) => {
			const p = start("mise", miseArgs({}, task, args));
			await sleep(seconds);
			p.stop();
			return (await p.done).out;
		},
		// any other program, in the project or (cwd) a folder inside it: { code, out }
		cmd: async (program, args, o = {}) => {
			running = start(program, args, { cwd: o.cwd ? join(dir, o.cwd) : dir });
			const res = await running.done;
			running = null;
			return res;
		},
		check: (condition, expected) => {
			if (!condition) throw new Error(`expected: ${expected}`);
		},
		says: (out, words) => t.check(out.includes(words), `the output to say "${words}"`),
		saysAnyCase: (out, words) => t.check(out.toLowerCase().includes(words.toLowerCase()), `the output to say "${words}"`),
		read: (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : ""),
		write: (f, text) => writeFileSync(join(dir, f), text),
		remove: (f) => rmSync(join(dir, f), { recursive: true, force: true }),
		exists: (f) => existsSync(join(dir, f)),
		list: (f) => (existsSync(join(dir, f)) ? readdirSync(join(dir, f)) : []),
		status: async (url, o = {}) => {
			try {
				return (await fetch(url, { redirect: "manual", signal: AbortSignal.timeout((o.seconds || 30) * 1000), ...o })).status;
			} catch {
				return 0;
			}
		},
		body: async (url) => {
			try {
				return await (await fetch(url, { signal: AbortSignal.timeout(30_000) })).text();
			} catch {
				return "";
			}
		},
		until: async (fn, tries = 10, wait = 3) => {
			for (let i = 0; i < tries; i++) {
				if (await fn(i)) return;
				await sleep(wait);
			}
			throw new Error("expected: it to become true in time, and it did not");
		},
		// A project as another repo has one: a folder, a mise.toml that includes the tasks, no ports yet.
		project: (template, ...envLines) => {
			mkdirSync(dir, { recursive: true });
			spawnSync("git", ["init", "-q"], { cwd: dir });
			t.write("mise.toml", [
				"[settings]", "experimental = true", "[tools]", 'node = "26"', 'pnpm = "12"', 'fnox = "1.36.0"',
				"[env]", `TEMPLATE = "${template}"`, 'PLUGIN_PUBLISHER = "did:web:example.com"', 'PLUGIN_AUTHOR = "Example Author"', 'PLUGIN_SECURITY_EMAIL = "security@example.com"',
				...envLines, "[task_config]", `includes = ["${include}"]`, "",
			].join("\n"));
			spawnSync("mise", ["trust", "-q", "."], { cwd: dir, env });
		},
		// This repo's site, as committed and with its packages if they are installed, without what is
		// the machine's: its database, its build, its key. (On macOS the copy is a clone: instant.)
		copySite: () => {
			const from = join(repo, "site");
			const to = join(dir, "site");
			if (process.platform !== "darwin" || spawnSync("cp", ["-Rc", from, to]).status !== 0) {
				rmSync(to, { recursive: true, force: true });
				cpSync(from, to, { recursive: true, verbatimSymlinks: true });
			}
			for (const f of [".wrangler", "dist", ".astro", ".env", "backups"]) t.remove(`site/${f}`);
		},
		port: (name) => (t.read("mise.local.toml").match(new RegExp(`^${name} = "(\\d+)"`, "m")) || [])[1],
		// The two addresses, once the project has its ports.
		addresses: () => {
			t.SITE = `http://localhost:${t.port("SITE_PORT")}`;
			t.BUILT = `http://localhost:${t.port("PREVIEW_PORT")}`;
		},
		// A project with a site in it and its ports: a copy of this repo's site/, or (test:node) a
		// site made from EmDash's Node template.
		aSite: async () => {
			t.project(where === "node" ? "node:starter" : "cloudflare:blog");
			await t.need("site:ports", () => t.mise("site:ports"));
			if (where === "node") await t.need("site:new", () => t.mise("site:new"));
			else t.copySite();
			t.addresses();
		},
		// Something to undo when the whole test ends (a lock).
		atEnd: (fn) => undo.push(fn),
	};
	const tail = (n, width) => log.split("\n").filter((l) => l.trim()).slice(-n).map((l) => l.slice(0, width));
	const step = async (kind, task, what, fn) => {
		const began = Date.now();
		log = "";
		let result, detail = "";
		// A step that does not end is stopped at STEP_LIMIT seconds and fails with what it had printed.
		// The steps after it in the group are not run (but the clean-up): they would each wait as long.
		if (stuck && task !== "site:stop" && task !== "site:delete") {
			result = "FAIL";
			detail = `not run: ${stuck}`;
		} else {
			let timer, timedOut = false;
			/** @type {Error | null} */
			let threw = null;
			const limit = new Promise((resolve) => (timer = setTimeout(() => { timedOut = true; running?.stop(); resolve(); }, stepLimit * 1000)));
			await Promise.race([Promise.resolve().then(fn).catch((e) => (threw = e)), limit]);
			clearTimeout(timer);
			if (timedOut) {
				result = "FAIL";
				detail = `did not end in ${stepLimit}s and was stopped`;
				stuck = `${task}: ${what} did not end`;
			} else if (kind === "ok") {
				result = threw ? "FAIL" : "PASS";
				if (threw) detail = `${threw.message}. ${tail(3, 160).join("  ")}`.replaceAll("|", " ").slice(0, 240);
			} else {
				result = threw ? "PASS" : "FAIL";
				if (!threw) detail = "it should have refused";
			}
		}
		const seconds = Math.round((Date.now() - began) / 1000);
		rows.push({ task, step: what, result, detail, refusal: kind === "no", long, seconds });
		// with how long it took: on a CI runner that is how a slow step is told from a stuck one
		console.log(`${result} ${task.padEnd(18)} ${what} (${seconds}s)`);
		// a failure shows its last output here too — on a CI runner this is the only place it can be read
		if (result === "FAIL") {
			if (detail) console.log(`       > ${detail}`);
			for (const l of tail(30, 220)) console.log(`       > ${l}`);
		}
	};
	t.ok = (task, what, fn) => step("ok", task, what, fn);
	t.no = (task, what, fn) => step("no", task, what, fn);
	t.long = async (fn) => {
		if (!all) return;
		long = true;
		try {
			await fn();
		} finally {
			long = false;
		}
	};
	t.need = async (task, fn) => {
		if (stuck) return;
		log = "";
		try {
			await fn();
		} catch (e) {
			rows.push({ task, step: `needed before the ${group} steps`, result: "FAIL", detail: `${e.message}. ${tail(3, 160).join("  ")}`.slice(0, 240), refusal: false, seconds: 0 });
			console.log(`FAIL ${task.padEnd(18)} needed before the ${group} steps`);
			for (const l of tail(30, 220)) console.log(`       > ${l}`);
			stuck = `${task}, needed first, failed`;
		}
	};

	console.log(`==== ${group} (${where}${group === "live" ? "" : all ? ", every step" : ", the everyday steps"})`);
	const began = Date.now();
	// After the group, whatever it left running is stopped — also when the test is interrupted.
	const tidy = () => {
		if (!existsSync(dir)) return;
		if (existsSync(join(dir, "site"))) spawnSync("pnpm", ["exec", "emdash", "logout"], { cwd: join(dir, "site"), env, shell: win, timeout: 30_000 });
		spawnSync("mise", ["run", "site:stop"], { cwd: dir, env, timeout: 60_000 });
	};
	undo.push(tidy);
	const steps = (await import(pathToFileURL(join(repo, "tests", group, "steps.mjs")).href)).default;
	try {
		await steps(t);
	} catch (e) {
		// a mistake in the steps file itself, not a failing step
		rows.push({ task: `test:${group}`, step: "the steps file ran to its end", result: "FAIL", detail: String(e.message).slice(0, 240), refusal: false, seconds: 0 });
		console.log(`FAIL tests/${group}/steps.mjs: ${e.stack}`);
	}
	tidy();
	undo.splice(undo.indexOf(tidy), 1);
	if (!rows.length) return 0; // the live group, where there is no deployed test site
	const rowsFile = join(work, `${group}.rows.json`);
	writeFileSync(rowsFile, JSON.stringify(rows));
	const dirty = spawnSync("git", ["status", "--porcelain", "--", "tasks.toml", "scripts", "tests/run.mjs", `tests/${group}/steps.mjs`], { cwd: repo, encoding: "utf8" }).stdout.trim();
	const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repo, encoding: "utf8" }).stdout.trim() + (dirty ? "+uncommitted" : "");
	const rec = node("tests/record.mjs", "--record", group, rowsFile, where, fromGitHub ? "GitHub" : "the local files", commit, String(Math.round((Date.now() - began) / 1000)), all ? "all" : "everyday");
	process.stdout.write(rec.stdout + rec.stderr);
	return rec.status;
};

let code = 0;
for (const g of todo) if ((await runGroup(g)) !== 0) code = 1;

// The pages written from what was just recorded (docs/_generated.toml): charter writes them. It is
// one of this repo's tools on a developer's machine; a CI runner installs no charter and commits nothing.
const charter = spawnSync("mise", ["which", "charter"], { cwd: repo, encoding: "utf8" }).stdout?.trim();
if (charter && existsSync(charter)) {
	const docs = spawnSync(charter, ["docs"], { cwd: repo, encoding: "utf8" });
	if (docs.status === 0) console.log((readFileSync(join(repo, "docs", "reference", "status.md"), "utf8").match(/^\*\*.*steps pass.*$/m) || [""])[0]);
	else console.log(`The pages were not rewritten (mise run docs:setup):\n${(docs.stdout + docs.stderr).trim().split("\n").slice(-3).join("\n")}`);
}
// Where the machine keeps a summary of a run (a GitHub runner does), what this run recorded goes there.
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, node("tests/record.mjs", "--page", "status").stdout);
process.exit(code);
