// A made-up outside for the nodes: it has the files and the answers a test gives it, and keeps what
// was asked of it. Nothing is started, read or waited for.

/**
 * @param {{ files?: Record<string, string>, answers?: (url: string, init?: RequestInit) => { status: number, text?: string, headers?: Record<string, string> }, downloads?: (url: string) => { status: number, type?: string, bytes?: Uint8Array<ArrayBuffer> }, packages?: Record<string, unknown>, exits?: (command: string) => number, execs?: (command: string) => { code: number, out?: string, err?: string }, changed?: Record<string, number>, output?: (command: string) => string, platform?: NodeJS.Platform }} [given]
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
		tool: (tool, args) => {
			const command = [tool, ...args].join(" ");
			ran.push(command);
			return given.exits?.(command) ?? 0;
		},
		digest: (paths) => paths.map((p) => files[p.replaceAll("\\", "/")] ?? "").join("|"),
		capture: (program, args) => given.output?.([program, ...args].join(" ")) ?? "",
		ask: async (url, init) => ({ text: "", headers: {}, ...(given.answers?.(url, init) ?? { status: 0 }) }),
		// what the site's packages give: only what a test says it has installed
		load: async (_site, name) => {
			if (!given.packages || !(name in given.packages)) throw new Error(`Cannot find package '${name}'`);
			return given.packages[name];
		},
		download: async (url) => ({ type: "", bytes: new Uint8Array(), ...(given.downloads?.(url) ?? { status: 0 }) }),
		// paths with a slash, whatever the machine the test runs on joins them with
		exec: (program, args) => {
			const command = [program, ...args].join(" ");
			execd.push(command);
			return { out: "", err: "", ...(given.execs?.(command) ?? { code: 0 }) };
		},
		mkdir: () => {},
		remove: (path) => void delete files[path.replaceAll("\\", "/")],
		keep: (path, text) => void (files[path.replaceAll("\\", "/")] = text),
		newestPath: (paths) => paths.map((p) => p.replaceAll("\\", "/")).sort((x, y) => (given.changed?.[y] ?? 0) - (given.changed?.[x] ?? 0))[0] ?? "",
		newest: (paths) => Math.max(0, ...paths.map((p) => given.changed?.[p.replaceAll("\\", "/")] ?? 0)),
		sqlite: (file, sql) => void sqls.push({ file: file.replaceAll("\\", "/"), sql }),
		config: "/config",
		machine: "a machine",
		mint: () => ({ raw: "ec_pat_RAW", hash: "HASH", ids: ["ID1", "ID2"], now: "2026-01-01T00:00:00.000Z" }),
		exists: (path) => path.replaceAll("\\", "/") in files,
		read: (path) => files[path.replaceAll("\\", "/")] ?? "",
		list: (path) => Object.keys(files).filter((f) => f.startsWith(`${path.replaceAll("\\", "/")}/`)).map((f) => f.slice(path.length + 1).split("/")[0]),
		sleep: async () => {},
		alone: (_name, fn) => fn(),
		kill: (pid) => void killed.push(pid),
	};
	return { world, ran, said, killed, files, execd, sqls };
};

/** @type {import("../../scripts/core/project.mjs").Project} */
export const project = { root: "/p", siteName: "site", site: "/p/site", devPort: "4321", builtPort: "4322", dev: "http://127.0.0.1:4321", built: "http://127.0.0.1:4322", live: "", scripts: "/emdash-run/scripts" };
