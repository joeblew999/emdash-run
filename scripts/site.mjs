// What the site:* tasks need that no command gives. What makes them safe to run again: mise cannot look at the disk, so the "is it already
// there?" question is asked here, and the answer decides whether EmDash's own command runs.
//
//   node site.mjs new <site folder> <template>          site:new    — a site that exists is left alone
//   node site.mjs delete <site folder>                  site:delete — no site is nothing to delete
//   node site.mjs ports <project folder>               site:ports  — a project that has its ports keeps them
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { createServer } from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [what, siteDir, ...rest] = process.argv.slice(2);
const win = process.platform === "win32";
// On Windows pnpm is a .cmd file and needs a shell, which splits on spaces: quote what has them.
const run = (program, args, cwd) => {
	const r = spawnSync(program, win ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, { cwd, stdio: "inherit", shell: win });
	if (r.status !== 0) process.exit(r.status ?? 1);
};

if (what === "new") {
	if (existsSync(join(siteDir, "package.json"))) {
		console.log(`There is already a site in [${basename(siteDir)}]: left as it is.`);
		process.exit(0);
	}
	run("pnpm", ["dlx", "create-emdash@latest", basename(siteDir), "--template", rest[0], "--pm", "pnpm", "--install", "--yes"], dirname(siteDir));
} else if (what === "delete") {
	if (!existsSync(siteDir)) {
		console.log(`There is no [${basename(siteDir)}] folder: nothing to delete.`);
		process.exit(0);
	}
	if (existsSync(join(siteDir, "node_modules", "astro"))) {
		spawnSync("pnpm", ["exec", "astro", "dev", "stop"], { cwd: siteDir, stdio: "inherit", shell: win });
		spawnSync("pnpm", ["exec", "astro", "preview", "stop"], { cwd: siteDir, stdio: "inherit", shell: win });
		// and a Node site's sandbox process, which outlives the site (scripts/site-stop.mjs)
		spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "site-stop.mjs"), siteDir], { stdio: "inherit" });
	}
	rmSync(siteDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
	console.log(`Deleted [${basename(siteDir)}].`);
} else if (what === "forget") {
	// The local database is going: the token signin:token saved for it dies with it. Left behind,
	// the CLI would send it to the next database and be told "Invalid or expired token".
	// Only this site's: saved names for sites on this machine end in a hash of the site folder.
	const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run", "tokens");
	const mine = `_${createHash("sha256").update(resolve(siteDir)).digest("hex").slice(0, 10)}.json`;
	for (const f of existsSync(dir) ? readdirSync(dir) : []) if (f.endsWith(mine)) rmSync(join(dir, f), { force: true });
} else if (what === "one-at-a-time") {
	// Start a site while no other site on this machine is starting. Cloudflare's Vite plugin picks
	// its debugger port by looking for a free one from 9229 and only then listening on it: two sites
	// started in the same moment pick the same port, and the loser answers 500 to everything
	// ("listen EADDRINUSE … 9229"; seen with three sites at once, here and on a CI runner).
	// A folder in the user's config is the lock; one left by a start that died is taken after 3 min.
	const { mkdirSync, rmdirSync, statSync } = await import("node:fs");
	const lock = join(process.env.EMDASH_RUN_LOCKS || join(homedir(), ".config", "emdash-run", "locks"), "starting-a-site");
	mkdirSync(dirname(lock), { recursive: true });
	for (let waited = 0; ; waited++) {
		try {
			mkdirSync(lock);
			break;
		} catch {
			let age = 0;
			try { age = Date.now() - statSync(lock).mtimeMs; } catch {}
			if (age > 180_000 || waited > 400) { try { rmdirSync(lock); } catch {} continue; }
			await new Promise((done) => setTimeout(done, 500));
		}
	}
	// siteDir is the first word of the command here: what follows `one-at-a-time` is the command
	const r = spawnSync(siteDir, rest, { stdio: "inherit", shell: process.platform === "win32" });
	// Its turn lasts until the site has answered once. The first request is when a site does its
	// slow work — the dev site builds its pages, EmDash makes its database. On a slow CI runner the
	// CLI was told "Not authenticated" straight after "Dev server running", twice in one run; why
	// was not seen, and a second site starting or the CLI signing in during that first request are
	// the two things this keeps apart. Two minutes at most: a lock is
	// taken from a start that died after three. Any answer ends the wait; a 5xx is printed, because
	// what the site says then is the only account of why the next step fails.
	const port = rest[rest.indexOf("--port") + 1];
	if (r.status === 0 && rest.includes("--port") && /^\d+$/.test(port)) {
		const began = Date.now();
		let answer = null;
		while (!answer && Date.now() - began < 120_000) {
			try {
				answer = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual", signal: AbortSignal.timeout(120_000 - (Date.now() - began)) });
			} catch {
				await new Promise((done) => setTimeout(done, 500));
			}
		}
		if (!answer) console.error(`The site at http://127.0.0.1:${port} was started and has not answered in two minutes.`);
		else if (answer.status >= 500) console.error(`The site at http://127.0.0.1:${port} answers ${answer.status}: ${(await answer.text().catch(() => "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)}`);
	} else {
		await new Promise((done) => setTimeout(done, 1500));
	}
	try { rmdirSync(lock); } catch {}
	process.exit(r.status ?? 1);
} else if (what === "ports") {
	// siteDir is the PROJECT folder here. Two ports nothing is using, written to mise.local.toml —
	// which git ignores and mise reads — so this project, or this agent's copy of it, never
	// shares a port with another. A project that already says its ports keeps them.
	const read = (f) => (existsSync(join(siteDir, f)) ? readFileSync(join(siteDir, f), "utf8") : "");
	const said = (name) => (read("mise.local.toml") + read("mise.toml")).match(new RegExp(`^\\s*${name}\\s*=\\s*"?(\\d+)`, "m"))?.[1];
	const free = () => new Promise((resolve) => {
		const server = createServer();
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});
	let [dev, built] = [said("SITE_PORT"), said("PREVIEW_PORT")];
	if (dev && built) {
		console.log(`This project already has its ports: dev site ${dev}, built site ${built}.`);
	} else {
		const local = read("mise.local.toml");
		let add = local.includes("[env]") ? "" : `${local && !local.endsWith("\n") ? "\n" : ""}[env]\n`;
		if (local.includes("[env]") && !local.trimEnd().endsWith("[env]") && !/\[env\][^\[]*$/.test(local)) {
			console.error("mise.local.toml has an [env] block that is not its last block: add SITE_PORT and PREVIEW_PORT to it by hand.");
			process.exit(1);
		}
		if (!dev) add += `SITE_PORT = "${(dev = String(await free()))}"\n`;
		if (!built) add += `PREVIEW_PORT = "${(built = String(await free()))}"\n`;
		appendFileSync(join(siteDir, "mise.local.toml"), add);
		console.log(`Ports of its own, in mise.local.toml: dev site ${dev}, built site ${built}.`);
	}
} else {
	console.error("usage: node site.mjs new|delete|ports|forget|one-at-a-time …");
	process.exit(1);
}
