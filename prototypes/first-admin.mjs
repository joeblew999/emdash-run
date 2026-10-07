// PROTOTYPE — docs/plans/2026-10-07-sign-in.md. Not a task yet, not loaded by tasks.toml.
//
// Makes the first administrator of an EmDash site that is NOT in development mode, and signs
// EmDash's CLI in to it, with no person: a browser driven by Playwright, with Chrome's built-in
// simulated passkey device standing in for Touch ID.
//
//   node first-admin.mjs <site address> <site folder>
//
// It refuses any address that is not this machine. Pointed at a deployed site it would create an
// account there; that is a decision for the site's owner, and it is not what this prototype is for.
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const [url, siteDir] = process.argv.slice(2);
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !host.endsWith(".localhost")) {
	console.error(`Refusing: ${host} is not this machine.`);
	process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext()).newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send("WebAuthn.enable");
await cdp.send("WebAuthn.addVirtualAuthenticator", {
	options: {
		protocol: "ctap2",
		transport: "internal",
		hasResidentKey: true,
		hasUserVerification: true,
		isUserVerified: true,
		automaticPresenceSimulation: true,
	},
});

// 1. EmDash's setup wizard: site, account, passkey.
await page.goto(`${url}/_emdash/admin/setup`);
await page.getByRole("heading", { name: "Set up your site" }).waitFor({ timeout: 120_000 });
await page.getByRole("radio", { name: /Empty site/ }).check({ force: true });
await page.getByRole("button", { name: /Continue/ }).click();
await page.getByLabel("Your Email").waitFor({ timeout: 120_000 });
await page.getByLabel("Your Email").fill("agent@emdash.local");
await page.getByLabel("Your Name").fill("Local Test Admin");
await page.getByRole("button", { name: /Continue/ }).click();
await page.getByRole("button", { name: "Create passkey" }).click();
await page.getByText("Passkey created").waitFor({ timeout: 60_000 });
console.log("setup: first administrator created");

// 2. EmDash's own CLI sign-in: it prints a code, this browser approves it.
const login = spawn("pnpm", ["exec", "emdash", "login", "--url", url], {
	cwd: siteDir,
	env: { ...process.env, BROWSER: "true" },
});
let out = "";
login.stdout.on("data", (d) => (out += d));
login.stderr.on("data", (d) => (out += d));
const code = await new Promise((resolve, reject) => {
	const t = setInterval(() => {
		const m = out.match(/Enter code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/);
		if (m) (clearInterval(t), resolve(m[1]));
	}, 250);
	setTimeout(() => (clearInterval(t), reject(new Error(`no code from emdash login:\n${out}`))), 60_000);
});
await page.goto(`${url}/_emdash/admin/device`);
const signIn = page.getByRole("button", { name: "Sign in with Passkey" });
const codeBox = page.getByPlaceholder("XXXX-XXXX");
await signIn.or(codeBox).first().waitFor({ timeout: 60_000 });
if (await signIn.isVisible()) await signIn.click();
await codeBox.fill(code);
await page.getByRole("button", { name: "Authorise" }).click();
await page.getByText("Device authorised").waitFor({ timeout: 60_000 });
const exit = await new Promise((r) => login.on("exit", r));
await browser.close();
console.log(exit === 0 ? "cli: signed in" : `cli: emdash login exited ${exit}\n${out}`);
process.exit(exit ?? 1);
