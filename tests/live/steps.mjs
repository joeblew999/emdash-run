// The live group: the tasks that act on a deployed site.   mise run dev:test live
//
// It puts a fresh starter site on a Worker kept for testing. Two settings, in this repo's gitignored
// mise.local.toml: TEST_LIVE_URL, its address, and TEST_LIVE_NAME, the Worker's name — its database
// is <name>, its bucket <name>-media. Without them (on CI, on a machine with no Cloudflare login)
// the group is not run.
import { mkdirSync, rmdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { attempt, body, check, ci, cmd, env, exists, forSeconds, list, mise, ports, project, read, repo, says, saysAnyCase, sleep, status, until, write } from "../lib/site.mjs";
import { registryClean, registrySteps } from "../both/registry.mjs";
import { tokenSteps } from "../both/token.mjs";
import { setup, step } from "../lib/step.mjs";

const live = process.env.TEST_LIVE_URL;
const worker = process.env.TEST_LIVE_NAME;
if (!live || !worker) {
	console.log("live: not run — no TEST_LIVE_URL / TEST_LIVE_NAME here.");
	process.exit(0);
}
// The developer's real Cloudflare login and fnox, not the empty config folder.
if (process.env.XDG_CONFIG_HOME) env.XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME;
else delete env.XDG_CONFIG_HOME;
// One at a time: two runs deploying to the same Worker would overwrite each other.
const lock = join(homedir(), ".config", "emdash-run", "locks", `deployed-${worker}`);
mkdirSync(dirname(lock), { recursive: true });
try {
	mkdirSync(lock);
} catch {
	if (Date.now() - statSync(lock).mtimeMs < 30 * 60_000) {
		console.log(`live: not run — another run is using the test Worker (${lock}).`);
		process.exit(0);
	}
	console.log("(a lock older than 30 minutes was left behind: taking it)");
}
process.on("exit", () => {
	try { rmdirSync(lock); } catch {}
});

const stamp = `shipped-${Date.now()}`;
const administrator = async (/** @type {{ env?: Record<string, string> }} */ o = {}) => saysAnyCase(await mise(o, "emdash", "whoami", "--live"), "admin");
const preview = { env: { LIVE_PREVIEW: "test" } };
let access = ""; // what signin:access printed the first time

setup(async () => {
	project("cloudflare:starter", `LIVE_URL = "${live}"`, 'ADMIN_EMAIL = "agent@emdash.local"');
	await mise("site:ports");
});

// a site, with Cloudflare Access in front of its admin
step("site:new", "makes the site that will be deployed", async () => {
	await mise("site:new");
	write("site/wrangler.jsonc", read("site/wrangler.jsonc").replaceAll('"my-emdash-site"', `"${worker}"`).replace('"my-emdash-media"', `"${worker}-media"`));
	await mise("site:start");
	await mise("site:stop");
});
step("signin:access", "Cloudflare Access is in front of the admin", async () => {
	access = (await attempt("signin:access")).out;
	says(access, "access: application");
});
step("signin:access", "uploaded media stays public; the team's domain is printed before any deploy", async () => {
	says(access, "uploaded media");
	check(/teamDomain: "[a-z0-9-]*.cloudflareaccess.com"/.test(access), "the team's domain in what it printed");
	write("access.txt", access);
	const r = await cmd(process.execPath, [join(repo, "tests", "live", "signin-access-lines.mjs"), "access.txt", "site"]);
	check(r.code === 0, "the printed lines to be written into the site's config");
});
step("emdash", "a site set to Cloudflare Access: the dev site starts and the CLI works on it", async () => {
	check(read("site/astro.config.mjs").includes("auth: access("), "auth: access( in astro.config.mjs");
	check(read("site/wrangler.jsonc").includes("CF_ACCESS_AUDIENCE"), "CF_ACCESS_AUDIENCE in wrangler.jsonc");
	await mise("site:start");
	says(await mise("emdash", "schema", "list"), "slug");
	await mise("site:stop");
});

// deploying — with the plugin sandbox set up, so that the deployed site can run registry plugins
step("plugin:sandbox", "the site that will be deployed can run sandboxed plugins", async () => {
	await mise("plugin:sandbox");
	check(read("site/astro.config.mjs").includes("sandboxRunner"), "sandboxRunner in astro.config.mjs");
	check(read("site/wrangler.jsonc").includes("worker_loaders"), "worker_loaders in wrangler.jsonc");
});
step("live:ship", "deploys; the site answers with the change", async () => {
	write("site/src/pages/zz-shipped.astro", `<p>${stamp}</p>\n`);
	await mise("live:ship");
	await until(async () => (await body(`${live}/zz-shipped`)).includes(stamp));
});
step("signin:access", "run again: changes nothing", async () => {
	says(await mise("signin:access"), "already");
});

// the CLI on the deployed site: the same steps the signin group runs on this machine
tokenSteps({ live: true });

// plugins on the deployed site: the same steps the plugin group runs on this machine
step("plugin:install", "the deployed site: what a run stopped half way left installed is taken out first", () => registryClean({ live: true }).then(() => {}));
registrySteps({ live: true });
step("plugin:works", "--live: the deployed site is checked from outside; it says what it skips, and builds and restarts nothing", async () => {
	const { out } = await attempt("plugin:works", "--live");
	says(out, "skip builds");
	says(out, "skip starts");
	says(out, "ok   answers");
	check(!/^FAIL|\] FAIL/m.test(out), "no FAIL line");
});
step("model:sync", "--live records the deployed model", async () => {
	await mise("model:sync", "--live");
	check(exists("site/.emdash/schema.json"), "site/.emdash/schema.json");
});
step("content:pull", "downloads the deployed site as a package", async () => {
	await mise("content:pull");
	check(list("site/backups").some((f) => f.endsWith(".emdash")), "a package in site/backups");
});
step("live:backup", "the database bookmark and a package", async () => {
	says(await mise("live:backup"), "bookmark is");
});

// a preview
step("live:preview", "a preview: an address of its own, the live site still answers", async () => {
	says((await attempt("live:preview", "test")).out, 'PREVIEW "test"');
	check(read("site/wrangler.jsonc").includes('"previews"'), "a previews block in wrangler.jsonc");
	check((await status(`${live}/`)) === 200, "200 from the live site");
	await until(async () => (await status(`${live.replace("://", "://test-")}/_emdash/admin`, { seconds: 120 })) === 302);
});
step("live:preview", "run again: the same preview, nothing new made", async () => {
	const { out } = await attempt("live:preview", "test");
	says(out, 'PREVIEW "test"');
	check(!/preview: made|wrote the/.test(out), "nothing made and nothing written");
});
step("signin:token", "LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database", async () => {
	says((await attempt(preview, "signin:token", "--live")).out, "its own database");
	await administrator(preview);
});
step("live:preview", "--delete removes it; again: nothing to delete", async () => {
	says(await mise("live:preview", "test", "--delete"), "is deleted");
	says(await mise("live:preview", "test", "--delete"), "nothing to delete");
});

// watching it, and who gets in
step("live:logs", "shows a request to the deployed site", async () => {
	const log = forSeconds(22, "live:logs");
	await sleep(8);
	// Asked a few times, each at an address of its own: the log follows some seconds behind, and a
	// page that a cache answers never reaches the Worker, so is never in its log.
	for (let i = 0; i < 5; i++) {
		await status(`${live}/?from=${stamp}-${i}`);
		await sleep(2);
	}
	says(await log, "GET");
});
if (!ci) step("signin:open", "--live opens a signed-in window", async () => {
	says(await mise({ env: { SIGNIN_OPEN_SECONDS: "3" } }, "signin:open", "--live"), "open: signed in");
});
step("signin:access", "a visitor reaches uploaded media and plugins' public routes without signing in", async () => {
	check((await status(`${live}/_emdash/api/media/file/none.png`)) !== 302, "uploaded media not behind sign-in");
	check((await status(`${live}/_emdash/api/plugins/none/info`)) !== 302, "plugins' public routes not behind sign-in");
	check((await status(`${live}/_emdash/admin`)) === 302, "the admin behind sign-in");
});

// undoing
step("live:undo", "puts the previous version back: the change is gone", async () => {
	await mise("live:undo");
	await until(async (i) => !(await body(`${live}/zz-shipped?t=${i}`)).includes(stamp));
});
step("site:delete", "removes the local site folder", async () => {
	await mise({ yes: true }, "site:delete");
	check(!exists("site"), "no site folder");
});
