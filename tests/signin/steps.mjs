// The signin group: the CLI, an agent and a browser window as an administrator of the built site.
//   mise run dev:test signin
// (Signing in to a deployed site, and Cloudflare Access, are in the live group.)
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { tokenSteps } from "../both/token.mjs";
import { aSite, attempt, check, ci, cmd, env, mise, says } from "../lib/site.mjs";
import { long, setup, step } from "../lib/step.mjs";

setup(aSite);

const answers = async () => says(await mise("emdash", "schema", "list", "--preview"), "slug");
const open = { env: { SIGNIN_OPEN_SECONDS: "3" } };
const savedTokens = () => {
	const dir = join(env.XDG_CONFIG_HOME ?? "", "emdash-run", "tokens");
	return existsSync(dir) ? readdirSync(dir) : [];
};

// a token: the same steps the live group runs on the deployed site
tokenSteps({ live: false });

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
		await attempt("site:forget");
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
		await mise("site:forget");
		check(savedTokens().length === 0, "no saved token");
	});

	// all of it in one go
	step("site:admin", "a fresh built site, signed in, in one go", async () => {
		await mise({ yes: true }, "site:admin");
		await answers();
	});
});
