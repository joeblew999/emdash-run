// The groups of the test, and the tasks they test, as mise reads them.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** Named as the tasks are. Each is a folder: tests/<group>/steps.mjs and results.json. */
export const groups = ["site", "signin", "plugin", "live"];
export const about = {
	site: "making, running, checking and deleting a site",
	signin: "the CLI and a browser window as an administrator of the built site",
	plugin: "a plugin of your own, and plugins from EmDash's registry",
	live: "the tasks that act on a deployed site",
};
/** The kind of site a group's run is on. */
export const whereOf = (group, onNode = false) => (group === "live" ? "deployed" : onNode ? "node" : "cloudflare");
export const read = (f) => (existsSync(join(repo, f)) ? readFileSync(join(repo, f), "utf8") : "");
export const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });

let listed;
/** Every task in tasks.toml as mise reads it, hidden steps too (this repo's own tasks are not counted). */
export const miseTasks = () => (listed ??= JSON.parse(execFileSync("mise", ["tasks", "ls", "--hidden", "--json"], { cwd: repo, encoding: "utf8" })).filter((t) => t.source.endsWith("tasks.toml")));
/** The tasks a project gets: without the hidden steps. */
export const tasks = () => miseTasks().filter((t) => !t.name.startsWith("step:")).map((t) => ({ name: t.name, hidden: t.hide }));
/** The task each step of a group names: step("<task>", …) and refuses("<task>", …). */
export const stepped = (group) => [...read(`tests/${group}/steps.mjs`).matchAll(/\b(?:step|refuses)\(\s*"([a-z:]+)"/g)].map((m) => m[1]);
