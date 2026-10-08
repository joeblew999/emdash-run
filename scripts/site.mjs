// Three jobs of the site:* tasks that are more than a command (scripts/core/tasks.mjs calls them):
//
//   main(["delete", <site folder>])    site:delete — the site stopped and its folder removed; no site is nothing to delete
//   main(["forget", <site folder>])    site:reset  — the token saved for a local database that is going
//   main(["ports", <project folder>])  site:ports  — two ports of its own; a project that has its ports keeps them
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { createServer } from "node:net";
import { basename, join, resolve } from "node:path";
import { Exit, task } from "./core/calls.mjs";

/** @param {string[]} argv */
export async function main(argv) {
	const [what, siteDir] = argv;

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
			// A port the machine calls free is one nothing is listening on YET: a second project asking in
			// the same moment was handed the same one (two test groups, side by side). So the ports handed
			// out in the last day are remembered, one folder a port — making a folder either works or it
			// does not, whoever else is asking — and a port that is remembered is not handed out again.
			const given = join(process.env.EMDASH_RUN_LOCKS || join(homedir(), ".config", "emdash-run", "locks"), "ports");
			mkdirSync(given, { recursive: true });
			for (const old of readdirSync(given)) if (Date.now() - statSync(join(given, old)).mtimeMs > 24 * 3600_000) rmSync(join(given, old), { recursive: true, force: true });
			const mine = async () => {
				for (;;) {
					const port = String(await free());
					try {
						mkdirSync(join(given, port));
						return port;
					} catch {}
				}
			};
			if (!dev) add += `SITE_PORT = "${(dev = await mine())}"\n`;
			if (!built) add += `PREVIEW_PORT = "${(built = await mine())}"\n`;
			appendFileSync(join(siteDir, "mise.local.toml"), add);
			console.log(`Ports of its own, in mise.local.toml: dev site ${dev}, built site ${built}.`);
		}
	} else {
		console.error("usage: site.mjs delete|ports|forget …");
		throw new Exit(1);
	}
}
