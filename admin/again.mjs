// What makes three tasks safe to run again. mise cannot look at the disk, so the "is it already
// there?" question is asked here, and the answer decides whether EmDash's own command runs.
//
//   node again.mjs new <site folder> <template>          site:new    — a site that exists is left alone
//   node again.mjs delete <site folder>                  site:delete — no site is nothing to delete
//   node again.mjs plugin <site folder> <name> <publisher> <author> <security email>
//                                                       plugin:new  — a plugin that exists is not scaffolded again
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

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
} else {
	console.error("usage: node again.mjs new|delete|plugin …");
	process.exit(1);
}
