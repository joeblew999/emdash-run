// What `mise run site:stop` runs after Astro's own two stops: a Node site's sandbox process, which
// outlives the site. A file of its own, so stopping a site depends on nothing of the plugin scripts.
//
//   node site-stop.mjs <site folder>
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

const win = process.platform === "win32";
export const stopLeftover = (siteDir) => {
	// A Node site runs its sandboxed plugins in a workerd process. EmDash starts it through the
	// workerd package's launcher and stops the launcher, not workerd itself — which then outlives
	// the site and keeps its port (18788…), so the next start cannot open it and every sandboxed
	// plugin is down (docs/upstream.md). This stops exactly that: a workerd run from THIS site's
	// own node_modules. Nothing by name, nothing by port, nothing of another site's.
	if (win || !existsSync(join(siteDir, "node_modules", "workerd"))) return;
	const roots = [...new Set([resolve(siteDir), realpathSync(siteDir)])].map((r) => join(r, "node_modules") + "/");
	const ps = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
	for (const l of ps.stdout.split("\n")) {
		const m = /^\s*(\d+)\s+(\S+)\s+serve\s/.exec(l);
		if (!m || !/\/bin\/workerd$/.test(m[2]) || !roots.some((r) => m[2].startsWith(r))) continue;
		try {
			process.kill(Number(m[1]));
			console.log(`Stopped this site's sandbox process, which the stopped site had left running (workerd, pid ${m[1]}).`);
		} catch {}
	}
};

stopLeftover(process.argv[2]);
