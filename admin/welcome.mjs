// EmDash's admin greets every new user with a welcome dialog, on top of the page, until that user
// closes it. There is no setting for it (EmDash 1.2.0: admin/src/components/Shell.tsx shows it
// while /_emdash/api/auth/me says isFirstLogin). Closing it is one call to EmDash's own API, the
// one the dialog's button makes — so the tasks that make a user make that call for them.
//
//   node welcome.mjs <dev site address>     the dev site's own user (mise run site:start)
//
// Never fails a task: a dialog is not worth one.
export async function dismissWelcome(origin, token, headers = {}) {
	try {
		const res = await fetch(new URL("/_emdash/api/auth/me", origin), {
			method: "POST",
			headers: { ...headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-EmDash-Request": "1" },
			body: JSON.stringify({ action: "dismissWelcome" }),
			redirect: "manual",
			signal: AbortSignal.timeout(30_000),
		});
		return res.ok;
	} catch {
		return false;
	}
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("welcome.mjs")) {
	const origin = new URL(process.argv[2]).origin;
	let done = false;
	try {
		// EmDash's development sign-in hands out a token when asked (?token=1); a development site only
		const res = await fetch(new URL("/_emdash/api/setup/dev-bypass?token=1", origin), { method: "POST", signal: AbortSignal.timeout(120_000) });
		const body = await res.json();
		const token = body?.data?.token ?? body?.token;
		done = token ? await dismissWelcome(origin, token) : false;
	} catch {}
	console.log(done ? "welcome: EmDash's welcome dialog is closed for the dev user" : "welcome: could not close EmDash's welcome dialog — close it once in the admin");
}
