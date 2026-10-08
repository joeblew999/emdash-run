// What the plugin tasks run where EmDash has no command: a registry plugin is installed in the
// admin only, and a plugin package leaves two lines of astro.config.mjs to the developer.
// This file only says which job a task asked for. Each job is a file of its own:
//
//   node plugin.mjs sandbox <site folder>                       plugin:sandbox                      plugin-sandbox.mjs
//   node plugin.mjs leftover <site folder>                      site:stop — a Node site's sandbox   plugin-sandbox.mjs
//                                                                process, left running
//   node plugin.mjs config  <site folder> <package>             plugin:add, plugin:new — a          plugin-sandbox.mjs
//                                                                sandboxed plugin's lines in
//                                                                astro.config.mjs; a native
//                                                                plugin's are printed, not written
//   node plugin.mjs install <site address> <site folder> [--deployed] [--yes] <publisher>/<slug>…
//                                                                plugin:install, plugin:favourites   plugin-install.mjs
//   node plugin.mjs update  <site address> <site folder> [--deployed] [--yes] <publisher>/<slug>@<version>…
//                                                                plugin:update                       plugin-install.mjs
//   node plugin.mjs remove  <site address> <site folder> [--deployed] <publisher>/<slug>…
//                                                                plugin:remove                       plugin-install.mjs
//   node plugin.mjs works   <site address> <site folder> [name…] plugin:works                       plugin-works.mjs
//
// plugin-astro-config.mjs   the edits to astro.config.mjs, as functions from text to text
// plugin-api.mjs        the one client the registry tasks and the works check speak to a site with
import { resolve } from "node:path";

import { fail } from "./plugin-api.mjs";

const [what, ...argv] = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith("--"));
const args = argv.filter((a) => !a.startsWith("--"));

if (what === "leftover") {
	(await import("./plugin-sandbox.mjs")).stopLeftover(args[0]);
} else if (what === "sandbox") {
	const [siteDir] = args;
	console.error(`-> site folder: ${resolve(siteDir)}`);
	const changed = (await import("./plugin-sandbox.mjs")).sandbox(siteDir);
	for (const line of changed) console.log(`sandbox: ${line}`);
	console.log(changed.length ? "sandbox: this site can now run sandboxed plugins. Build it again for that to take effect (mise run site:preview, or site:start)." : "sandbox: already set up — nothing changed.");
} else if (what === "config") {
	(await import("./plugin-sandbox.mjs")).addToConfig(args[0], args[1]);
} else if (what === "install") {
	await (await import("./plugin-install.mjs")).install(args, flags);
} else if (what === "update") {
	await (await import("./plugin-install.mjs")).update(args, flags);
} else if (what === "remove") {
	await (await import("./plugin-install.mjs")).remove(args, flags);
} else if (what === "works") {
	await (await import("./plugin-works.mjs")).works(args, flags);
} else {
	fail("usage: node plugin.mjs sandbox|leftover|config|install|update|remove|works …");
}
