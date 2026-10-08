// A made-up outside for the nodes: it has the files and the answers a test gives it, and keeps what
// was asked of it. Nothing is started, read or waited for.

/**
 * @param {{ files?: Record<string, string>, answers?: (url: string, init?: RequestInit) => { status: number, text?: string }, exits?: (command: string) => number, execs?: (command: string) => { code: number, out?: string, err?: string }, changed?: Record<string, number>, output?: (command: string) => string, platform?: NodeJS.Platform }} [given]
 */
export const fakeWorld = (given = {}) => {
	const files = given.files ?? {};
	/** @type {string[]} */
	const ran = [];
	/** @type {string[]} */
	const said = [];
	/** @type {number[]} */
	const killed = [];
	/** @type {string[]} */
	const execd = [];
	/** @type {{ file: string, sql: string }[]} */
	const sqls = [];
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
		// paths with a slash, whatever the machine the test runs on joins them with
		exec: (program, args) => {
			const command = [program, ...args].join(" ");
			execd.push(command);
			return { out: "", err: "", ...(given.execs?.(command) ?? { code: 0 }) };
		},
		keep: (path, text) => void (files[path.replaceAll("\\", "/")] = text),
		newest: (paths) => Math.max(0, ...paths.map((p) => given.changed?.[p.replaceAll("\\", "/")] ?? 0)),
		sqlite: (file, sql) => void sqls.push({ file: file.replaceAll("\\", "/"), sql }),
		config: "/config",
		machine: "a machine",
		mint: () => ({ raw: "ec_pat_RAW", hash: "HASH", ids: ["ID1", "ID2"], now: "2026-01-01T00:00:00.000Z" }),
		exists: (path) => path.replaceAll("\\", "/") in files,
		read: (path) => files[path.replaceAll("\\", "/")] ?? "",
		sleep: async () => {},
		alone: (_name, fn) => fn(),
		kill: (pid) => void killed.push(pid),
	};
	return { world, ran, said, killed, files, execd, sqls };
};

/** @type {import("../../scripts/core/project.mjs").Project} */
export const project = { root: "/p", siteName: "site", site: "/p/site", devPort: "4321", builtPort: "4322", dev: "http://127.0.0.1:4321", built: "http://127.0.0.1:4322", live: "", scripts: "/emdash-run/scripts" };
