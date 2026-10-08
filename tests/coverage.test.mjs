// tasks.toml cannot change without the test changing with it: every task has a step, and every
// step names a real task.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

test("every task in tasks.toml has a step, and every step names a task", () => {
	/** @type {{ name: string, source: string, description: string }[]} */
	const listed = JSON.parse(execFileSync("mise", ["tasks", "ls", "--hidden", "--json"], { cwd: join(here, ".."), encoding: "utf8" }));
	// (a task whose description starts "Internal:" is a part of others, tested with them)
	const tasks = listed.filter((t) => t.source.endsWith("tasks.toml") && !t.description.startsWith("Internal:")).map((t) => t.name);
	const stepped = new Set();
	// a group's own steps, and the steps two groups share (tests/both)
	for (const file of readdirSync(here, { recursive: true }).map(String).filter((f) => !f.includes("node_modules") && f.endsWith(".mjs") && (f.endsWith("steps.mjs") || f.startsWith("both")))) {
		for (const m of readFileSync(join(here, file), "utf8").matchAll(/\b(?:step|refuses)\(\s*"([a-z:]+)"/g)) stepped.add(m[1]);
	}
	assert.deepEqual(tasks.filter((t) => !stepped.has(t)), [], "tasks with no step in tests/*/steps.mjs");
	assert.deepEqual([...stepped].filter((t) => !tasks.includes(t)), [], "steps for tasks that are not in tasks.toml");
});
