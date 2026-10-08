// How one piece of the program asks for another, and how it stops.
//
//   task("site:preview")   bring the site to that state, from inside another state's work. The
//                          graph is walked in this process: nothing here starts `mise run`.
//   throw new Exit(1)      end the task with this exit code (what was printed says why)

export class Exit extends Error {
	/** @param {number} code */
	constructor(code) {
		super(`exit ${code}`);
		this.code = code;
	}
}

/** @type {(name: string, flags?: import("./graph.mjs").Flags) => Promise<unknown>} */
let reacher = async (name) => {
	throw new Error(`nothing is set to reach [${name}]`);
};
/** Set by the entry (cli.mjs), and by a test that wants to see what is asked for. @param {typeof reacher} fn */
export const setReacher = (fn) => void (reacher = fn);
/** @param {string} name @param {import("./graph.mjs").Flags} [flags] */
export const task = (name, flags) => reacher(name, flags);
