// Shared by every stage. Plain Node, no dependencies: it has to run wherever EmDash does.
// A stage is a list of EmDash's own commands; this file only runs them and waits for the site.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const root = process.env.MISE_CONFIG_ROOT ?? process.cwd();
// Always inside the project, by name. Never an absolute path from the environment: a shell that was
// last used in another project would send this stage to that project's site.
export const siteDir = "site";
export const site = join(root, siteDir);
export const runDir = join(root, "run");
export const port = process.env.SITE_PORT ?? "4321";
export const url = `http://localhost:${port}`;
const windows = process.platform === "win32";

const began = Date.now();
// Each step says how far into the stage it started, so a slow one shows itself.
export const step = (text) => console.log(`→ ${text}  (+${Math.round((Date.now() - began) / 1000)}s)`);
export const ok = (text) => console.log(`  ✓ ${text}`);
export function fail(text, hint) {
	console.error(`✗ ${text}`);
	if (hint) console.error(`  ${hint}`);
	process.exit(1);
}

// What the user typed after `--`. mise appends it on Unix and puts it in `usage_args` on Windows.
export function given() {
	const direct = process.argv.slice(2);
	if (direct.length > 0) return direct;
	return (process.env.usage_args ?? "").match(/"[^"]*"|'[^']*'|\S+/g)?.map((w) => w.replace(/^["']|["']$/g, "")) ?? [];
}

// Run one command and show its output. A failure stops the stage unless `allowFail`.
export function run(command, args, { cwd = site, allowFail = false, capture = false, env = {} } = {}) {
	// On Windows the package manager is a .cmd file, which only a shell can start.
	const quoted = windows ? args.map((a) => (/[\s"]/.test(a) ? `"${a.replaceAll('"', '\\"')}"` : a)) : args;
	const result = spawnSync(command, quoted, {
		cwd,
		shell: windows,
		encoding: "utf8",
		stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
		env: { ...process.env, ...env },
	});
	const code = result.status ?? 1;
	if (code !== 0 && !allowFail) fail(`${command} ${args.join(" ")} failed (${code})`, capture ? result.stderr?.trim() : undefined);
	return { code, out: result.stdout ?? "", err: result.stderr ?? "" };
}

// The official CLI, aimed at THIS project's site whatever port it is on.
export const emdash = (args, options = {}) => run("pnpm", ["exec", "emdash", ...args], { ...options, env: { EMDASH_URL: url, ...options.env } });

export async function answers(address, timeoutMs = 5000) {
	try {
		const response = await fetch(address, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
		return response.status < 500;
	} catch {
		return false;
	}
}

// The dev server, in the background: `pnpm dev`, its log in run/site.log, its pid in run/site.pid.
const pidFile = join(runDir, "site.pid");
function serverPid() {
	if (!existsSync(pidFile)) return null;
	const pid = Number(readFileSync(pidFile, "utf8").trim());
	try {
		process.kill(pid, 0);
		return pid;
	} catch {
		return null;
	}
}
export function stopServer() {
	const pid = serverPid();
	if (pid === null) return false;
	if (windows) spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"]);
	else process.kill(-pid, "SIGTERM");
	rmSync(pidFile, { force: true });
	return true;
}
export async function startServer() {
	// Whoever started it, a site that answers on this project's port is left alone.
	if (await answers(url)) return false;
	stopServer();
	mkdirSync(runDir, { recursive: true });
	const log = openSync(join(runDir, "site.log"), "w");
	const child = spawn("pnpm", ["dev", "--host", "127.0.0.1", "--port", port], {
		cwd: site,
		shell: windows,
		detached: true,
		stdio: ["ignore", log, log],
		// Astro backgrounds itself when it thinks an agent started it, which loses the pid.
		env: { ...process.env, ASTRO_DEV_BACKGROUND: "1" },
	});
	child.unref();
	writeFileSync(pidFile, `${child.pid}\n`);
	return true;
}

// EmDash's own first call: it migrates, applies the seed, finishes setup and signs the developer in.
// One patient call, retried only while the server is still refusing connections.
export async function setUp() {
	const deadline = Date.now() + 120_000;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${url}/_emdash/api/setup/dev-bypass?token=1`, { method: "POST", signal: AbortSignal.timeout(300_000) });
			if (response.ok) return (await response.json())?.data?.token ?? "";
			fail(`the site answered its setup call with ${response.status}`, `see ${join("run", "site.log")}`);
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}
	fail("the site did not start within two minutes", `see ${join("run", "site.log")}`);
}

export { existsSync, join, mkdirSync, readFileSync, writeFileSync };
