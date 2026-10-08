// The signin group: the CLI, an agent and a browser window as an administrator of the built site.
//   mise run test:signin
// (Signing in to a deployed site, and Cloudflare Access, are in the live group.)
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export default async (t) => {
	await t.aSite();
	const administrator = async () => t.saysAnyCase(await t.mise("emdash", "whoami", "--preview"), "admin");
	const answers = async () => t.says(await t.mise("emdash", "schema", "list", "--preview"), "slug");
	const open = { env: { SIGNIN_OPEN_SECONDS: "3" } };
	const savedTokens = () => {
		const dir = join(t.env.XDG_CONFIG_HOME, "emdash-run", "tokens");
		return existsSync(dir) ? readdirSync(dir) : [];
	};

	// a token
	await t.ok("signin:token", "builds and starts the site; the CLI is an administrator of it", async () => {
		await t.mise("signin:token");
		await administrator();
	});
	await t.ok("signin:token", "run again: still an administrator", async () => {
		await t.mise("signin:token");
		await administrator();
	});
	await t.ok("emdash", "--preview writes to the built site", () =>
		t.mise("emdash", "content", "create", "pages", "--preview", "--slug", "built", "--data", JSON.stringify({ title: "On the built site" })));

	await t.long(async () => {
		await t.ok("signin:token", "starts the built site when it is stopped", async () => {
			await t.mise("site:stop");
			await t.mise("signin:token");
			await answers();
		});
		// a window needs a screen: not on a CI runner
		if (!t.ci) await t.ok("signin:open", "opens a signed-in window (token)", async () => {
			t.says(await t.mise(open, "signin:open"), "open: signed in");
		});

		// a passkey, on a fresh database
		await t.ok("signin:passkey", "completes the EmDash wizard on a fresh database", async () => {
			await t.attempt("site:stop");
			await t.attempt("step:forget");
			await t.cmd("pnpm", ["exec", "emdash", "logout"], { cwd: "site" });
			await t.mise("signin:passkey");
			await answers();
		});
		if (!t.ci) await t.ok("signin:open", "opens a signed-in window (passkey)", async () => {
			t.says(await t.mise(open, "signin:open"), "open: signed in");
		});
		await t.ok("signin:token", "the saved token goes when the local database does", async () => {
			await t.mise("signin:token");
			t.check(savedTokens().length > 0, "a saved token");
			await t.mise("site:stop");
			await t.mise("step:forget");
			t.check(savedTokens().length === 0, "no saved token");
		});

		// all of it in one go
		await t.ok("site:admin", "a fresh built site, signed in, in one go", async () => {
			await t.mise({ yes: true }, "site:admin");
			await answers();
		});
	});
};
