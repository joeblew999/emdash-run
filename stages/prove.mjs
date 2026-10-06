// prove — do the stages really work, from nothing, on this machine? Makes a throwaway project that
// holds ONLY a mise.toml, runs the stages in it the way a developer would, and checks what they
// left behind. CI runs it on macOS, Linux and Windows. By default the project includes this
// checkout's tasks.toml; `--git <url> <ref>` includes it from a git host instead, which is how a
// real project gets it.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fail, given, ok, step } from "./lib.mjs";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const args = given();
const git = args.indexOf("--git");
const include = git >= 0 ? `git::${args[git + 1]}//tasks.toml?ref=${args[git + 2] ?? "main"}` : join(here, "tasks.toml").replaceAll("\\", "/");
const template = args.includes("--node") ? "node:starter" : "cloudflare:blog";

const port = await new Promise((resolve) => {
	const probe = createServer().listen(0, "127.0.0.1", () => {
		const { port } = probe.address();
		probe.close(() => resolve(port));
	});
});
const project = mkdtempSync(join(tmpdir(), "emdash-prove-"));
const url = `http://localhost:${port}`;
writeFileSync(
	join(project, "mise.toml"),
	`[settings]\nexperimental = true\n\n[env]\nTEMPLATE = "${template}"\nEMDASH_VERSION = "${process.env.EMDASH_VERSION ?? "1.1.0"}"\nSITE_PORT = "${port}"\n\n[task_config]\nincludes = ["${include}"]\n`,
);

// Every command the project runs is `mise`, exactly as typed by a developer in that folder.
// The environment is cleaned of this checkout's settings so that nothing leaks into the project.
const clean = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(MISE_(?!DATA|CACHE|GLOBAL|TRUSTED|YES)|usage_|SITE_|TEMPLATE$|EMDASH_|ROOT$|RUN_DIR$|SRC_DIR$|PLUGINS_DIR$|TEMPLATES_DIR$)/.test(name)));
function mise(...words) {
	const result = spawnSync("mise", words, { cwd: project, encoding: "utf8", shell: process.platform === "win32", env: clean });
	return { code: result.status ?? 1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}
const problems = [];
function expect(what, passed, detail = "") {
	console.log(`  ${passed ? "✓" : "✗"} ${what}${detail ? ` — ${detail}` : ""}`);
	if (!passed) problems.push(what);
}
async function status(path) {
	try {
		return (await fetch(`${url}${path}`, { redirect: "manual", signal: AbortSignal.timeout(120_000) })).status;
	} catch {
		return 0;
	}
}

try {
	step(`a project that is one mise.toml — ${project}`);
	console.log(`    tasks from: ${include}`);
	mise("trust", "--quiet");
	const listed = mise("tasks", "ls");
	expect("the project sees the stage tasks", /^start\s/m.test(listed.out) && /^emdash\s/m.test(listed.out), listed.code === 0 ? "" : listed.out.trim().split("\n").pop());

	step("mise run start — from nothing");
	const began = Date.now();
	const first = mise("run", "start");
	expect("start exits 0", first.code === 0, first.code === 0 ? `${Math.round((Date.now() - began) / 1000)}s` : first.out.trim().split("\n").slice(-6).join(" | "));
	if (first.code !== 0) {
		// Nothing after this can hold. Show why, and stop.
		const log = join(project, "run", "site.log");
		console.log(first.out.trim().split("\n").slice(-12).map((line) => `    ${line}`).join("\n"));
		if (existsSync(log)) console.log(readFileSync(log, "utf8").trim().split("\n").slice(-25).map((line) => `    site.log │ ${line}`).join("\n"));
		throw new Error("start failed");
	}
	expect("create-emdash made site/", existsSync(join(project, "site", "astro.config.mjs")));
	const installed = join(project, "site", "node_modules", "emdash", "package.json");
	expect("EmDash is installed at the pinned version", existsSync(installed) && JSON.parse(readFileSync(installed, "utf8")).version === (process.env.EMDASH_VERSION ?? "1.1.0"));
	expect("the home page answers", (await status("/")) === 200);
	expect("the admin is there", [200, 302].includes(await status("/_emdash/admin")));
	expect("an admin token was written", existsSync(join(project, "run", "token-admin.txt")) && readFileSync(join(project, "run", "token-admin.txt"), "utf8").trim().length > 10);

	step("mise run emdash — the official CLI, with no token and no login");
	const posts = mise("run", "emdash", "--", "content", "list", "posts", "--json");
	expect("the CLI lists the seeded content", posts.code === 0 && /"slug"/.test(posts.out), posts.code === 0 ? "" : posts.out.trim().split("\n").pop());
	const help = mise("run", "emdash", "--", "schema", "--help");
	expect("flags reach the CLI", /add-field/.test(help.out));

	step("mise run start — again");
	const pid = readFileSync(join(project, "run", "site.pid"), "utf8").trim();
	const second = mise("run", "start");
	expect("the running site is left alone", second.code === 0 && readFileSync(join(project, "run", "site.pid"), "utf8").trim() === pid && /left alone/.test(second.out));

	step("mise run stop");
	expect("stop exits 0", mise("run", "stop").code === 0);
	await new Promise((resolve) => setTimeout(resolve, 2000));
	expect("nothing answers afterwards", (await status("/")) === 0);
} catch (error) {
	problems.push(String(error.message ?? error));
} finally {
	mise("run", "stop");
	// Windows can hold a just-stopped server's files for a moment; the temp directory is the OS's to clear.
	try {
		rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
	} catch {}
}
if (problems.length > 0) fail(`${problems.length} thing(s) did not hold on ${process.platform} ${process.arch}`, problems.join("; "));
ok(`the stages work from nothing on ${process.platform} ${process.arch}`);
