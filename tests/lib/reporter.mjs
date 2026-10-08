// A reporter for Node's test runner that writes the steps' results as JSON, for the record
// (tests/lib/results.mjs). What you read while a test runs is Node's own `spec` reporter.
import { partsOf } from "./step.mjs";

/** @param {AsyncIterable<{ type: string, data: any }>} events */
export default async function* rows(events) {
	const steps = [];
	for await (const { type, data } of events) {
		if (type !== "test:pass" && type !== "test:fail") continue;
		const parts = partsOf(data.name);
		if (!parts || data.skip !== undefined) continue;
		const error = type === "test:fail" ? String(data.details?.error?.cause?.message ?? data.details?.error?.message ?? "") : "";
		steps.push({ ...parts, result: type === "test:fail" ? "FAIL" : "PASS", detail: error.split("\n").filter((l) => l.trim()).slice(0, 4).join("  ").replaceAll("|", " ").slice(0, 240), seconds: Math.round((data.details?.duration_ms ?? 0) / 1000) });
	}
	yield JSON.stringify(steps);
}
