// What a group's steps do to a project: run its tasks, read its files, ask its site.
// Plain functions. The project is a folder of its own in the run's temporary folder, and every task
// is started as another developer's machine would start it (env, below).
import { spawn, spawnSync } from "node:child_process";
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** the group whose steps file this is: the folder it is in */
export const group = basename(dirname(process.argv[1] || ""));
/** cloudflare or node: the kind of site the steps run on */
export const where = process.env.TEST_SITE || "cloudflare";
export const ci = !!process.env.CI;
// The run's folder, by its real name: on Windows the temporary folder is given as a short name
// (C:\\Users\\RUNNER~1\\…), and a dev server started in a folder named that way exits before it is ready.
const work = realpathSync.native(mkdtempSync(join(tmpdir(), `emdash-run-${group}-`)));
/** the project's folder */
export const dir = join(work, "project");
const win = process.platform === "win32";
const include = process.env.TEST_FROM === "github" ? `git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=${process.env.TEST_REF || "main"}` : join(repo, "tasks.toml").replaceAll("\\", "/");

// Another developer's machine: nothing but HOME, PATH and a config folder that is empty and this
// group's own. (EmDash's CLI keeps every sign-in in ONE file there, read and written with no lock —
// Upstream: emdash-cms/emdash#3996.) On Windows a program needs more than that to start at all.
const keep = ["HOME", "PATH", "TERM", "CI", "GITHUB_TOKEN", "GIGET_AUTH", "TEST_LIVE_URL", "TEST_LIVE_NAME"];
/** @type {NodeJS.ProcessEnv} */
export const env = win ? { ...process.env } : Object.fromEntries(keep.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
// who is asking GitHub, where the machine says: EmDash's template is fetched from there (giget)
if (env.GITHUB_TOKEN && !env.GIGET_AUTH) env.GIGET_AUTH = env.GITHUB_TOKEN;
env.XDG_CONFIG_HOME = join(work, "config");

export const sleep = (/** @type {number} */ seconds) => new Promise((r) => setTimeout(r, seconds * 1000));

// When the group ends, however it ends: what it left running is stopped, its folder goes.
process.on("exit", () => {
	if (existsSync(dir)) spawnSync("mise", ["run", "site:stop"], { cwd: dir, env, timeout: 60_000 });
	rmSync(work, { recursive: true, force: true, maxRetries: 3 });
});
for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(s, () => process.exit(130));

// What the step being run has printed, and the program it is running now (so one that does not end
// can be stopped): tests/lib/step.mjs reads both.
export const running = { log: "", stop: () => {} };

// A program, to its end. Its output goes to a file, not a pipe: a site the task leaves running
// would keep a pipe open, and the step would wait for ever.
/** @param {string} program @param {string[]} args @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [o] */
const start = (program, args, o = {}) => {
	const file = join(work, `out-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
	const fd = openSync(file, "w");
	const child = spawn(program, args, { cwd: o.cwd || dir, env: o.env || env, stdio: ["ignore", fd, fd], detached: !win, shell: win && program !== "mise" && program !== process.execPath });
	closeSync(fd);
	const stop = () => {
		if (!child.pid) return;
		if (win) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
		else try { process.kill(-child.pid, "SIGTERM"); } catch {}
	};
	/** @type {Promise<{ code: number, out: string }>} */
	const done = new Promise((resolve) => {
		child.on("error", (e) => resolve({ code: 1, out: String(e) }));
		child.on("exit", (code) => {
			const out = readFileSync(file, "utf8").replace(/\x1b\[[0-9;]*m/g, "");
			running.log += out;
			resolve({ code: code ?? 1, out });
		});
	});
	return { done, stop };
};
/** @param {string} program @param {string[]} args @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [o] */
const toEnd = async (program, args, o) => {
	const p = start(program, args, o);
	running.stop = p.stop;
	const result = await p.done;
	running.stop = () => {};
	return result;
};

/**
 * How a task is run. yes: with --yes. env: extra variables. alone: nobody to answer, and nothing
 * that answers for them (no CI, no MISE_YES).
 * @typedef {{ yes?: boolean, env?: Record<string, string>, alone?: boolean }} How
 */
/** @param {(How | string)[]} a @returns {[How, string[]]} */
const split = (a) => (typeof a[0] === "object" ? [a[0], /** @type {string[]} */ (a.slice(1))] : [{}, /** @type {string[]} */ (a)]);
/** @param {How} how @param {string} task @param {string[]} args */
const miseArgs = (how, task, args) => ["run", ...(how.yes ? ["--yes"] : []), task, ...(args.length ? ["--", ...args] : [])];
const envFor = (/** @type {How} */ how) => {
	const e = { ...env, ...(how.env || {}) };
	if (how.alone) for (const k of ["CI", "MISE_YES"]) delete e[k];
	return e;
};

/** mise run <task> -- <args>, whatever it ends with. @param {...(How | string)} a */
export const attempt = async (...a) => {
	const [how, [task, ...args]] = split(a);
	const began = Date.now();
	const result = await toEnd("mise", miseArgs(how, task, args), { env: envFor(how) });
	// where the time went, when it went somewhere: each state a task reaches says how long it took
	const slow = [...result.out.matchAll(/^\[([a-z:-]+)\] done in ([\d.]+) s$/gm)].filter((m) => Number(m[2]) >= 1).map((m) => `${m[1]} ${m[2]} s`);
	if (Date.now() - began >= 2000) console.log(`      ${task}: ${((Date.now() - began) / 1000).toFixed(1)} s${slow.length ? ` — ${slow.join(", ")}` : ""}`);
	return result;
};
/** mise run <task> -- <args>: what it printed. Throws when the task fails. @param {...(How | string)} a */
export const mise = async (...a) => {
	const result = await attempt(...a);
	if (result.code !== 0) throw new Error(`the task failed (exit ${result.code})`);
	return result.out;
};
/** A task that never ends, stopped after some seconds: what it printed. */
/** @param {number} seconds @param {string} task @param {...string} args */
export const forSeconds = async (seconds, task, ...args) => {
	const p = start("mise", miseArgs({}, task, args));
	await sleep(seconds);
	p.stop();
	return (await p.done).out;
};
/** Any other program, in the project or (cwd) a folder inside it. */
/** @param {string} program @param {string[]} args @param {{ cwd?: string }} [o] */
export const cmd = (program, args, o = {}) => toEnd(program, args, { cwd: o.cwd ? join(dir, o.cwd) : dir });

/** @param {unknown} condition @param {string} expected */
export const check = (condition, expected) => {
	if (!condition) throw new Error(`expected: ${expected}`);
};
/** @param {string} out @param {string} words */
export const says = (out, words) => check(out.includes(words), `the output to say "${words}"`);
/** @param {string} out @param {string} words */
export const saysAnyCase = (out, words) => check(out.toLowerCase().includes(words.toLowerCase()), `the output to say "${words}"`);

// files, by a path inside the project
export const read = (/** @type {string} */ f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
/** @param {string} f @param {string} text */
export const write = (f, text) => writeFileSync(join(dir, f), text);
export const remove = (/** @type {string} */ f) => rmSync(join(dir, f), { recursive: true, force: true });
export const exists = (/** @type {string} */ f) => existsSync(join(dir, f));
export const list = (/** @type {string} */ f) => (existsSync(join(dir, f)) ? readdirSync(join(dir, f)) : []);

/** The status a request gets, redirects not followed; 0 when nothing answers. */
/** @param {string} url @param {{ seconds?: number, method?: string }} [o] */
export const status = async (url, o = {}) => {
	try {
		return (await fetch(url, { redirect: "manual", signal: AbortSignal.timeout((o.seconds || 30) * 1000), method: o.method })).status;
	} catch {
		return 0;
	}
};
export const body = async (/** @type {string} */ url) => {
	try {
		return await (await fetch(url, { signal: AbortSignal.timeout(30_000) })).text();
	} catch {
		return "";
	}
};
/** fn every few seconds until it says true; throws when it never does. */
/** @param {(attempt: number) => boolean | Promise<boolean>} fn */
export const until = async (fn, tries = 10, wait = 3) => {
	for (let i = 0; i < tries; i++) {
		if (await fn(i)) return;
		await sleep(wait);
	}
	throw new Error("expected: it to become true in time, and it did not");
};

/** A project as another repo has one: a folder, a mise.toml that includes the tasks, no ports yet. */
/** @param {string} template @param {...string} envLines */
export const project = (template, ...envLines) => {
	mkdirSync(dir, { recursive: true });
	if (env.XDG_CONFIG_HOME) mkdirSync(env.XDG_CONFIG_HOME, { recursive: true }); // (the live group uses the developer's own)
	spawnSync("git", ["init", "-q"], { cwd: dir });
	write("mise.toml", [
		"[settings]", "experimental = true", "[tools]", 'node = "26"', 'pnpm = "12"', 'fnox = "1.36.0"',
		"[env]", `TEMPLATE = "${template}"`, 'PLUGIN_PUBLISHER = "did:web:example.com"', 'PLUGIN_AUTHOR = "Example Author"', 'PLUGIN_SECURITY_EMAIL = "security@example.com"',
		...envLines, "[task_config]", `includes = ["${include}"]`, "",
	].join("\n"));
	spawnSync("mise", ["trust", "-q", "."], { cwd: dir, env });
};
/**
 * This repo's site, as committed and with its packages if they are installed, without what is the
 * machine's: its database, its build, its key. (On macOS the copy is a clone: instant.)
 */
export const copySite = () => {
	const from = join(repo, "site");
	const to = join(dir, "site");
	if (process.platform !== "darwin" || spawnSync("cp", ["-Rc", from, to]).status !== 0) {
		rmSync(to, { recursive: true, force: true });
		cpSync(from, to, { recursive: true, verbatimSymlinks: true });
	}
	for (const f of [".wrangler", "dist", ".astro", ".env", "backups"]) remove(`site/${f}`);
};
const port = (/** @type {string} */ name) => (read("mise.local.toml").match(new RegExp(`^${name} = "(\\d+)"`, "m")) || [])[1];
/** The project's two ports, once site:ports has given them. */
export const ports = () => ({ dev: port("SITE_PORT"), built: port("PREVIEW_PORT") });
export const devSite = () => `http://localhost:${ports().dev}`;
export const builtSite = () => `http://localhost:${ports().built}`;
/**
 * A project with a site in it and its ports: a copy of this repo's site/, or (test:node) a site
 * made from EmDash's Node template.
 */
export const aSite = async () => {
	project(where === "node" ? "node:starter" : "cloudflare:blog");
	await mise("site:ports");
	if (where === "node") await mise("site:new");
	else copySite();
};
