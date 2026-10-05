/**
 * `repo:check` — lint, and confirm the code is formatted. `repo:format` — apply formatting.
 *
 * The same tools and flags the emdash monorepo uses, taken from mise `[tools]` because this
 * repo has no root package.json. Emdash's own script is `oxlint --type-aware --deny-warnings`,
 * and the flags are matched deliberately: `--deny-warnings` is what makes a warning mean
 * something rather than scroll past.
 *
 * Why this is worth more than style: **nothing validated `scripts/` until it ran.** A syntax
 * error in a helper — an unclosed template literal, say — stayed invisible until that exact
 * code path executed, which in this repo could be days later. Lint parses every file, so that
 * whole class dies at check time instead of at 2am.
 *
 * Targets are explicit rather than `.`. oxfmt also formats TOML and Markdown, and `mise.toml`
 * is this repo's declared source of truth — a file already broken once by an over-eager edit.
 * Prose (`docs/`) and generated files (`skills-lock.json`) gain nothing from reformatting and
 * cost reviewable diffs.
 */
import { run } from "./exec.mjs";

/** The code we own. Not config, not prose, not generated output. */
const CODE = [
	"scripts",
	"plugins/plat-trunk/src",
	"plugins/plat-trunk-sandboxed/src",
	"plugins/plat-trunk-sandboxed/tests",
];

export function check() {
	console.log("→ oxlint --type-aware --deny-warnings");
	run("oxlint", ["--type-aware", "--deny-warnings", ...CODE]);
	console.log("→ oxfmt --check");
	run("oxfmt", ["--check", ...CODE]);
}

export function format() {
	run("oxfmt", CODE);
}
