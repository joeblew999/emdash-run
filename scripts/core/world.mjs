// Everything outside the program, in one place: starting a command, asking an address, reading a
// file, waiting, a lock. The nodes are given a World and never reach outside by themselves — so a
// test gives them a made-up one (tests/core/fake-world.mjs) and sees what they would do.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * @typedef {object} World
 * @property {(node: string) => void} at                 the node being reached: what it prints is under its name
 * @property {(line: string) => void} say
 * @property {(program: string, args: string[], cwd: string) => number} run          a command, shown before it runs; its exit code
 * @property {(program: string, args: string[], cwd: string) => string} capture      a command's output, not shown
 * @property {(url: string, init?: RequestInit & { seconds?: number }) => Promise<{ status: number, text: string }>} ask   status 0: nothing answered
 * @property {(path: string) => boolean} exists
 * @property {(path: string) => string} read
 * @property {(seconds: number) => Promise<void>} sleep
 * @property {<T>(name: string, fn: () => Promise<T>) => Promise<T>} alone             while no other project on this machine does the same
 * @property {(pid: number) => void} kill
 * @property {NodeJS.Platform} platform
 */

/** @param {NodeJS.ProcessEnv} env @returns {World} */
export const realWorld = (env) => {
	const win = process.platform === "win32";
	let node = "";
	const sleep = (seconds) => new Promise((r) => setTimeout(() => r(undefined), seconds * 1000));
	return {
		platform: process.platform,
		at: (name) => (node = name),
		say: (line) => console.log(`[${node}] ${line}`),
		run: (program, args, cwd) => {
			console.log(`[${node}] $ ${[program, ...args].join(" ")}`);
			return spawnSync(program, args, { cwd, env, stdio: "inherit", shell: win && program !== process.execPath }).status ?? 1;
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
		exists: existsSync,
		read: (path) => (existsSync(path) ? readFileSync(path, "utf8") : ""),
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
