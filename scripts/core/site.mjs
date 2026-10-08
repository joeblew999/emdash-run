// The states of a site on this machine, as nodes of the graph (graph.mjs).
import { join, resolve } from "node:path";

/** @typedef {import("./graph.mjs").Graph} Graph @typedef {import("./graph.mjs").Ctx} Ctx */

/** A command that must succeed. @param {Ctx} ctx @param {string} program @param {string[]} args */
const must = ({ world, project }, program, args) => {
	const code = world.run(program, args, project.site);
	if (code !== 0) throw new Error(`${[program, ...args].join(" ")} failed (exit ${code})`);
};
/** One of the site's own tools, which must succeed. @param {Ctx} ctx @param {string} name @param {string[]} args */
const tool = ({ world, project }, name, args) => {
	const code = world.tool(name, args, project.site);
	if (code !== 0) throw new Error(`${[name, ...args].join(" ")} failed (exit ${code})`);
};
/** Does the site at this address answer at all? @param {Ctx} ctx @param {string} url */
const answers = async ({ world }, url) => (await world.ask(`${url}/`, { seconds: 5 })).status !== 0;

/**
 * What a site's build is made from. The server part of the build is what is compared with these: a
 * dist/ with only its client half is not a build (one stopped half way left exactly that).
 * @param {string} dir the site's folder @param {import("./world.mjs").World} world
 */
const madeFrom = (dir, world) => ({
	// folders: a file in them changed after the build
	folders: [join(dir, "src"), join(dir, "public"), join(dir, "seed"), ...(world.exists(join(dir, "plugins")) ? [join(dir, "plugins")] : [])],
	// single files: what they hold changed — not their date, which pnpm moves without changing them
	files: ["astro.config.mjs", "astro.config.ts", "package.json", "pnpm-lock.yaml", "wrangler.jsonc", "tsconfig.json", ".env"].map((f) => join(dir, f)),
});
/** Why the build is not of what is here now; "" when it is. @param {string} dir @param {import("./world.mjs").World} world */
const stale = (dir, world) => {
	const from = madeFrom(dir, world);
	const built = world.newest([join(dir, "dist", "server")]);
	if (built === 0) return "there is no build yet";
	if (built <= world.newest(from.folders)) return `${world.newestPath(from.folders).slice(dir.length + 1)} changed after the last build`;
	// (a build made before this note was kept is judged by date, as it was then)
	const note = world.read(join(dir, "dist", ".built-from"));
	if (note === "" ? built <= world.newest(from.files) : note !== world.digest(from.files)) return "the site's config or packages changed since the last build";
	return "";
};

/**
 * Does the lockfile have every package package.json asks for, as it asks for it? (A package added
 * to package.json by hand is not in it until pnpm installs.)
 * @param {string} packageJson @param {string} lock
 */
export const lockCovers = (packageJson, lock) => {
	const pkg = JSON.parse(packageJson || "{}");
	const escaped = (/** @type {string} */ t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).every(([name, spec]) => new RegExp(`^\\s+'?${escaped(name)}'?:\\r?\\n\\s+specifier: '?${escaped(String(spec))}'?\\s*$`, "m").test(lock));
};

/** @type {Graph} */
export const site = {
	"site:exists": {
		done: ({ world, project }) => world.exists(join(project.site, "package.json")),
		work: ({ project }) => {
			throw new Error(`There is no site in [${project.siteName}]. Make one with: mise run site:new - or set SITE_FOLDER to where the site is.`);
		},
	},
	"site:installed": {
		needs: () => ["site:exists"],
		// Already so when what pnpm last installed is what the lockfile says: pnpm keeps its own copy
		// of the lockfile it installed from, beside the packages. Not asking pnpm matters: an install
		// under a RUNNING dev site changes files Vite has in hand, and the site answers 500 from then on.
		done: ({ world, project }) => {
			const lock = world.read(join(project.site, "pnpm-lock.yaml"));
			return lock !== "" && lock === world.read(join(project.site, "node_modules", ".pnpm", "lock.yaml")) && lockCovers(world.read(join(project.site, "package.json")), lock);
		},
		work: (ctx) => must(ctx, "pnpm", ["install"]),
	},
	"site:key": {
		needs: () => ["site:installed"],
		done: ({ world, project }) => /^EMDASH_ENCRYPTION_KEY=./m.test(world.read(join(project.site, ".env"))),
		work: (ctx) => tool(ctx, "emdash", ["secrets", "generate", "--write", ".env"]),
	},
	"site:dev-running": {
		needs: () => ["site:key"],
		// answering, and not with a server error: a dev site that answers 500 to its front page is
		// broken (its packages were changed under it), and is started again
		done: async ({ world, project }) => {
			const status = (await world.ask(`${project.dev}/`, { seconds: 20 })).status;
			return status !== 0 && status < 500;
		},
		// Started while no other site on the machine is starting: Cloudflare's Vite plugin picks its
		// debugger port by looking for a free one from 9229 and only then listening on it, so two sites
		// started in the same moment pick the same port and the loser answers 500 to everything. Its
		// turn lasts until it has answered once: the first request is when a site does its slow work.
		work: (ctx) =>
			ctx.world.alone("starting-a-site", async () => {
				const { world, project } = ctx;
				if (await answers(ctx, project.dev)) {
					world.say("the dev site answers with a server error: stopping it, and starting it again");
					world.tool("astro", ["dev", "stop"], project.site);
					world.remove(join(project.site, "node_modules", ".vite"));
				}
				const code = world.tool("astro", ["dev", "--background", "--host", "127.0.0.1", "--port", project.devPort], project.site);
				if (code !== 0) {
					// a site started in the background that died says only that it did: its own log says why
					world.say("What the site's own log says:");
					world.tool("astro", ["dev", "logs"], project.site);
					throw new Error("the dev site did not start");
				}
				for (let waited = 0; waited < 120; waited += 0.5) {
					const answer = await world.ask(`${project.dev}/`, { seconds: 120 });
					if (answer.status >= 500) world.say(`The site at ${project.dev} answers ${answer.status}: ${answer.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)}`);
					if (answer.status !== 0) return;
					await world.sleep(0.5);
				}
				throw new Error(`The site at ${project.dev} was started and has not answered in two minutes.`);
			}),
	},
	// The production build — what a deploy ships. Not made again while nothing it is made from has
	// changed since the last one. The built site is stopped first: running, it holds the build's
	// files (on Windows the build then cannot empty its folder), and serves the old one.
	"site:built": {
		needs: () => ["site:key"],
		done: ({ world, project }) => stale(project.site, world) === "",
		work: (ctx) => {
			const { world, project } = ctx;
			world.say(`building: ${stale(project.site, world)}`); // why, so that a build nobody expected explains itself
			world.tool("astro", ["preview", "stop"], project.site);
			tool(ctx, "astro", ["build"]);
			world.keep(join(project.site, "dist", ".built-from"), world.digest(madeFrom(project.site, world).files));
		},
	},
	// The built site, served on this machine as a deployed one behaves. Started again when the build
	// under it was just made again.
	"site:built-running": {
		needs: () => ["site:built"],
		done: async (ctx) => !ctx.flags.restart && !ctx.did.includes("site:built") && (await answers(ctx, ctx.project.built)),
		work: (ctx) =>
			ctx.world.alone("starting-a-site", async () => {
				const { world, project } = ctx;
				world.tool("astro", ["preview", "stop"], project.site);
				const code = world.tool("astro", ["preview", "--background", "--host", "127.0.0.1", "--port", project.builtPort], project.site, { EMDASH_SITE_URL: `http://localhost:${project.builtPort}` });
				if (code !== 0) {
					world.say("What the built site's own log says:");
					world.tool("astro", ["preview", "logs"], project.site);
					throw new Error("the built site did not start");
				}
				for (let waited = 0; waited < 180; waited += 0.5) {
					if ((await world.ask(`${project.built}/`, { seconds: 180 })).status !== 0) return;
					await world.sleep(0.5);
				}
				throw new Error(`The built site at ${project.built} was started and has not answered in three minutes.`);
			}),
	},
	// The task site:preview
	"site:preview": {
		needs: () => ["site:built-running"],
		work: ({ world, project }) => world.say(`the built site: http://localhost:${project.builtPort}`),
	},
	// NOT YET CONVERTED: this runs the old emdash.mjs, a program a test cannot call into.
	// Upstream: emdash-cms/emdash#3995 (when fixed: this can be `emdash whoami`, the command made for it)
	"site:dev-cli-answers": {
		needs: () => ["site:dev-running"],
		work: (ctx) => must(ctx, process.execPath, [join(ctx.project.scripts, "emdash.mjs"), `http://localhost:${ctx.project.devPort}`, ctx.project.site, "schema", "list"]),
	},
	// The task site:start: the dev site running, the CLI answered, and EmDash's welcome dialog — which
	// greets every new user until they close it, and has no setting — closed for the dev user, by the
	// one call its own button makes. Never fails the task: a dialog is not worth one.
	"site:start": {
		needs: () => ["site:dev-cli-answers"],
		work: async ({ world, project }) => {
			const asked = await world.ask(`${project.dev}/_emdash/api/setup/dev-bypass?token=1`, { method: "POST", seconds: 120 });
			let token = "";
			try {
				const body = JSON.parse(asked.text);
				token = body?.data?.token ?? body?.token ?? "";
			} catch {}
			const closed = token
				? (await world.ask(`${project.dev}/_emdash/api/auth/me`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-EmDash-Request": "1" }, body: JSON.stringify({ action: "dismissWelcome" }) })).status
				: 0;
			world.say(closed >= 200 && closed < 300 ? "welcome: EmDash's welcome dialog is closed for the dev user" : "welcome: could not close EmDash's welcome dialog — close it once in the admin");
		},
	},
	// The task site:status: where the site is, state by state — and only looking. Each line is a
	// state the other tasks reach; `done` is the same question they ask before doing anything.
	"site:status": {
		work: async (ctx) => {
			const { world, project } = ctx;
			const tokens = join(world.config, "emdash-run", "tokens");
			/** @type {[string, boolean | Promise<boolean>, string][]} */
			const states = [
				["a site", world.exists(join(project.site, "package.json")), "mise run site:new"],
				["its packages", world.exists(join(project.site, "node_modules")), "mise run site:start"],
				["its key", /^EMDASH_ENCRYPTION_KEY=./m.test(world.read(join(project.site, ".env"))), "mise run site:start"],
				["the dev site running", answers(ctx, project.dev), "mise run site:start"],
				["built, from what is here now", !!(await site["site:built"].done?.(ctx)), "mise run site:preview"],
				["the built site running", answers(ctx, project.built), "mise run site:preview"],
				["this machine signed in to the built site", world.exists(tokens) && world.list(tokens).some((f) => f.startsWith(`localhost_${project.builtPort}_`)), "mise run signin:token"],
				...(project.live ? /** @type {[string, Promise<boolean>, string][]} */ ([["the deployed site answering", world.ask(project.live, { seconds: 15 }).then((a) => a.status !== 0), "mise run live:ship"]]) : []),
			];
			for (const [what, is, how] of states) world.say(`${(await is) ? "yes" : "no "}  ${what}${(await is) ? "" : `   — to get there: ${how}`}`);
			if (!project.live) world.say("     (no deployed site is named: LIVE_URL in the [env] block of mise.toml)");
		},
	},
	// The task site:stop: both sites stopped, and a Node site's sandbox process with them. EmDash
	// starts that process (workerd) through a launcher and stops the launcher, not workerd itself,
	// which then outlives the site and keeps its port. This stops exactly that: a workerd run from
	// THIS site's own node_modules. Nothing by name, nothing by port, nothing of another site's.
	"site:stop": {
		needs: () => ["site:exists"],
		work: ({ world, project }) => {
			world.tool("astro", ["dev", "stop"], project.site);
			world.tool("astro", ["preview", "stop"], project.site);
			if (world.platform === "win32" || !world.exists(join(project.site, "node_modules", "workerd"))) return;
			const mine = `${join(resolve(project.site), "node_modules")}/`;
			for (const line of world.capture("ps", ["-axo", "pid=,command="], project.site).split("\n")) {
				const m = /^\s*(\d+)\s+(\S+)\s+serve\s/.exec(line);
				if (!m || !/\/bin\/workerd$/.test(m[2]) || !m[2].startsWith(mine)) continue;
				world.kill(Number(m[1]));
				world.say(`Stopped this site's sandbox process, which the stopped site had left running (workerd, pid ${m[1]}).`);
			}
		},
	},
};
