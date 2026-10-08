// The live group: the tasks that act on a deployed site.   mise run test:live
//
// It puts a fresh starter site on a Worker kept for testing. Two settings, in this repo's gitignored
// mise.local.toml: TEST_LIVE_URL, its address, and TEST_LIVE_NAME, the Worker's name — its database
// is <name>, its bucket <name>-media. Without them (on CI, on a machine with no Cloudflare login)
// the group is not run, and its record keeps what it last showed.
import { mkdirSync, rmdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export default async (t) => {
	const live = process.env.TEST_LIVE_URL;
	const worker = process.env.TEST_LIVE_NAME;
	if (!live || !worker) {
		console.log("live: not run — no TEST_LIVE_URL / TEST_LIVE_NAME here. Its record keeps what it last showed.");
		return;
	}
	// The developer's real Cloudflare login and fnox, not the empty config folder.
	if (process.env.XDG_CONFIG_HOME) t.env.XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME;
	else delete t.env.XDG_CONFIG_HOME;
	// One at a time: two runs deploying to the same Worker would overwrite each other.
	const lock = join(homedir(), ".config", "emdash-run", "locks", `deployed-${worker}`);
	mkdirSync(dirname(lock), { recursive: true });
	try {
		mkdirSync(lock);
	} catch {
		if (Date.now() - statSync(lock).mtimeMs < 30 * 60_000) {
			console.log(`live: not run — another run is using the test Worker (${lock}). Its record keeps what it last showed.`);
			return;
		}
		console.log("(a lock older than 30 minutes was left behind: taking it)");
	}
	t.atEnd(() => rmdirSync(lock));

	const stamp = `shipped-${Date.now()}`;
	const administrator = async (o = {}) => t.saysAnyCase(await t.mise(o, "emdash", "whoami", "--live"), "admin");
	const preview = { env: { LIVE_PREVIEW: "test" } };
	let access = ""; // what signin:access printed the first time

	t.project("cloudflare:starter", `LIVE_URL = "${live}"`, 'ADMIN_EMAIL = "agent@emdash.local"');
	await t.need("site:ports", () => t.mise("site:ports"));

	// a site, with Cloudflare Access in front of its admin
	await t.ok("site:new", "makes the site that will be deployed", async () => {
		await t.mise("site:new");
		t.write("site/wrangler.jsonc", t.read("site/wrangler.jsonc").replaceAll('"my-emdash-site"', `"${worker}"`).replace('"my-emdash-media"', `"${worker}-media"`));
		await t.mise("site:start");
		await t.mise("site:stop");
	});
	await t.ok("signin:access", "Cloudflare Access is in front of the admin", async () => {
		access = (await t.attempt("signin:access")).out;
		t.says(access, "access: application");
	});
	await t.ok("signin:access", "uploaded media stays public; the team's domain is printed before any deploy", async () => {
		t.says(access, "uploaded media");
		t.check(/teamDomain: "[a-z0-9-]*.cloudflareaccess.com"/.test(access), "the team's domain in what it printed");
		t.write("access.txt", access);
		const r = await t.cmd(process.execPath, [join(t.repo, "tests", "live", "signin-access-lines.mjs"), "access.txt", "site"]);
		t.check(r.code === 0, "the printed lines to be written into the site's config");
	});
	await t.ok("emdash", "a site set to Cloudflare Access: the dev site starts and the CLI works on it", async () => {
		t.check(t.read("site/astro.config.mjs").includes("auth: access("), "auth: access( in astro.config.mjs");
		t.check(t.read("site/wrangler.jsonc").includes("CF_ACCESS_AUDIENCE"), "CF_ACCESS_AUDIENCE in wrangler.jsonc");
		await t.mise("site:start");
		t.says(await t.mise("emdash", "schema", "list"), "slug");
		await t.mise("site:stop");
	});

	// deploying
	await t.ok("live:ship", "deploys; the site answers with the change", async () => {
		t.write("site/src/pages/zz-shipped.astro", `<p>${stamp}</p>\n`);
		await t.mise("live:ship");
		await t.until(async () => (await t.body(`${live}/zz-shipped`)).includes(stamp));
	});
	await t.ok("signin:access", "run again: changes nothing", async () => {
		t.says(await t.mise("signin:access"), "already");
	});

	// the CLI on the deployed site
	await t.ok("signin:token", "--live: the CLI is an administrator of the deployed site", async () => {
		await t.mise("signin:token", "--live");
		await administrator();
	});
	await t.ok("signin:token", "--live, run again: still an administrator", async () => {
		await t.mise("signin:token", "--live");
		await administrator();
	});
	await t.ok("emdash", "--live reads and writes the deployed site", async () => {
		t.says(await t.mise("emdash", "schema", "list", "--live"), "slug");
		await t.mise("emdash", "content", "create", "pages", "--live", "--slug", `test-${Date.now()}`, "--data", JSON.stringify({ title: "Made by the test" }));
	});
	await t.ok("plugin:works", "--live: the deployed site is checked from outside; it says what it skips, and builds and restarts nothing", async () => {
		const { out } = await t.attempt("plugin:works", "--live");
		t.says(out, "skip builds");
		t.says(out, "skip starts");
		t.says(out, "ok   answers");
		t.check(!/^FAIL|\] FAIL/m.test(out), "no FAIL line");
	});
	await t.ok("model:sync", "--live records the deployed model", async () => {
		await t.mise("model:sync", "--live");
		t.check(t.exists("site/.emdash/schema.json"), "site/.emdash/schema.json");
	});
	await t.ok("content:pull", "downloads the deployed site as a package", async () => {
		await t.mise("content:pull");
		t.check(t.list("site/backups").some((f) => f.endsWith(".emdash")), "a package in site/backups");
	});
	await t.ok("live:backup", "the database bookmark and a package", async () => {
		t.says(await t.mise("live:backup"), "bookmark is");
	});

	// a preview
	await t.ok("live:preview", "a preview: an address of its own, the live site still answers", async () => {
		t.says((await t.attempt("live:preview", "test")).out, 'PREVIEW "test"');
		t.check(t.read("site/wrangler.jsonc").includes('"previews"'), "a previews block in wrangler.jsonc");
		t.check((await t.status(`${live}/`)) === 200, "200 from the live site");
		await t.until(async () => (await t.status(`${live.replace("://", "://test-")}/_emdash/admin`, { seconds: 120 })) === 302);
	});
	await t.ok("live:preview", "run again: the same preview, nothing new made", async () => {
		const { out } = await t.attempt("live:preview", "test");
		t.says(out, 'PREVIEW "test"');
		t.check(!/preview: made|wrote the/.test(out), "nothing made and nothing written");
	});
	await t.ok("signin:token", "LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database", async () => {
		t.says((await t.attempt(preview, "signin:token", "--live")).out, "its own database");
		await administrator(preview);
	});
	await t.ok("live:preview", "--delete removes it; again: nothing to delete", async () => {
		t.says(await t.mise("live:preview", "test", "--delete"), "is deleted");
		t.says(await t.mise("live:preview", "test", "--delete"), "nothing to delete");
	});

	// watching it, and who gets in
	await t.ok("live:logs", "shows a request to the deployed site", async () => {
		const log = t.forSeconds(22, "live:logs");
		await t.sleep(12);
		await t.status(`${live}/?from=test`);
		t.says(await log, "GET");
	});
	if (!t.ci) await t.ok("signin:open", "--live opens a signed-in window", async () => {
		t.says(await t.mise({ env: { SIGNIN_OPEN_SECONDS: "3" } }, "signin:open", "--live"), "open: signed in");
	});
	await t.ok("signin:access", "a visitor reaches uploaded media and plugins' public routes without signing in", async () => {
		t.check((await t.status(`${live}/_emdash/api/media/file/none.png`)) !== 302, "uploaded media not behind sign-in");
		t.check((await t.status(`${live}/_emdash/api/plugins/none/info`)) !== 302, "plugins' public routes not behind sign-in");
		t.check((await t.status(`${live}/_emdash/admin`)) === 302, "the admin behind sign-in");
	});

	// undoing
	await t.ok("live:undo", "puts the previous version back: the change is gone", async () => {
		await t.mise("live:undo");
		await t.until(async (i) => !(await t.body(`${live}/zz-shipped?t=${i}`)).includes(stamp));
	});
	await t.ok("site:delete", "removes the local site folder", async () => {
		await t.mise({ yes: true }, "site:delete");
		t.check(!t.exists("site"), "no site folder");
	});
};
