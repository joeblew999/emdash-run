// What `mise run plugin:new` runs first: EmDash's scaffolder for a plugin inside the site — unless
// the plugin is already there. mise cannot look at the disk, so "is it already there?" is asked
// here, and the answer decides whether EmDash's own command runs. Safe to run again.
//
//   node plugin-new.mjs <site folder> <name> <publisher> <author> <security email>
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const [siteDir, ...rest] = process.argv.slice(2);
const win = process.platform === "win32";
// On Windows pnpm is a .cmd file and needs a shell, which splits on spaces: quote what has them.
const run = (program, args, cwd) => {
	const r = spawnSync(program, win ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, { cwd, stdio: "inherit", shell: win });
	if (r.status !== 0) process.exit(r.status ?? 1);
};
const [name, publisher, author, email] = rest;
if (existsSync(join(siteDir, "plugins", name, "package.json"))) {
	console.log(`The plugin [${name}] is already there: not scaffolded again. Installing, testing, building and adding it.`);
	process.exit(0);
}
run("pnpm", ["dlx", "@emdash-cms/plugin-cli@latest", "init", name, "--dir", `plugins/${name}`, "--yes", "--publisher", publisher, "--author-name", author, "--security-email", email, "--package-manager", "pnpm"], siteDir);
