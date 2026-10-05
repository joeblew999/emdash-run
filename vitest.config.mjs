/**
 * Tests for the repo's own scripts — `tests/*.test.mjs`.
 *
 * A plain object, deliberately, not `defineConfig` from `vitest/config`. That import cannot
 * resolve here: this repo has no root `node_modules` (the toolchain comes from mise `[tools]`,
 * as it does for oxlint), so there is nothing for `vitest/config` to resolve against and
 * vitest dies at startup with `ERR_MODULE_NOT_FOUND`. Vitest accepts a plain default export,
 * so the config costs nothing.
 *
 * The include is explicit because a bare `vitest run tests` filters on path substring, which
 * would also match `plugins/plat-trunk-sandboxed/tests/plugin.test.ts`. That one needs workerd
 * bindings and runs through its own package's vitest; the two must not be mixed.
 *
 * `scripts/lib/` is what these cover — mise tasks are one-line calls into `scripts/`, and the
 * non-trivial logic lives in the lib helpers, so that is where a unit test belongs.
 */
export default {
	test: {
		include: ["tests/**/*.test.mjs"],
	},
};
