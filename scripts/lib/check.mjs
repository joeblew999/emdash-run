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
import { env, run, sh } from "./exec.mjs";

/** The code we own. Not config, not prose, not generated output. */
const CODE = [
	"scripts",
	"plugins/plat-trunk/src",
	"plugins/plat-trunk-sandboxed/src",
	"plugins/plat-trunk-sandboxed/tests",
];

/**
 * `site:check` — typecheck the host site.
 *
 * Two passes, because they cover different things and neither covers both:
 *
 *   `astro check`   the template's own `.astro` and `.ts` files. It also **loads**
 *                   `astro.config.mjs`, so a config that throws on load fails here — which is
 *                   the class that actually bit us: importing `plat-trunk-sandboxed/sandbox`
 *                   instead of the package root made EmDash reject the config at load time.
 *   `tsc --checkJs` the **types** of that same config file, which `astro check` never inspects:
 *                   it executes the config rather than analysing it. Verified by injection —
 *                   a deliberate JSDoc type error survives `astro check` and is caught here.
 *
 * Both run against `.src/site`, the copy `config:apply` writes, because that is where the
 * imports resolve via pnpm. `--ignoreConfig` is required: the site has a tsconfig.json, and
 * tsc refuses to combine it with explicit file arguments.
 *
 * **The daemon is stopped first, and restarted afterwards.** `astro check` re-runs the Vite
 * optimizer inside `.src/site`, re-hashing the `deps_ssr/*?v=…` URLs. A dev server already
 * running in that directory keeps serving the OLD hashes and starts returning 500s — "The file
 * does not exist at .../deps_ssr/emdash_n_croner.js?v=…". That is the same failure `repo:apply`
 * guards against by clearing `.vite` and restarting, and it is easy to mistake for the site
 * being down. Leaving a site that is up and broken is worse than a check that takes 30s.
 */
export function siteCheck() {
	const siteDir = env("SITE_DIR");

	sh("pitchfork stop emdash || true");
	try {
		console.log("→ astro check (the site, and that its config loads)");
		run("pnpm", ["exec", "astro", "check"], { cwd: siteDir });

		console.log("→ tsc --checkJs astro.config.mjs (the types astro check does not see)");
		run(
			"pnpm",
			[
				"exec",
				"tsc",
				"--noEmit",
				"--ignoreConfig",
				"--allowJs",
				"--checkJs",
				"--moduleResolution",
				"bundler",
				"--module",
				"esnext",
				"--target",
				"es2022",
				"--skipLibCheck",
				"astro.config.mjs",
			],
			{ cwd: siteDir },
		);
	} finally {
		// In a `finally`, so a failing check does not also cost you the site.
		console.log("→ restarting the site");
		run("pitchfork", ["start", "emdash"]);
	}
}

export function check() {
	console.log("→ oxlint --type-aware --deny-warnings");
	run("oxlint", ["--type-aware", "--deny-warnings", ...CODE]);
	console.log("→ oxfmt --check");
	run("oxfmt", ["--check", ...CODE]);
	console.log("→ skills:check (the committed EmDash skills match the site's)");
	run("mise", ["run", "skills:check"]);
}

export function format() {
	run("oxfmt", CODE);
}
