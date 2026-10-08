// Everything outside the program, in one place: starting a command, asking an address, reading a
// file, waiting, a lock. The nodes are given a World and never reach outside by themselves — so a
// test gives them a made-up one (tests/core/fake-world.mjs) and sees what they would do.
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";

/**
 * @typedef {object} World
 * @property {(node: string) => void} at                 the node being reached: what it prints is under its name
 * @property {(line: string) => void} say
 * @property {(program: string, args: string[], cwd: string, more?: Record<string, string>) => number} run   a command, shown before it runs (more: variables for it alone); its exit code
 * @property {(program: string, args: string[], cwd: string) => string} capture      a command's output, not shown
 * @property {(url: string, init?: RequestInit & { seconds?: number }) => Promise<{ status: number, text: string }>} ask   status 0: nothing answered
 * @property {(program: string, args: string[], cwd: string) => { code: number, out: string, err: string }} exec   a command, not shown: its exit code and what it printed
 * @property {(path: string) => boolean} exists
 * @property {(path: string) => string} read
 * @property {(path: string) => string[]} list                the names in a folder; none when there is no such folder
 * @property {(path: string) => void} mkdir
 * @property {(path: string) => void} remove               a file or a folder and what is in it; nothing when there is none
 * @property {(path: string, text: string) => void} keep     write a file only this user can read, making its folder
 * @property {(paths: string[]) => number} newest            when the newest file among these files and folders was changed; 0 when there is none
 * @property {(file: string, sql: string) => void} sqlite    run SQL on a SQLite file
 * @property {string} config                                 the user's config folder
 * @property {string} machine                                this machine's name
 * @property {() => { raw: string, hash: string, ids: [string, string], now: string }} mint   a new API token as EmDash makes one, two ids and the time
 * @property {(seconds: number) => Promise<void>} sleep
 * @property {<T>(name: string, fn: () => Promise<T>) => Promise<T>} alone             while no other project on this machine does the same
 * @property {(pid: number) => void} kill
 * @property {NodeJS.Platform} platform
 */

/** @param {NodeJS.ProcessEnv} env @returns {World} */
export const realWorld = (env) => {
	const win = process.platform === "win32";
	let node = "";
	const sleep = (/** @type {number} */ seconds) => new Promise((r) => setTimeout(() => r(undefined), seconds * 1000));
	return {
		platform: process.platform,
		at: (name) => (node = name),
		say: (line) => console.log(`[${node}] ${line}`),
		// On Windows pnpm is a .cmd file and needs a shell, which splits on spaces: quote what has them.
		run: (program, args, cwd, more) => {
			console.log(`[${node}] $ ${[program, ...args].join(" ")}`);
			const shell = win && program !== process.execPath && program !== "git";
			return spawnSync(program, shell ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, { cwd, env: more ? { ...env, ...more } : env, stdio: "inherit", shell }).status ?? 1;
		},
		capture: (program, args, cwd) => spawnSync(program, args, { cwd, env, encoding: "utf8", shell: win && program !== process.execPath }).stdout || "",
		ask: async (url, init = {}) => {
			try {
				const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout((init.seconds || 30) * 1000), ...init });
				return { status: res.status, text: await res.text().catch(() => "") };
			} catch {
				return { status: 0, text: "" };
			}
		},
		exec: (program, args, cwd) => {
			const r = spawnSync(program, args, { cwd, env, encoding: "utf8", shell: win && program !== process.execPath });
			return { code: r.status ?? 1, out: r.stdout || "", err: r.stderr || "" };
		},
		exists: existsSync,
		read: (path) => (existsSync(path) ? readFileSync(path, "utf8") : ""),
		list: (path) => (existsSync(path) ? readdirSync(path) : []),
		mkdir: (path) => void mkdirSync(path, { recursive: true }),
		remove: (path) => rmSync(path, { recursive: true, force: true }),
		keep: (path, text) => {
			mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
			writeFileSync(path, text, { mode: 0o600 });
			chmodSync(path, 0o600);
		},
		newest: (paths) => {
			/** @param {string} p @returns {number} */
			const of = (p, depth = 0) => {
				if (!existsSync(p)) return 0;
				const st = statSync(p);
				if (!st.isDirectory()) return st.mtimeMs;
				let t = 0;
				if (depth < 12) for (const e of readdirSync(p)) if (e !== "node_modules") t = Math.max(t, of(join(p, e), depth + 1));
				return t;
			};
			return Math.max(0, ...paths.map((p) => of(p)));
		},
		sqlite: (file, sql) => {
			const db = new DatabaseSync(file);
			db.exec("PRAGMA busy_timeout = 10000");
			db.exec(sql);
			db.close();
		},
		config: env.XDG_CONFIG_HOME || join(homedir(), ".config"),
		machine: hostname(),
		// As EmDash makes one: ec_pat_ + 32 random bytes, base64url; stored as the base64url SHA-256.
		mint: () => {
			const raw = "ec_pat_" + randomBytes(32).toString("base64url");
			const id = () => randomUUID().replaceAll("-", "").toUpperCase().slice(0, 26);
			return { raw, hash: createHash("sha256").update(raw).digest("base64url"), ids: [id(), id()], now: new Date().toISOString() };
		},
		sleep,
		// A folder in the user's config is the lock; one left by a run that died is taken after 3 minutes.
		alone: async (name, fn) => {
			const lock = join(env.EMDASH_RUN_LOCKS || join(homedir(), ".config", "emdash-run", "locks"), name);
			mkdirSync(dirname(lock), { recursive: true });
			for (let waited = 0; ; waited++) {
				try {
					mkdirSync(lock);
					break;
				} catch {
					let age = 0;
					try { age = Date.now() - statSync(lock).mtimeMs; } catch {}
					if (age > 180_000 || waited > 400) { try { rmdirSync(lock); } catch {} continue; }
					await sleep(0.5);
				}
			}
			try {
				return await fn();
			} finally {
				try { rmdirSync(lock); } catch {}
			}
		},
		kill: (pid) => {
			try { process.kill(pid); } catch {}
		},
	};
};
