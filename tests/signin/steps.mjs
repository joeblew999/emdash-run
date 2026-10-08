// The signin group: the CLI, an agent and a browser window as an administrator of the built site.
//   mise run dev:test signin
// (Signing in to a deployed site, and Cloudflare Access, are in the live group.)
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { aSite, attempt, check, ci, cmd, env, list, mise, says, saysAnyCase } from "../lib/site.mjs";
import { long, setup, step } from "../lib/step.mjs";

setup(aSite);

const administrator = async () => saysAnyCase(await mise("emdash", "whoami", "--preview"), "admin");
const answers = async () => says(await mise("emdash", "schema", "list", "--preview"), "slug");
const open = { env: { SIGNIN_OPEN_SECONDS: "3" } };
const savedTokens = () => {
	const dir = join(env.XDG_CONFIG_HOME, "emdash-run", "tokens");
	return existsSync(dir) ? readdirSync(dir) : [];
};

// a token
step("signin:token", "builds and starts the site; the CLI is an administrator of it", async () => {
	await mise("signin:token");
	await administrator();
});
step("signin:token", "run again: still an administrator", async () => {
	await mise("signin:token");
	await administrator();
});
step("emdash", "--preview writes to the built site", () =>
	mise("emdash", "content", "create", "pages", "--preview", "--slug", "built", "--data", JSON.stringify({ title: "On the built site" })));

long(() => {
	step("signin:token", "starts the built site when it is stopped", async () => {
		await mise("site:stop");
		await mise("signin:token");
		await answers();
	});
	// a window needs a screen: not on a CI runner
	if (!ci) step("signin:open", "opens a signed-in window (token)", async () => {
		says(await mise(open, "signin:open"), "open: signed in");
	});

	// a passkey, on a fresh database
	step("signin:passkey", "completes the EmDash wizard on a fresh database", async () => {
		await attempt("site:stop");
		await attempt("step:forget");
		await cmd("pnpm", ["exec", "emdash", "logout"], { cwd: "site" });
		await mise("signin:passkey");
		await answers();
	});
	if (!ci) step("signin:open", "opens a signed-in window (passkey)", async () => {
		says(await mise(open, "signin:open"), "open: signed in");
	});
	step("signin:token", "the saved token goes when the local database does", async () => {
		await mise("signin:token");
		check(savedTokens().length > 0, "a saved token");
		await mise("site:stop");
		await mise("step:forget");
		check(savedTokens().length === 0, "no saved token");
	});

	// all of it in one go
	step("site:admin", "a fresh built site, signed in, in one go", async () => {
		await mise({ yes: true }, "site:admin");
		await answers();
	});
});
