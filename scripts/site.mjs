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
import { Exit, task } from "./core/calls.mjs";

/** @param {string[]} argv */
export async function main(argv) {
	const [what, siteDir, ...rest] = argv;
	const win = process.platform === "win32";
	// On Windows pnpm is a .cmd file and needs a shell, which splits on spaces: quote what has them.
	const run = (/** @type {string} */ program, /** @type {string[]} */ args, /** @type {string} */ cwd) => {
		const r = spawnSync(program, win ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, { cwd, stdio: "inherit", shell: win });
		if (r.status !== 0) throw new Exit(r.status ?? 1);
	};

	if (what === "delete") {
		if (!existsSync(siteDir)) {
			console.log(`There is no [${basename(siteDir)}] folder: nothing to delete.`);
			throw new Exit(0);
		}
		if (existsSync(join(siteDir, "node_modules", "astro"))) await task("site:stop");
		rmSync(siteDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
		console.log(`Deleted [${basename(siteDir)}].`);
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
		const read = (/** @type {string} */ f) => (existsSync(join(siteDir, f)) ? readFileSync(join(siteDir, f), "utf8") : "");
		const said = (/** @type {string} */ name) => (read("mise.local.toml") + read("mise.toml")).match(new RegExp(`^\\s*${name}\\s*=\\s*"?(\\d+)`, "m"))?.[1];
		const free = () => new Promise((resolve) => {
			const server = createServer();
			server.listen(0, "127.0.0.1", () => {
				const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());
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
				throw new Exit(1);
			}
			if (!dev) add += `SITE_PORT = "${(dev = String(await free()))}"\n`;
			if (!built) add += `PREVIEW_PORT = "${(built = String(await free()))}"\n`;
			appendFileSync(join(siteDir, "mise.local.toml"), add);
			console.log(`Ports of its own, in mise.local.toml: dev site ${dev}, built site ${built}.`);
		}
	} else {
		console.error("usage: site.mjs delete|ports|forget …");
		throw new Exit(1);
	}
}
