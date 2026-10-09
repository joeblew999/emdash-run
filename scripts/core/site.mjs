// The states of a site on this machine, as nodes of the graph (graph.mjs).
import { join, resolve } from "node:path";

import { task } from "./calls.mjs";

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
 * A change to the site's packages. Changed under a RUNNING dev site they leave it answering 500 from
 * its next request on (Vite has the old ones in hand) — and not at once, so a look straight
 * afterwards sees nothing wrong. So a dev site that is running is stopped first and started again after.
 * @param {Ctx} ctx @param {() => void} change
 */
const changingPackages = async (ctx, change) => {
	const { world, project } = ctx;
	const running = world.exists(join(project.site, "node_modules", "astro")) && (await answers(ctx, project.dev));
	if (running) {
		world.say("the dev site is running: stopping it while its packages change, and starting it again after");
		world.tool("astro", ["dev", "stop"], project.site);
		world.remove(join(project.site, "node_modules", ".vite"));
	}
	change();
	if (running) await task("site:dev-running");
};

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

/**
 * WHAT ANY SITE NEEDS before it is a site and not a template: asked of the built site, when it is
 * running and this machine is signed in to it. One line each, yes or no, and for a no where it is
 * set. Only looks. (A seed file can carry the title, tagline, address and social links; a logo, a
 * favicon and the picture for shared links name a file already in the site's library, which a seed
 * file cannot — mise run site:demo sets the last two for the demo.)
 * @param {Ctx} ctx @returns {Promise<string[]>}
 */
export const essentials = async ({ world, project }) => {
	const tokens = join(world.config, "emdash-run", "tokens");
	const file = world.list(tokens).find((f) => f.startsWith(`localhost_${project.builtPort}_`));
	if (!file) return [];
	const token = JSON.parse(world.read(join(tokens, file)) || "{}").token;
	/** What the site's API answers at a path: its `data`, or null. @param {string} path @returns {Promise<any>} */
	const get = async (path) => {
		const a = await world.ask(`${project.built}/_emdash/api/${path}`, { headers: { Authorization: `Bearer ${token}` }, seconds: 20 });
		try {
			return a.status === 200 ? JSON.parse(a.text).data : null;
		} catch {
			return null;
		}
	};
	const settings = await get("settings");
	if (!settings) return [];
	const [users, email, backups, plugins] = await Promise.all([get("admin/users"), get("settings/email"), get("settings/backups"), get("admin/plugins")]);
	// a person: an administrator who is not one the sign-in tasks made for a machine
	const people = (users?.items ?? []).filter((/** @type {any} */ u) => !String(u.email).endsWith("@emdash.local") && !u.disabled);
	/** @type {[string, boolean, string][]} */
	const needs = [
		["a title and a tagline of its own", !!settings.title && settings.title !== "My Site" && !!settings.tagline, "settings.title, settings.tagline in the seed"],
		["its public address", !!settings.url && !/localhost|127\.0\.0\.1/.test(settings.url), "settings.url in the seed (the deployed address)"],
		["a logo", !!settings.logo, "the admin: Settings, General (a PNG or JPEG: EmDash does not take an SVG)"],
		["a favicon", !!settings.favicon, "the admin: Settings, General"],
		["social links", Object.keys(settings.social ?? {}).length > 0, "settings.social in the seed"],
		["a default picture for links shared elsewhere", !!settings.seo?.defaultOgImage, "the admin: Settings, SEO"],
		["a person who can sign in (not only the machine's account)", people.length > 0, "ADMIN_EMAIL in mise.local.toml, then mise run signin:token; or an invitation from the admin"],
		["a way to send email (invitations, comment and form notices)", !!email?.available, "an email provider in astro.config.mjs"],
		["backups switched on", !!backups?.settings?.enabled, "the admin: Settings, Backups"],
		["plugins", (plugins?.items ?? []).length > 0, "mise run plugin:favourites"],
	];
	return ["what any site needs, on the built site:", ...needs.map(([what, is, where]) => `${is ? "yes" : "no "}  ${what}${is ? "" : `   — set in: ${where}`}`)];
};

/**
 * A site started in the background, and waited for until it has answered once: what it answered.
 * Astro says "running" as soon as the server listens. One that has ended since then would be waited
 * for in silence, to the last second: it is said, with the site's own log — which says why, and
 * which the next start empties — and started once more.
 * @param {Ctx} ctx @param {"dev" | "preview"} command @param {string} url @param {string} port
 * @param {number} seconds how long it is waited for  @param {Record<string, string>} [more] variables for it alone
 */
const startedAndAnswering = async ({ world, project }, command, url, port, seconds, more) => {
	const name = command === "dev" ? "dev site" : "built site";
	const log = () => {
		world.say(`What the ${name}'s own log says:`);
		world.tool("astro", [command, "logs"], project.site);
	};
	const start = () => {
		if (world.tool("astro", [command, "--background", "--host", "127.0.0.1", "--port", port], project.site, more) === 0) return;
		log();
		throw new Error(`the ${name} did not start`);
	};
	// Astro's own note of the server it started (.astro/dev.json, preview.json): is that process there?
	const there = () => {
		try {
			return world.alive(JSON.parse(world.read(join(project.site, ".astro", `${command}.json`))).pid);
		} catch {
			return false;
		}
	};
	start();
	for (let waited = 0, again = false; waited < seconds; waited += 0.5) {
		const answer = await world.ask(`${url}/`, { seconds });
		if (answer.status !== 0) return answer;
		if (!again && !there()) {
			again = true;
			world.say(`The ${name}'s server ended after it had started. Its log, and then it is started once more.`);
			log();
			start();
		}
		await world.sleep(0.5);
	}
	log();
	throw new Error(`The ${name} at ${url} was started and has not answered in ${seconds / 60} minutes.`);
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
		work: (ctx) => changingPackages(ctx, () => must(ctx, "pnpm", ["install"])),
	},
	// What `astro check` type-checks with. EmDash's templates do not all have it, and without it
	// astro asks "install it?", checks nothing and ends as if all were well: a check that passes
	// having looked at nothing. So it is put in, as astro would on a yes — said, and seen in git.
	"site:typescript": {
		needs: () => ["site:installed"],
		done: ({ world, project }) => world.exists(join(project.site, "node_modules", "typescript")),
		work: (ctx) => {
			ctx.world.say("this site has no typescript, which astro check needs — without it nothing is type-checked: adding it to the site's devDependencies");
			// (6: astro check says it does not work with TypeScript 7 yet — "install TypeScript 6 instead")
			return changingPackages(ctx, () => must(ctx, "pnpm", ["add", "--save-dev", "typescript@6"]));
		},
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
				const answer = await startedAndAnswering(ctx, "dev", project.dev, project.devPort, 120);
				if (answer.status >= 500) world.say(`The site at ${project.dev} answers ${answer.status}: ${answer.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)}`);
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
				await startedAndAnswering(ctx, "preview", project.built, project.builtPort, 180, { EMDASH_SITE_URL: `http://localhost:${project.builtPort}` });
			}),
	},
	// A task for the site on this machine only stands on this first. Asked with --live it stops here,
	// before any other state is reached: a flag goes to every state a task stands on, and
	// signin:token --live would have signed in to the deployed site.
	"site:local-only": {
		done: ({ flags }) => !flags.live,
		work: () => {
			throw new Error("This task acts on the site on this machine only, and it was asked for the deployed one (--live). Nothing was done.");
		},
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
				["the dev site running", world.ask(`${project.dev}/`, { seconds: 20 }).then((a) => a.status !== 0 && a.status < 500), "mise run site:start"],
				["built, from what is here now", !!(await site["site:built"].done?.(ctx)), "mise run site:preview"],
				["the built site running", answers(ctx, project.built), "mise run site:preview"],
				["this machine signed in to the built site", world.exists(tokens) && world.list(tokens).some((f) => f.startsWith(`localhost_${project.builtPort}_`)), "mise run signin:token"],
				...(project.live ? /** @type {[string, Promise<boolean>, string][]} */ ([["the deployed site answering", world.ask(project.live, { seconds: 15 }).then((a) => a.status !== 0), "mise run live:ship"]]) : []),
			];
			for (const [what, is, how] of states) world.say(`${(await is) ? "yes" : "no "}  ${what}${(await is) ? "" : `   — to get there: ${how}`}`);
			if (!project.live) world.say("     (no deployed site is named: LIVE_URL in the [env] block of mise.toml)");
			for (const line of await essentials(ctx)) world.say(line);
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
