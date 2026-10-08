// The graph: every state a site can be brought to is a node, and a task is "reach this node".
//
//   needs   the states it stands on, in order — a function of the flags, so `--live` is an edge
//   done    is the state already reached? Then nothing is done, and the task is safe to run again
//   work    reach it
//
// Data, so it can be tested without a site: plan() says what a task would do, in what order.

/**
 * @typedef {Record<string, string | boolean>} Flags
 * @typedef {import("./world.mjs").World} World
 * @typedef {import("./project.mjs").Project} Project
 * @typedef {{ world: World, project: Project, flags: Flags }} Ctx
 * @typedef {object} Node
 * @property {(flags: Flags) => string[]} [needs]
 * @property {(ctx: Ctx) => boolean | Promise<boolean>} [done]
 * @property {(ctx: Ctx) => void | Promise<void>} work
 * @typedef {Record<string, Node>} Graph
 */

/**
 * The nodes a target stands on and the target, each once, in the order they are reached.
 * @param {Graph} graph @param {string} target @param {Flags} [flags] @returns {string[]}
 */
export const plan = (graph, target, flags = {}) => {
	/** @type {string[]} */
	const order = [];
	/** @param {string} name @param {string[]} path */
	const visit = (name, path) => {
		if (!graph[name]) throw new Error(`[${name}] is not a state the tasks know${path.length ? ` (needed by ${path.at(-1)})` : ""}`);
		if (path.includes(name)) throw new Error(`a circle: ${[...path, name].join(" -> ")}`);
		if (order.includes(name)) return;
		for (const need of graph[name].needs?.(flags) ?? []) visit(need, [...path, name]);
		order.push(name);
	};
	visit(target, []);
	return order;
};

/**
 * Bring the site to a state: each node of the plan in order, skipping those already reached.
 * @param {Graph} graph @param {string} target @param {Ctx} ctx @returns {Promise<{ did: string[], skipped: string[] }>}
 */
export const reach = async (graph, target, ctx) => {
	const did = [];
	const skipped = [];
	for (const name of plan(graph, target, ctx.flags)) {
		const node = graph[name];
		ctx.world.at(name);
		if (await node.done?.(ctx)) {
			skipped.push(name);
			ctx.world.say("already so");
			continue;
		}
		await node.work(ctx);
		did.push(name);
	}
	return { did, skipped };
};
