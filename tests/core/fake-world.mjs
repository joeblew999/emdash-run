// A made-up outside for the nodes: it has the files and the answers a test gives it, and keeps what
// was asked of it. Nothing is started, read or waited for.

/**
 * @param {{ files?: Record<string, string>, answers?: (url: string, init?: RequestInit) => { status: number, text?: string }, exits?: (command: string) => number, output?: (command: string) => string, platform?: NodeJS.Platform }} [given]
 */
export const fakeWorld = (given = {}) => {
	const files = given.files ?? {};
	/** @type {string[]} */
	const ran = [];
	/** @type {string[]} */
	const said = [];
	/** @type {number[]} */
	const killed = [];
	/** @type {import("../../scripts/core/world.mjs").World} */
	const world = {
		platform: given.platform ?? "darwin",
		at: () => {},
		say: (line) => void said.push(line),
		run: (program, args) => {
			const command = [program, ...args].join(" ");
			ran.push(command);
			return given.exits?.(command) ?? 0;
		},
		capture: (program, args) => given.output?.([program, ...args].join(" ")) ?? "",
		ask: async (url, init) => ({ text: "", ...(given.answers?.(url, init) ?? { status: 0 }) }),
		exists: (path) => path in files,
		read: (path) => files[path] ?? "",
		sleep: async () => {},
		alone: (_name, fn) => fn(),
		kill: (pid) => void killed.push(pid),
	};
	return { world, ran, said, killed, files };
};

/** @type {import("../../scripts/core/project.mjs").Project} */
export const project = { root: "/p", siteName: "site", site: "/p/site", devPort: "4321", builtPort: "4322", dev: "http://127.0.0.1:4321", built: "http://127.0.0.1:4322", live: "", scripts: "/emdash-run/scripts" };
