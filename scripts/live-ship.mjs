// The last step of `mise run live:ship`, and of live:undo: wait for the deployed site to answer
// with the NEW version.
//
//   node live-ship.mjs <the deployed site's address>
const [siteDir] = process.argv.slice(2); // the address: named as in the code below

// The deployed site answers — the NEW version: an address nothing has cached, asked again for
// up to a minute, because for some seconds after a deploy Cloudflare still answers for the old
// one, or with a 404 of its own. (siteDir is the address here.) The first request after a
// deploy runs EmDash's migrations and can take a while.
const address = new URL(siteDir);
let last = "no answer";
for (let i = 0; i < 20; i++) {
	address.searchParams.set("emdash-run", String(Date.now()));
	try {
		const res = await fetch(address, { redirect: "manual", headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(180_000) });
		const ours = (res.headers.get("content-type") || "").includes("text/html");
		last = `HTTP ${res.status}`;
		if (res.status < 400) {
			console.log(`${address.origin} answers: ${last}`);
			process.exit(0);
		}
		// a new site has no pages until content is put in: the site's own 404 is an answer
		if (res.status === 404 && ours && i >= 2) {
			console.log(`${address.origin} answers, and has no home page yet (${last}). A newly deployed site starts without content:`);
			console.log("  mise run signin:token -- --live");
			console.log("  mise run emdash -- site export --output site.emdash                      (this machine's content)");
			console.log("  mise run emdash -- site import site.emdash --analyze --live              (prints a plan and its digest)");
			console.log("  mise run emdash -- site import site.emdash --plan <digest> --confirm --live");
			process.exit(0);
		}
	} catch (error) {
		last = error.message;
	}
	await new Promise((done) => setTimeout(done, 3000));
}
console.error(`${address.origin} did not answer after a minute: ${last}`);
process.exit(1);
