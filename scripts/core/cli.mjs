// The one way in: what a task in tasks.toml runs.
//
//   node cli.mjs <state> [--flag …]        bring the site to that state
//   node cli.mjs plan <state> [--flag …]   what that would do, in order, and do nothing
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { plan, reach } from "./graph.mjs";
import { projectOf } from "./project.mjs";
import { signin } from "./signin.mjs";
import { site } from "./site.mjs";
import { realWorld } from "./world.mjs";

const graph = { ...site, ...signin };
const argv = process.argv.slice(2);
const planning = argv[0] === "plan";
const [target, ...rest] = planning ? argv.slice(1) : argv;
/** @type {import("./graph.mjs").Flags} */
// --live, or as a task passes what it was given: --live=true, --live=false
const flags = Object.fromEntries(rest.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")).filter(([, v]) => v !== "false").map(([k, v]) => [k, v === undefined || v === "true" ? true : v]));

try {
	if (planning) {
		for (const name of plan(graph, target, flags)) console.log(name);
	} else {
		const project = projectOf(process.env, process.cwd(), join(dirname(fileURLToPath(import.meta.url)), ".."));
		console.error(`-> site folder: ${project.site}`);
		await reach(graph, target, { world: realWorld(process.env), project, flags, env: process.env });
	}
} catch (e) {
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(1);
}
