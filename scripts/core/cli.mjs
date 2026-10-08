// The one way in: what every task in tasks.toml runs.
//
//   node cli.mjs <task> [what the task was given]        bring the site to that state
//   node cli.mjs plan <task> [--live …]                  what that would do, in order, and do nothing
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Exit, setReacher } from "./calls.mjs";
import { plan, reach } from "./graph.mjs";
import { pluginDemo } from "./plugin-demo.mjs";
import { projectOf } from "./project.mjs";
import { signin } from "./signin.mjs";
import { site } from "./site.mjs";
import { tasks } from "./tasks.mjs";
import { realWorld } from "./world.mjs";

/** Every state the tasks know. */
export const graph = { ...site, ...signin, ...tasks, ...pluginDemo };

/**
 * What a task was given: --live, or as tasks.toml passes it on, --live=true / --live=false.
 * @param {string[]} argv @returns {{ flags: import("./graph.mjs").Flags, args: string[] }}
 */
export const given = (argv) => {
	/** @type {import("./graph.mjs").Flags} */
	const flags = {};
	const args = [];
	for (const a of argv) {
		if (!a.startsWith("--")) args.push(a);
		else {
			const [name, value] = a.slice(2).split("=");
			if (value !== "false") flags[name] = value === undefined || value === "true" ? true : value;
		}
	}
	return { flags, args: args.filter((a) => a !== "") };
};

/** @param {string[]} argv */
const main = async (argv) => {
	const planning = argv[0] === "plan";
	const [target, ...rest] = planning ? argv.slice(1) : argv;
	const { flags, args } = given(rest);
	if (planning) return void console.log(plan(graph, target, flags).join("\n"));
	const project = projectOf(process.env, process.cwd(), join(dirname(fileURLToPath(import.meta.url)), ".."));
	const world = realWorld(process.env);
	if (!["site:new", "site:ports", "site:delete", "browser:check"].includes(target)) console.error(`-> site folder: ${project.site}`);
	const base = { world, project, env: process.env };
	// a state reached from inside another's work: the same graph, in this process
	setReacher((name, flags = {}) => reach(graph, name, { ...base, flags, args: [], argv: [] }, true));
	await reach(graph, target, { ...base, flags, args, argv: rest });
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	try {
		await main(process.argv.slice(2));
	} catch (e) {
		if (e instanceof Exit) process.exit(e.code);
		console.error(e instanceof Error ? e.message : String(e));
		process.exit(1);
	}
}
