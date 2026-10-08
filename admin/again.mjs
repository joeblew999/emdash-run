// What makes three tasks safe to run again. mise cannot look at the disk, so the "is it already
// there?" question is asked here, and the answer decides whether EmDash's own command runs.
//
//   node again.mjs new <site folder> <template>          site:new    — a site that exists is left alone
//   node again.mjs delete <site folder>                  site:delete — no site is nothing to delete
//   node again.mjs plugin <site folder> <name> <publisher> <author> <security email>
//                                                       plugin:new  — a plugin that exists is not scaffolded again
//   node again.mjs ports <project folder>               site:ports  — a project that has its ports keeps them
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
		// and a Node site's sandbox process, which outlives the site (admin/plugins.mjs, leftover)
		spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "plugins.mjs"), "leftover", siteDir], { stdio: "inherit" });
	}
	rmSync(siteDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
	console.log(`Deleted [${basename(siteDir)}].`);
} else if (what === "plugin") {
	const [name, publisher, author, email] = rest;
	if (existsSync(join(siteDir, "plugins", name, "package.json"))) {
		console.log(`The plugin [${name}] is already there: not scaffolded again. Installing, testing, building and adding it.`);
		process.exit(0);
	}
	run("pnpm", ["dlx", "@emdash-cms/plugin-cli@latest", "init", name, "--dir", `plugins/${name}`, "--yes", "--publisher", publisher, "--author-name", author, "--security-email", email, "--package-manager", "pnpm"], siteDir);
} else if (what === "live-up") {
	// The deployed site answers — the NEW version: an address nothing has cached, asked again for
	// up to a minute, because for some seconds after a deploy Cloudflare still answers for the old
	// one, or with a 404 of its own. (siteDir is the address here.) The first request after a
	// deploy runs EmDash's migrations and can take a while.
	const address = new URL(siteDir);
	let last = "no answer";
	for (let i = 0; i < 20; i++) {
		address.searchParams.set("emdash-run", String(Date.now()));
		try {
			const res = await fetch(address, { redirect: "manual", headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(180_000) });
			const ours = (res.headers.get("content-type") || "").includes("text/html");
			last = `HTTP ${res.status}`;
			if (res.status < 400) {
				console.log(`${address.origin} answers: ${last}`);
				process.exit(0);
			}
			// a new site has no pages until content is put in: the site's own 404 is an answer
			if (res.status === 404 && ours && i >= 2) {
				console.log(`${address.origin} answers, and has no home page yet (${last}). A newly deployed site starts without content:`);
				console.log("  mise run signin:token -- --live");
				console.log("  mise run emdash -- site export --output site.emdash                      (this machine's content)");
				console.log("  mise run emdash -- site import site.emdash --analyze --live              (prints a plan and its digest)");
				console.log("  mise run emdash -- site import site.emdash --plan <digest> --confirm --live");
				process.exit(0);
			}
		} catch (error) {
			last = error.message;
		}
		await new Promise((done) => setTimeout(done, 3000));
	}
	console.error(`${address.origin} did not answer after a minute: ${last}`);
	process.exit(1);
} else if (what === "forget") {
	// The local database is going: the token signin:token saved for it dies with it. Left behind,
	// the CLI would send it to the next database and be told "Invalid or expired token".
	// Only this site's: saved names for sites on this machine end in a hash of the site folder.
	const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run", "tokens");
	const mine = `_${createHash("sha256").update(resolve(siteDir)).digest("hex").slice(0, 10)}.json`;
	for (const f of existsSync(dir) ? readdirSync(dir) : []) if (f.endsWith(mine)) rmSync(join(dir, f), { force: true });
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
	console.error("usage: node again.mjs new|delete|plugin|ports …");
	process.exit(1);
}
