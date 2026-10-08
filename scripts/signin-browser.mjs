// What `mise run site:admin` and `mise run live:admin` run — the one script in this repo, for a gap
// that is written down in docs/plans/done/2026-10-07-sign-in.md: EmDash has no command that sets a site
// up, or signs its CLI in, without a person at a browser.
//
// It makes sure an EmDash site that is NOT in development mode has an administrator and that
// EmDash's CLI is signed in to it — with no person. Playwright drives EmDash's own pages, and
// Chrome's built-in simulated passkey device stands in for Touch ID.
//
//   node signin-browser.mjs <site address> <site folder> [--deployed] [--show] [--check=<admin path>… [--blocks]]
//
// Tasks: signin:passkey, signin:open (--show); each with --live adds --deployed. plugin:works (--check).
//
// - A site that has not been set up: it completes the setup wizard (ADMIN_EMAIL, ADMIN_NAME,
//   an empty site), then approves `emdash login`.
// - A site it set up before: it signs in with the passkey it saved, then approves `emdash login`.
// - A site somebody else set up: it stops. It has no way in, and should not.
// - With --check=<path>: no window. It loads each admin page signed in with the saved token and
//   prints one line for it — ok, or FAIL with what the browser's console said. --blocks: the page is
//   a sandboxed plugin's, which the admin draws from the plugin's own answer; that answer is waited for.
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
import { createHash } from "node:crypto";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const deployed = args.includes("--deployed");
const show = args.includes("--show");
const checks = args.filter((a) => a.startsWith("--check=")).map((a) => a.slice(8));
const [given, siteDir] = args.filter((a) => !a.startsWith("--"));
// LIVE_PREVIEW=<name>: the deployed site meant is that preview of it (wrangler-config.mjs)
const { deployedAddress, previewOf } = await import("./wrangler-config.mjs");
const url = deployed && given ? deployedAddress(given) : given;
if (!url || !siteDir) {
	console.error("usage: node signin-browser.mjs <site address> <site folder> [--deployed]");
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
// Only making an administrator needs an address; opening a window on a site already set up, or
// checking its pages, does not.
if (!email && !show && !checks.length) {
	console.error("A deployed site's administrator needs an address: set ADMIN_EMAIL in the [env] block of mise.toml.");
	process.exit(1);
}
// One name per site for what this machine saves. A deployed site: its host. A site on this
// machine: host and port are not enough — two projects can use the same port — so the site's
// folder is part of it.
const savedName = (url, siteDir) => {
	const { host, hostname } = new URL(url);
	const safe = host.replace(/[^a-zA-Z0-9.-]/g, "_");
	const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname) || hostname.endsWith(".localhost");
	return local ? `${safe}_${createHash("sha256").update(resolve(siteDir)).digest("hex").slice(0, 10)}` : safe;
};
const keyFile = join(
	process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
	"emdash-run",
	"passkeys",
	`${savedName(url, siteDir)}.json`,
);
const here = dirname(fileURLToPath(import.meta.url));


// Say where this is acting, before doing anything. (On stderr, so piped output stays clean.)
const whereIs = (u) => {
	if (!URL.canParse(u)) return u;
	const { origin, port, hostname } = new URL(u);
	const here = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
	if (!here) return `DEPLOYED site: ${origin}`;
	return `this machine, ${port === (process.env.PREVIEW_PORT || "4322") ? "built site (site:preview)" : "dev site (site:start)"}: ${origin}`;
};
console.error(`-> ${whereIs(url)}`);
const LOCAL_HINT = local
	? `Nothing is answering at ${origin}. The sign-in tasks work on the production build: and  mise run site:preview  did not bring it up — run that to see why.`
	: `Nothing is answering at ${origin}. Is the site deployed? mise run live:ship`;
// Is the site there at all? A local build that is not running is started — the same as
// `mise run site:preview` — so that this is one command. A deployed site is only reported.
const answering = async () => {
	try {
		await fetch(new URL(url).origin, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
		return true;
	} catch {
		return false;
	}
};
if (!(await answering())) {
	if (local) {
		console.log(`Nothing is answering at ${new URL(url).origin}: starting the production build (mise run site:preview)…`);
		const { spawnSync: start } = await import("node:child_process");
		start("mise", ["run", "site:preview"], {
			cwd: process.env.MISE_PROJECT_ROOT || process.env.MISE_CONFIG_ROOT || process.cwd(),
			stdio: ["ignore", "ignore", "inherit"],
			shell: process.platform === "win32",
		});
	}
	if (!(await answering())) {
		console.error(LOCAL_HINT);
		process.exit(1);
	}
}

// The Chrome or Edge already installed: nothing is downloaded.
let browser;
let why = "";
for (const channel of ["chrome", "msedge"]) {
	try {
		browser = await chromium.launch({ channel, headless: !show });
		break;
	} catch (error) {
		why = String(error.message).split("\n")[0];
	}
}
if (!browser) {
	console.error(`This needs Google Chrome or Microsoft Edge, and neither would start: ${why}`);
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

	// What signin:token and signin:access saved for this site, if anything.
	const savedDir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run");
	const savedJson = (kind) => {
		let f = join(savedDir, kind, `${savedName(url, siteDir)}.json`);
		// a preview of the Worker is behind the live site's Access application: the same pass
		const preview = kind === "access" && !existsSync(f) ? previewOf(url, siteDir) : null;
		if (preview) f = join(savedDir, kind, `${preview.liveHost}.json`);
		return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
	};
	const savedToken = savedJson("tokens");
	// Every request this browser makes to the site carries the saved API token — and the Cloudflare
	// Access pass, if there is one. Only to the site itself, never to anything else it loads.
	const withSavedToken = async () => {
		const pass = savedJson("access");
		const extra = {
			Authorization: `Bearer ${savedToken.token}`,
			...(pass ? { "CF-Access-Client-Id": pass.id, "CF-Access-Client-Secret": pass.secret } : {}),
		};
		await page.context().route("**/*", (route) => {
			const request = route.request();
			if (new URL(request.url()).origin !== origin) return route.continue();
			return route.continue({ headers: { ...request.headers(), ...extra } });
		});
	};
	if (checks.length) {
		if (!savedToken) throw new Error("This machine has no token saved for this site. Run  mise run signin:token  first.");
		await withSavedToken();
		const blocks = args.includes("--blocks");
		let bad = 0;
		let errors = [];
		page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
		page.on("pageerror", (e) => errors.push(e.message));
		for (const path of checks) {
			errors = [];
			// a sandboxed plugin's page is drawn from what the plugin answers to this request
			const answered = blocks ? page.waitForResponse((r) => r.request().method() === "POST" && /\/_emdash\/api\/plugins\/[^/]+\/admin$/.test(new URL(r.url()).pathname), { timeout: 90_000 }).catch(() => null) : null;
			await page.goto(`${origin}${path}`);
			await page.getByText("Dashboard").first().waitFor({ timeout: 90_000 });
			const answer = await answered;
			await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
			const shown = (await page.locator("main").last().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
			const problems = [
				...(blocks && !answer ? ["the plugin did not answer the page's request"] : []),
				...(answer && !answer.ok() ? [`the plugin answered ${answer.status()}`] : []),
				...(shown.includes("Plugin Error") ? [`the page shows: ${shown.slice(shown.indexOf("Plugin Error"), shown.indexOf("Plugin Error") + 200)}`] : []),
				...(errors.length ? [`${errors.length} console error(s): ${errors.join(" | ").slice(0, 300)}`] : []),
			];
			if (problems.length) bad++;
			console.log(problems.length ? `FAIL admin page: ${path} — ${problems.join("; ")}` : `ok   admin page: ${path} loads with no console error${answer ? `; the plugin answered ${answer.status()}` : ""} — it shows "${shown.slice(0, 80)}"`);
		}
		await browser.close().catch(() => {});
		process.exit(bad ? 1 : 0);
	}
	if (show && savedToken && !existsSync(keyFile)) {
		// A window for a person, on a site signin:token set up: there is no passkey, so it uses the token.
		await withSavedToken();
		await page.goto(`${origin}/_emdash/admin`);
		await page.getByText("Dashboard").first().waitFor({ timeout: 90_000 });
		const shown = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 120);
		console.log(`open: signed in to ${page.url()} with the saved token — "${await page.title()}": ${shown}`);
		console.log("open: close the window when you are done");
		// SIGNIN_OPEN_SECONDS closes the window by itself after that long: for the test, which has nobody to close it.
		await new Promise((r) => {
			page.on("close", r);
			browser.on("disconnected", r);
			if (process.env.SIGNIN_OPEN_SECONDS) setTimeout(r, Number(process.env.SIGNIN_OPEN_SECONDS) * 1000);
		});
		await browser.close().catch(() => {});
		process.exit(0);
	}
	await page.goto(`${origin}/_emdash/admin`);
	await page.waitForURL(/\/_emdash\/admin\/(setup|login)/, { timeout: 180_000 });
	if (show) {
		// A window for a person: sign in with the saved passkey and hand the page over.
		if (page.url().includes("/setup") || !existsSync(keyFile)) {
			throw new Error("This machine has nothing saved for this site, so there is no way to sign in. Run  mise run signin:token  first (add -- --live for the deployed site).");
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
		// SIGNIN_OPEN_SECONDS closes the window by itself after that long: for the test, which has nobody to close it.
		await new Promise((r) => {
			page.on("close", r);
			browser.on("disconnected", r);
			if (process.env.SIGNIN_OPEN_SECONDS) setTimeout(r, Number(process.env.SIGNIN_OPEN_SECONDS) * 1000);
		});
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
	// the page in the default browser, with no option not to — scripts/quiet/ puts a do-nothing
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
