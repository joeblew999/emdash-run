// What a group's last run showed: tests/<group>/results.json, one row per step.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fingerprint } from "./depends.mjs";
import { groups, repo, stepped, tasks } from "./groups.mjs";

const fileOf = (group) => join(repo, "tests", group, "results.json");
export const rowsOf = (group) => (existsSync(fileOf(group)) ? JSON.parse(readFileSync(fileOf(group), "utf8")).map((r) => ({ ...r, group })) : []);
export const everyRow = () => groups.flatMap(rowsOf);

/** proven, changed since it passed, a step fails, or no run recorded. */
export const stateOf = (rows, group) =>
	!rows.length ? "no run recorded" : rows.some((r) => r.result === "FAIL") ? "**a step fails**" : rows.every((r) => r.proof === fingerprint(group)) ? "proven" : "changed since it passed";

/**
 * Is the group proven on this kind of site? Its everyday steps passed with nothing it depends on
 * changed since; with `all`, its long steps too.
 */
export const proven = (group, where, all = false) => {
	const rows = rowsOf(group).filter((r) => r.where === where);
	const everyday = stateOf(rows.filter((r) => !r.long), group) === "proven";
	return everyday && (!all || group === "live" || stateOf(rows.filter((r) => r.long), group) === "proven");
};

/**
 * Record a group's run. A run of every step is the whole truth for that group on that kind of site:
 * everything recorded for it before goes, so a step that was renamed or removed cannot linger. A
 * run of the everyday steps replaces those, and leaves the long steps as last recorded.
 * @returns {number} how many steps failed
 */
export const record = (group, steps, { where, from, commit, took, all }) => {
	// where it ran: the stages workflow shows this record for each of its three machines
	const os = { darwin: "macOS", linux: "Linux", win32: "Windows" }[process.platform] ?? process.platform;
	const when = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
	const proof = fingerprint(group);
	// seconds: how long the step took; runSeconds: how long the group's run took
	const fresh = steps.map((r, order) => ({ task: r.task, where, step: r.step, result: r.result, detail: r.detail, refusal: r.refusal, long: r.long, seconds: r.seconds, proof, runSeconds: took, from, commit, when, os, order }));
	const kept = rowsOf(group).filter((r) => r.where !== where || (!all && r.long)).map(({ group: _, ...r }) => r);
	writeFileSync(fileOf(group), JSON.stringify(fresh.concat(kept), null, 1) + "\n");
	return fresh.filter((r) => r.result === "FAIL").length;
};

/**
 * Every task in tasks.toml has a step, and every step names a real task: tasks.toml cannot change
 * without the test changing with it. What is wrong, as lines; none when nothing is.
 */
export const coverage = () => {
	const names = tasks().map((t) => t.name);
	const have = new Set(groups.flatMap(stepped));
	const untested = names.filter((n) => !have.has(n));
	const unknown = [...have].filter((n) => !names.includes(n));
	return [
		...(untested.length ? [`tasks.toml has tasks with no step in tests/*/steps.mjs: ${untested.join(", ")}`] : []),
		...(unknown.length ? [`tests/*/steps.mjs has steps for tasks that are not in tasks.toml: ${unknown.join(", ")}`] : []),
	];
};
