import type { PluginDescriptor } from "emdash";

/**
 * plat-trunk — the local CAD plugin.
 *
 * emdash@1.1.0 contract: a descriptor must carry an `entrypoint` module specifier
 * so the integration can bundle it. `format: "standard"` lets the same entry run
 * in-process (`plugins: []`) or in an isolate (`sandboxed: []`).  The entrypoint
 * module default-exports `{ hooks, routes }` — it must NOT call `definePlugin()`.
 *
 * See docs/big-picture.md — the geometry field widget is the next step.
 */
export function platTrunkPlugin(): PluginDescriptor {
	return {
		id: "plat-trunk",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@plat-trunk/emdash-plugin/plugin",
		capabilities: ["content:read"],
	};
}
