// start — "I want to work on this site". From an empty folder or a fresh clone to a running,
// signed-in site, using EmDash's own tools at every step.
import { emdash, existsSync, join, mkdirSync, ok, root, run, runDir, setUp, site, siteDir, startServer, step, url, writeFileSync } from "./lib.mjs";

const version = process.env.EMDASH_VERSION ?? "latest";
// `cloudflare:blog`, as create-emdash spells it. The older `blog-cloudflare` and bare `blog` still work.
const named = process.env.TEMPLATE ?? "cloudflare:blog";
const template = named.includes(":") ? named : named.endsWith("-cloudflare") ? `cloudflare:${named.replace("-cloudflare", "")}` : `node:${named}`;

if (!existsSync(join(site, "package.json"))) {
	step(`no ${siteDir}/ yet — create-emdash makes it (${template}, EmDash ${version})`);
	run("pnpm", ["dlx", `create-emdash@${version}`, siteDir, "--template", template, "--pm", "pnpm", "--no-install", "--yes"], { cwd: root });
	ok(`${siteDir}/ is yours now — it is never overwritten`);
}
if (!existsSync(join(site, "node_modules", "emdash", "package.json"))) {
	step("install");
	run("pnpm", ["install"]);
}
if (existsSync(join(site, "seed", "seed.json"))) {
	step("the seed is one EmDash will accept");
	emdash(["seed", "seed/seed.json", "--validate"]);
}
step("the site");
const started = await startServer();
const token = await setUp();
ok(started ? "started, set up and signed in" : "already running — left alone");
mkdirSync(runDir, { recursive: true });
writeFileSync(join(runDir, "token-admin.txt"), `${token}\n`);
writeFileSync(join(runDir, "token-admin.env"), `EMDASH_MCP_TOKEN=${token}\n`);

console.log(`
  site    ${url}
  admin   ${url}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
  log     run/site.log

  next:   mise run check        is my work sound?
          mise run emdash -- content list posts
`);
