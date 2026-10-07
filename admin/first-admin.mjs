// What `mise run site:admin` and `mise run live:admin` run — the one script in this repo, for a gap
// that is written down in docs/plans/done/2026-10-07-sign-in.md: EmDash has no command that sets a site
// up, or signs its CLI in, without a person at a browser.
//
// It makes sure an EmDash site that is NOT in development mode has an administrator and that
// EmDash's CLI is signed in to it — with no person. Playwright drives EmDash's own pages, and
// Chrome's built-in simulated passkey device stands in for Touch ID.
//
//   node first-admin.mjs <site address> <site folder> [--deployed] [--show]
//
// Tasks: signin:passkey, signin:open (--show); each with --live adds --deployed.
//
// - A site that has not been set up: it completes the setup wizard (ADMIN_EMAIL, ADMIN_NAME,
//   an empty site), then approves `emdash login`.
// - A site it set up before: it signs in with the passkey it saved, then approves `emdash login`.
// - A site somebody else set up: it stops. It has no way in, and should not.
// - With --show: a browser window you can see, signed in to the admin with the saved passkey, for
//   a person to use. It stays until the window is closed. The CLI is left as it is.
//
// The passkey is saved in ~/.config/emdash-run/passkeys/<host>.json, readable by this user only.
// Whoever holds that file is the site's administrator: it is a secret, and it is never printed.
//
// Without --deployed it refuses any address that is not this machine. With it, it creates an
// administrator on a site on the internet: the signin: tasks pass it for --live.
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const deployed = args.includes("--deployed");
const show = args.includes("--show");
const [url, siteDir] = args.filter((a) => !a.startsWith("--"));
if (!url || !siteDir) {
	console.error("usage: node first-admin.mjs <site address> <site folder> [--deployed]");
	process.exit(1);
}
if (!URL.canParse(url)) {
	console.error("This needs the address of the deployed site. Set LIVE_URL in the [env] block of mise.toml.");
	process.exit(1);
}
const { hostname, host, origin } = new URL(url);
const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname) || hostname.endsWith(".localhost");
if (!local && !deployed) {
	console.error(`Refusing: ${hostname} is not this machine. For a deployed site: mise run signin:passkey -- --live`);
	process.exit(1);
}
const email = process.env.ADMIN_EMAIL || (local ? "agent@emdash.local" : "");
const name = process.env.ADMIN_NAME || "Site Admin";
if (!email) {
	console.error("A deployed site's administrator needs an address: set ADMIN_EMAIL in the [env] block of mise.toml.");
	process.exit(1);
}
const keyFile = join(
	process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
	"emdash-run",
	"passkeys",
	`${host.replace(/[^a-zA-Z0-9.-]/g, "_")}.json`,
);
const here = dirname(fileURLToPath(import.meta.url));

// The Chrome or Edge already installed: nothing is downloaded.
let browser;
for (const channel of ["chrome", "msedge"]) {
	try {
		browser = await chromium.launch({ channel, headless: !show });
		break;
	} catch {}
}
if (!browser) {
	console.error("This needs Google Chrome or Microsoft Edge installed; neither was found.");
	process.exit(1);
}
// English, whatever the machine's language: the pages are found by their words.
const page = await (await browser.newContext({ locale: "en-GB", viewport: show ? null : undefined })).newPage();
let login;
let out = "";
let exit = 1;
try {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("WebAuthn.enable");
	const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
		options: {
			protocol: "ctap2",
			transport: "internal",
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true,
		},
	});

	// The passkey with its use count as it stands now — saved after every use.
	const savePasskey = async () => {
		const { credentials } = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
		mkdirSync(dirname(keyFile), { recursive: true, mode: 0o700 });
		writeFileSync(keyFile, JSON.stringify(credentials), { mode: 0o600 });
		chmodSync(keyFile, 0o600);
	};

	await page.goto(`${origin}/_emdash/admin`);
	await page.waitForURL(/\/_emdash\/admin\/(setup|login)/, { timeout: 180_000 });
	if (show) {
		// A window for a person: sign in with the saved passkey and hand the page over.
		if (page.url().includes("/setup") || !existsSync(keyFile)) {
			throw new Error("There is no saved passkey for this site on this machine. Set it up first: mise run signin:passkey (add -- --live for the deployed site).");
		}
		for (const credential of JSON.parse(readFileSync(keyFile, "utf8"))) {
			credential.signCount += 100;
			await cdp.send("WebAuthn.addCredential", { authenticatorId, credential });
		}
		const signInShown = page.getByRole("button", { name: "Sign in with Passkey" });
		await signInShown.waitFor({ timeout: 60_000 });
		await signInShown.click();
		await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60_000 });
		await savePasskey();
		// Say what the window is showing, so a run with nobody watching can be checked.
		await page.getByText("Dashboard").first().waitFor({ timeout: 60_000 });
		const title = await page.title();
		const shown = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 120);
		console.log(`open: signed in to ${page.url()} — "${title}": ${shown}`);
		console.log("open: close the window when you are done");
		// On macOS closing the last window leaves Chrome itself running, so wait for the page to
		// go as well as for the browser to.
		await new Promise((r) => (page.on("close", r), browser.on("disconnected", r)));
		await browser.close().catch(() => {});
		process.exit(0);
	}
	if (page.url().includes("/setup")) {
		// 1a. EmDash's setup wizard: site, account, passkey.
		await page.getByRole("heading", { name: "Set up your site" }).waitFor({ timeout: 120_000 });
		await page.getByRole("radio", { name: /Empty site/ }).check({ force: true });
		await page.getByRole("button", { name: /Continue/ }).click();
		await page.getByLabel("Your Email").waitFor({ timeout: 120_000 });
		await page.getByLabel("Your Email").fill(email);
		await page.getByLabel("Your Name").fill(name);
		await page.getByRole("button", { name: /Continue/ }).click();
		await page.getByRole("button", { name: "Create passkey" }).click();
		await page.getByText("Passkey created").waitFor({ timeout: 60_000 });
		await savePasskey();
		console.log(`setup: first administrator created (${email}); its passkey is saved for next time`);
	} else {
		// 1b. Already set up: only a passkey this script saved gets it in.
		if (!existsSync(keyFile)) {
			throw new Error(
				"This site is already set up and there is no saved passkey for it on this machine, so there is no way in. Sign the CLI in yourself: mise run emdash -- login --url " + origin,
			);
		}
		// A passkey counts its uses and the site refuses a count that goes backwards. A run that
		// died before saving would leave the file behind the site, so start well ahead of it.
		for (const credential of JSON.parse(readFileSync(keyFile, "utf8"))) {
			credential.signCount += 100;
			await cdp.send("WebAuthn.addCredential", { authenticatorId, credential });
		}
		console.log("setup: already done; signing in with the saved passkey");
	}

	// 2. EmDash's own CLI sign-in: it prints a code, this browser approves it. EmDash also opens
	// the page in the default browser, with no option not to — admin/quiet/ puts a do-nothing
	// `open` first on the PATH for this one command. (On Windows pnpm is a .cmd file, which only
	// a shell can start, and the default browser does open.)
	login = spawn("pnpm", ["exec", "emdash", "login", "--url", origin], {
		cwd: siteDir,
		// No colour: the code is read out of what it prints. (In CI, and in a terminal, it colours
		// the code; that is what broke the first three-OS run of this script.)
		env: {
			...process.env,
			PATH: join(here, "quiet") + delimiter + process.env.PATH,
			NO_COLOR: "1",
			FORCE_COLOR: "0",
		},
		shell: process.platform === "win32",
		// Its own process group, so that stopping it stops what pnpm started too.
		detached: process.platform !== "win32",
	});
	login.stdout.on("data", (d) => (out += d));
	login.stderr.on("data", (d) => (out += d));
	const exited = new Promise((r) => login.on("exit", r));
	const code = await new Promise((resolve, reject) => {
		const t = setInterval(() => {
			// Colour codes stripped anyway, in case a later EmDash ignores NO_COLOR.
			const m = out.replace(/\x1b\[[0-9;]*m/g, "").match(/Enter code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/);
			if (m) (clearInterval(t), resolve(m[1]));
		}, 250);
		setTimeout(() => (clearInterval(t), reject(new Error("emdash login printed no code"))), 60_000);
	});
	const signIn = page.getByRole("button", { name: "Sign in with Passkey" });
	const codeBox = page.getByPlaceholder("XXXX-XXXX");
	// The admin is one page of JavaScript and now and then it sits on "Loading EmDash..." for
	// good; loading it again gets past that.
	for (let attempt = 1; ; attempt++) {
		await page.goto(`${origin}/_emdash/admin/device`);
		try {
			await signIn.or(codeBox).first().waitFor({ timeout: 20_000 });
			break;
		} catch (error) {
			if (attempt === 4) throw error;
		}
	}
	if (await signIn.isVisible()) {
		await signIn.click();
		await codeBox.or(page.getByText("Authentication failed")).first().waitFor({ timeout: 60_000 });
		await savePasskey();
		if (!(await codeBox.isVisible())) throw new Error("The site refused the saved passkey.");
	}
	await codeBox.fill(code);
	await page.getByRole("button", { name: "Authorise" }).click();
	await page.getByText("Device authorised").waitFor({ timeout: 60_000 });
	await savePasskey();
	exit = (await exited) ?? 1;
	console.log(exit === 0 ? "cli: signed in" : `cli: emdash login exited ${exit}`);
} catch (error) {
	console.error(`failed: ${error.message}`);
	console.error(`The page it was on: ${page.url()}`);
	const said = await page.locator("body").innerText().catch(() => "");
	console.error(`What it said: ${said.replace(/\s+/g, " ").slice(0, 300)}`);
} finally {
	// Never leave a browser or a waiting `emdash login` behind.
	if (exit !== 0 && out) console.error(out);
	if (!browser.isConnected()) process.exit(exit);
	if (login && login.exitCode === null) {
		try {
			if (process.platform === "win32") {
				spawn("taskkill", ["/pid", String(login.pid), "/T", "/F"]);
			} else {
				process.kill(-login.pid);
			}
		} catch {}
	}
	await browser.close();
}
process.exit(exit);
