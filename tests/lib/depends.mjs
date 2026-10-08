// WHAT A GROUP DEPENDS ON — worked out, not listed by hand, and from mise's own reading of the
// tasks. From the tasks its steps name, follow what mise says each runs, depends on and waits for,
// to every task and hidden step; from those, every script they name, every script those import or
// start, and every task a script runs itself. Add the test's own code, the group's folder and the
// site the test copies.
//
// All of it as one fingerprint: a group that passed at this fingerprint is PROVEN, and is not run
// again. Change scripts/live-preview.mjs and only the live group's fingerprint moves.
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { git, miseTasks, read, repo } from "./groups.mjs";

// what makes a task what it is — not its description, and not this clone's path
const substance = (t) => JSON.stringify([t.run, t.depends, t.depends_post, t.wait_for, t.env, t.usage, t.sources, t.outputs, t.shell, t.raw, t.timeout, t.dir]).replaceAll(JSON.stringify(repo).slice(1, -1), "");

/** The tasks and scripts a group's steps reach. */
export const closure = (group) => {
	const byName = new Map(miseTasks().map((t) => [t.name, t]));
	const tasksIn = new Set();
	const scripts = new Set();
	const have = new Set(git("ls-files", "scripts").split("\n").filter(Boolean));
	const follow = (f) => {
		if (scripts.has(f) || !have.has(f)) return;
		scripts.add(f);
		const text = read(f);
		// a script it imports ("./x.mjs") or starts (join(here, "x.mjs"))
		for (const m of text.matchAll(/"\.\/([\w-]+\.mjs)"|here,\s*"([\w-]+\.mjs)"/g)) follow(`scripts/${m[1] || m[2]}`);
		// a task it runs itself: mise(["site:preview"]), ["run", "site:preview"]
		for (const m of text.matchAll(/\[\s*(?:"run",\s*)?"([a-z][a-z:-]*)"/g)) walk(m[1]);
	};
	const walk = (name) => {
		const task = byName.get(name);
		if (!task || tasksIn.has(name)) return;
		tasksIn.add(name);
		for (const d of [...task.depends, ...task.depends_post, ...task.wait_for]) walk(typeof d === "string" ? d.split(" ")[0] : d.task);
		for (const r of task.run) {
			if (typeof r === "string") for (const m of r.matchAll(/mise run (?:--yes )?([a-z][a-z:-]*)/g)) walk(m[1]);
			else for (const n of [r.task, ...(r.tasks || [])]) if (n) walk(n);
		}
		for (const m of substance(task).matchAll(/scripts\/([\w\/-]+\.mjs)/g)) follow(`scripts/${m[1]}`);
	};
	// every task the steps file names (a word in quotes that is not a task is not followed)
	for (const m of read(`tests/${group}/steps.mjs`).matchAll(/"([a-z][a-z:-]*)"/g)) walk(m[1]);
	for (const f of have) if (!f.endsWith(".mjs")) scripts.add(f); // package.json, the lock file, quiet/
	return { tasks: [...tasksIn].sort(), substanceOf: (name) => substance(byName.get(name)), scripts: [...scripts].sort() };
};

export const fingerprint = (group) => {
	const h = createHash("sha256");
	const c = closure(group);
	for (const t of c.tasks) h.update(t).update(c.substanceOf(t));
	for (const f of c.scripts) h.update(f).update(read(f));
	// the test's own code: what runs a step and reports it
	for (const f of ["tests/run.mjs", "tests/lib/site.mjs", "tests/lib/step.mjs", "tests/lib/reporter.mjs"]) h.update(read(f));
	for (const f of readdirSync(join(repo, "tests", group), { recursive: true }).map(String).sort()) {
		if (!f.endsWith("results.json") && !f.includes("fixtures") && /\.[a-z]+$/.test(f)) h.update(f).update(read(join("tests", group, f)));
	}
	if (group !== "live") h.update(git("ls-files", "-s", "site")).update(git("diff", "--", "site"));
	return h.digest("hex").slice(0, 12);
};
