// Every other task, as nodes of the graph (graph.mjs). Most are EmDash's, Astro's and wrangler's own
// commands in the order they have to run; where there is no such command, the work is a function of
// one of the scripts beside this folder.
import { join } from "node:path";

import { main as emdashCli } from "../emdash.mjs";
import { main as livePreview } from "../live-preview.mjs";
import { main as liveUp } from "../live-ship.mjs";
import { main as pluginNew } from "../plugin-new.mjs";
import { main as pluginJob } from "../plugin.mjs";
import { main as signinAccess } from "../signin-access.mjs";
import { main as siteJob } from "../site.mjs";
import { Exit, task } from "./calls.mjs";

/** @typedef {import("./graph.mjs").Graph} Graph @typedef {import("./graph.mjs").Ctx} Ctx */

// The browser sign-in is loaded when a task needs it, not when the program starts: it needs
// Playwright, which is installed (tools:browser) only for the tasks that use a browser. Loaded at
// the top, no task at all could start in a project that had not installed it yet.
const signinBrowser = async (/** @type {string[]} */ argv) => (await import("../signin-browser.mjs")).main(argv);

const IMPORT_HOW = [
	"The package is in backups/. To load it into an EMPTY local site (mise run site:reset, then open /_emdash/api/setup/dev-bypass?content=0):",
	"  mise run emdash -- site import backups/FILE --analyze",
	"  mise run emdash -- site import backups/FILE --plan DIGEST --confirm",
];
const UPDATE_HOW = [
	"EmDash is updated in package.json and the lockfile, and the site type-checks and builds on it.",
	"  Read what changed:  https://github.com/emdash-cms/emdash/releases",
	"  Not updated: the files your site got from its template, and the agent skills the scaffolder wrote.",
	"  Next: mise run site:stop, mise run site:start - database migrations run on the first request. Then commit.",
];
const BACKUP_HOW = [
	"Two copies were taken. They are different things:",
	"  1. The Time Travel bookmark above: the whole database - users, tokens, plugin data. Cloudflare keeps 30 days. Restore: pnpm exec wrangler d1 time-travel restore DB --bookmark ID (destructive - stop writes first).",
	"  2. The package in backups/: content, model and media, no users. Loads into an EMPTY site: mise run emdash -- site import FILE --analyze.",
	"Neither holds: the media bucket itself, or EMDASH_ENCRYPTION_KEY - keep the key somewhere safe yourself.",
	"There is no SQL dump: wrangler d1 export refuses a database with search tables, which EmDash has.",
];
const PLUGIN_DETAILS = "A new plugin needs three settings in the [env] block of mise.toml: PLUGIN_PUBLISHER (your Atmosphere handle or DID - it must resolve), PLUGIN_AUTHOR (a name) and PLUGIN_SECURITY_EMAIL.";
const PLUGIN_CLI = ["dlx", "@emdash-cms/plugin-cli@latest"];
const FAVOURITES = "@netdollar.dev/forms@0.1.0 @nookeshk.bsky.social/seo-suite@0.2.0 @meekmedia.bsky.social/link-guardian@0.1.0 @peachfinthemes.com/instant-indexer@1.0.0 @agenticecom.net/media-alt-text-queue@0.2.1";

/** A command in the site's folder that must succeed. @param {Ctx} ctx @param {string} program @param {string[]} args */
const must = ({ world, project }, program, args) => {
	const code = world.run(program, args, project.site);
	if (code !== 0) throw new Exit(code);
};
/** @param {Ctx} ctx @param {...string} args */
const pnpm = (ctx, ...args) => must(ctx, "pnpm", args);
/** One of the site's own tools (astro, emdash, wrangler), run directly. @param {Ctx} ctx @param {string} name @param {...string} args */
const tool = ({ world, project }, name, ...args) => {
	const code = world.tool(name, args, project.site);
	if (code !== 0) throw new Exit(code);
};
/** One of the scripts' jobs, to its end: one that ends by saying "done, nothing wrong" goes on. @param {(argv: string[]) => Promise<unknown>} job @param {string[]} argv */
const job = async (job, argv) => {
	try {
		await job(argv);
	} catch (e) {
		if (!(e instanceof Exit) || e.code !== 0) throw e;
	}
};
/** The site a task that takes --live acts on. @param {Ctx} ctx */
const address = ({ project, flags }) => (flags.live ? project.live || "LIVE_URL-is-not-set" : `http://localhost:${project.builtPort}`);
const devAddress = (/** @type {Ctx} */ { project }) => `http://localhost:${project.devPort}`;
/** What the plugin jobs are given: the site, and whether it is the deployed one. @param {Ctx} ctx @param {string} what @param {string[]} [before] */
const pluginArgs = (ctx, what, before = []) => [what, ...before, address(ctx), ctx.project.site, ...(ctx.flags.live ? ["--deployed"] : []), ...ctx.args];
// What a task on registry plugins stands on: on this machine, the site able to run sandboxed
// plugins, built, running, and this machine signed in to it; with --live, the deployed site answering.
const pluginNeeds = (/** @type {import("./graph.mjs").Flags} */ flags) => (flags.live ? ["live:answers"] : ["plugin:sandbox", "signin:token"]);
const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);
/** The deployed site as one EmDash package, in the site's backups/ folder. @param {Ctx} ctx */
const pack = async (ctx) => {
	ctx.world.mkdir(join(ctx.project.site, "backups"));
	await job(emdashCli, [ctx.project.live, ctx.project.site, "site", "export", "--url", ctx.project.live, "--output", `backups/live-${stamp().replace(/[- :]/g, "").replace(/^(\d{8})/, "$1-")}.emdash`]);
};
/** The local database and uploads, and the token saved for them. @param {Ctx} ctx */
const forget = async (ctx) => {
	for (const p of [".wrangler/state", "data.db", "data.db-wal", "data.db-shm", "uploads"]) ctx.world.remove(join(ctx.project.site, p));
	await job(siteJob, ["forget", ctx.project.site]);
};

/** @type {Graph} */
export const tasks = {
	// ─── a site ──────────────────────────────────────────────────────────────────────────────────
	"site:own-folder": {
		work: ({ project }) => {
			if (!/^[^./:\\ ]+$/.test(project.siteName)) throw new Error(`This needs the site in a plainly named folder of its own. SITE_FOLDER is [${project.siteName}]: nothing was made or deleted.`);
		},
	},
	"site:new": {
		needs: () => ["site:own-folder"],
		work: (ctx) => {
			const { world, project, args, env } = ctx;
			if (world.exists(join(project.site, "package.json"))) return world.say(`There is already a site in [${project.siteName}]: left as it is.`);
			const code = world.run("pnpm", ["dlx", "create-emdash@latest", project.siteName, "--template", args[0] || env.TEMPLATE || "cloudflare:blog", "--pm", "pnpm", "--install", "--yes"], project.root);
			if (code !== 0) throw new Exit(code);
		},
	},
	"site:ports": { work: (ctx) => job(siteJob, ["ports", ctx.project.root]) },
	"site:logs": { needs: () => ["site:exists"], work: (ctx) => tool(ctx, "astro", "dev", "logs", "--follow") },
	"site:check": {
		needs: () => ["site:installed"],
		work: async (ctx) => {
			if (ctx.env.SITE_SEED !== "none") tool(ctx, "emdash", "seed", "--validate");
			tool(ctx, "astro", "check");
			await task("site:built");
		},
	},
	"site:reset": {
		needs: () => ["site:exists"],
		work: async (ctx) => {
			await task("site:stop");
			await forget(ctx);
			await task("site:start");
		},
	},
	"site:delete": { needs: () => ["site:own-folder"], work: (ctx) => job(siteJob, ["delete", ctx.project.site]) },
	"site:forget": { needs: () => ["site:exists"], work: forget },
	"site:admin": {
		needs: () => ["site:exists"],
		work: async (ctx) => {
			await task("site:stop");
			await forget(ctx);
			await task("site:preview");
			await task("tools:browser");
			await job(signinBrowser, [`http://localhost:${ctx.project.builtPort}`, ctx.project.site]);
		},
	},
	// Playwright, the one package the browser sign-in needs, installed beside the scripts — in mise's
	// copy of emdash-run, not in the project
	"tools:browser": {
		work: ({ world, project }) => {
			const code = world.run("pnpm", ["--dir", project.scripts, "install", "--silent"], project.root);
			if (code !== 0) throw new Exit(code);
		},
	},

	// ─── EmDash itself ───────────────────────────────────────────────────────────────────────────
	emdash: { needs: () => ["site:exists"], work: (ctx) => job(emdashCli, [devAddress(ctx), ctx.project.site, ...ctx.argv]) },
	"emdash:update": {
		needs: () => ["site:exists"],
		work: async (ctx) => {
			pnpm(ctx, "up", "--latest", "emdash", "@emdash-cms/cloudflare");
			tool(ctx, "astro", "check");
			await task("site:built");
			for (const line of UPDATE_HOW) console.log(line);
		},
	},
	"model:sync": {
		needs: () => ["site:exists"],
		work: async (ctx) => {
			await job(emdashCli, [devAddress(ctx), ctx.project.site, "types", "--url", ctx.flags.live ? ctx.project.live : devAddress(ctx)]);
			ctx.world.run("git", ["status", "--short", "--", ".emdash"], ctx.project.site);
			ctx.world.run("git", ["--no-pager", "diff", "--stat", "--", ".emdash"], ctx.project.site);
		},
	},
	"content:pull": {
		needs: () => ["live:set", "site:exists"],
		work: async (ctx) => {
			await pack(ctx);
			for (const line of IMPORT_HOW) console.log(line);
		},
	},

	// ─── plugins ─────────────────────────────────────────────────────────────────────────────────
	"plugin:details": {
		work: ({ env }) => {
			if (!env.PLUGIN_PUBLISHER || !env.PLUGIN_AUTHOR || !env.PLUGIN_SECURITY_EMAIL) throw new Error(PLUGIN_DETAILS);
		},
	},
	"plugin:new": {
		needs: () => ["site:exists", "plugin:details"],
		work: async (ctx) => {
			const [name] = ctx.args;
			const { env, project } = ctx;
			await task("site:stop");
			await job(pluginNew, [project.site, name, env.PLUGIN_PUBLISHER ?? "", env.PLUGIN_AUTHOR ?? "", env.PLUGIN_SECURITY_EMAIL ?? ""]);
			for (const script of [["install"], ["run", "test"], ["run", "build"]]) pnpm(ctx, "--dir", `plugins/${name}`, ...script);
			pnpm(ctx, "add", `file:./plugins/${name}`);
			await job(pluginJob, ["config", project.site, name]);
		},
	},
	"plugin:check": {
		needs: () => ["site:exists"],
		work: (ctx) => {
			for (const script of [["install"], ["run", "validate"], ["run", "typecheck"], ["run", "test"], ["run", "build"], ["exec", "emdash-plugin", "bundle", "--validate-only"]]) pnpm(ctx, "--dir", `plugins/${ctx.args[0]}`, ...script);
		},
	},
	"plugin:add": {
		needs: () => ["site:exists"],
		work: async (ctx) => {
			await task("site:stop");
			pnpm(ctx, "add", ctx.args[0]);
			await job(pluginJob, ["config", ctx.project.site, ctx.args[0]]);
		},
	},
	"plugin:publish": {
		needs: () => ["site:exists"],
		work: (ctx) => {
			for (const script of [["run", "validate"], ["run", "test"], ["exec", "emdash-plugin", "bundle", "--validate-only"], ["exec", "emdash-plugin", "publish"]]) pnpm(ctx, "--dir", `plugins/${ctx.args[0]}`, ...script);
		},
	},
	"plugin:search": { needs: () => ["site:exists"], work: (ctx) => pnpm(ctx, ...PLUGIN_CLI, "search", ...ctx.args) },
	plugin: { needs: () => ["site:exists"], work: (ctx) => pnpm(ctx, ...PLUGIN_CLI, ...ctx.argv) },
	"plugin:sandbox": { needs: () => ["site:exists"], work: (ctx) => job(pluginJob, ["sandbox", ctx.project.site]) },
	"plugin:install": { needs: pluginNeeds, work: (ctx) => job(pluginJob, pluginArgs(ctx, "install", ctx.flags.yes ? ["--yes"] : [])) },
	"plugin:update": { needs: pluginNeeds, work: (ctx) => job(pluginJob, pluginArgs(ctx, "update", ctx.flags.yes ? ["--yes"] : [])) },
	"plugin:remove": { needs: pluginNeeds, work: (ctx) => job(pluginJob, pluginArgs(ctx, "remove")) },
	"plugin:favourites": {
		needs: pluginNeeds,
		work: (ctx) => job(pluginJob, pluginArgs({ ...ctx, args: (ctx.env.PLUGINS || FAVOURITES).split(/\s+/).filter(Boolean) }, "install", ctx.flags.yes ? ["--yes"] : [])),
	},
	"plugin:works": { needs: () => ["site:exists", "tools:browser"], work: (ctx) => job(pluginJob, pluginArgs(ctx, "works", ctx.flags.fresh ? ["--fresh"] : [])) },

	// ─── signing in ──────────────────────────────────────────────────────────────────────────────
	"signin:access": { needs: () => ["live:set", "site:exists"], work: (ctx) => job(signinAccess, [ctx.project.live, ctx.project.site]) },
	"signin:passkey": { needs: () => ["site:exists", "tools:browser"], work: (ctx) => job(signinBrowser, [address(ctx), ctx.project.site, ...(ctx.flags.live ? ["--deployed"] : [])]) },
	"signin:open": { needs: () => ["site:exists", "tools:browser"], work: (ctx) => job(signinBrowser, [address(ctx), ctx.project.site, "--show", ...(ctx.flags.live ? ["--deployed"] : [])]) },

	// A page of the admin, opened in a browser and looked at: what plugin:works asks for each of a
	// plugin's pages. Given what the browser sign-in takes, untouched.
	"browser:check": { work: (ctx) => job(signinBrowser, ctx.argv) },

	// ─── the deployed site ───────────────────────────────────────────────────────────────────────
	"live:set": {
		work: ({ world, project }) => {
			if (!project.live) throw new Error("This needs the address of the deployed site. Set LIVE_URL in the [env] block of mise.toml.");
			world.say(`-> DEPLOYED site: ${project.live}`);
		},
	},
	"live:check": {
		work: async (ctx) => {
			await task("site:check");
			tool(ctx, "wrangler", "deploy", "--dry-run");
		},
	},
	"live:ship": {
		needs: () => ["live:set"],
		work: async (ctx) => {
			tool(ctx, "wrangler", "whoami");
			await task("live:check");
			tool(ctx, "wrangler", "deploy", "--strict", "--secrets-file", ".env", "--message", `live:ship ${stamp()} UTC`);
			tool(ctx, "wrangler", "deployments", "status");
			await job(liveUp, [ctx.project.live]);
		},
	},
	"live:preview": {
		needs: () => ["site:exists"],
		work: async (ctx) => {
			tool(ctx, "wrangler", "whoami");
			if (ctx.flags.delete) ctx.world.say("-> deleting a preview: nothing is built");
			else await task("live:check");
			await job(livePreview, [ctx.project.site, ...ctx.args.slice(0, 1), ...(ctx.flags.delete ? ["--delete"] : [])]);
		},
	},
	"live:undo": {
		needs: () => ["live:set", "site:exists"],
		work: async (ctx) => {
			tool(ctx, "wrangler", "whoami");
			tool(ctx, "wrangler", "rollback", ...ctx.args.slice(0, 1), "--yes", "--message", "live:undo");
			tool(ctx, "wrangler", "deployments", "status");
			await job(liveUp, [ctx.project.live]);
		},
	},
	"live:logs": { needs: () => ["site:exists"], work: (ctx) => tool(ctx, "wrangler", "tail", "--format", "pretty") },
	"live:backup": {
		needs: () => ["live:set", "site:exists"],
		work: async (ctx) => {
			tool(ctx, "wrangler", "whoami");
			tool(ctx, "wrangler", "d1", "time-travel", "info", "DB");
			await pack(ctx);
			for (const line of BACKUP_HOW) console.log(line);
		},
	},
};
