// A step of a group: a test of Node's own runner (node:test), named after the task it tests.
//
//   step(task, what, fn)      the task does what it says: fn runs to its end
//   refuses(task, what, fn)   the task must refuse: fn throws (a task it runs fails)
//   long(() => { … })         the steps inside run only with --all (mise run test:all)
//   setup(fn)                 before the first step: the project the steps work in
//
// A step that does not end is stopped at STEP_LIMIT seconds (five minutes) and fails; the steps
// after it are not run, but for the two that clean up: each would wait as long.
import { before, test } from "node:test";

import { running } from "./site.mjs";

const all = process.env.TEST_ALL === "1";
const limit = (Number(process.env.STEP_LIMIT) || 300) * 1000;
let inLong = false;
let stuck = "";

/** The name a step has in the runner: the reporter (reporter.mjs) reads it back. */
export const nameOf = (task, what, { long = false, refusal = false } = {}) => `${task} — ${what}${long ? " [long]" : ""}${refusal ? " [must refuse]" : ""}`;
/** @param {string} name */
export const partsOf = (name) => {
	const m = /^(\S+) — (.*?)( \[long\])?( \[must refuse\])?$/.exec(name);
	return m && { task: m[1], step: m[2], long: !!m[3], refusal: !!m[4] };
};

const define = (refusal) => (task, what, fn) => {
	const long = inLong;
	test(nameOf(task, what, { long, refusal }), { skip: long && !all, timeout: limit }, async (t) => {
		if (stuck && task !== "site:stop" && task !== "site:delete") throw new Error(`not run: ${stuck}`);
		running.log = "";
		// Node ends a step that runs past the limit (and says so); what it was running is stopped here
		let ended = false;
		t.signal.addEventListener("abort", () => {
			if (ended) return;
			stuck = `${task}: ${what} did not end`;
			running.stop();
		});
		let threw = null;
		try {
			await fn();
		} catch (e) {
			threw = e;
		}
		ended = true;
		if (refusal && !threw) throw new Error("it should have refused");
		// what the task printed last goes with the failure: on a CI runner it is the only account of it
		if (!refusal && threw) throw new Error([threw.message, ...running.log.split("\n").filter((l) => l.trim()).slice(-30)].join("\n"));
	});
};
export const step = define(false);
export const refuses = define(true);
/** @param {() => void} steps */
export const long = (steps) => {
	inLong = true;
	try {
		steps();
	} finally {
		inLong = false;
	}
};
/** @param {() => void | Promise<void>} fn */
export const setup = (fn) => before(fn, { timeout: limit });
