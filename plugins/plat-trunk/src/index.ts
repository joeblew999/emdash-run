import { definePlugin } from "emdash";
import type { PluginDescriptor } from "emdash";

const ADMIN_ENTRY = "@plat-trunk/emdash-plugin/admin";

/**
 * plat-trunk — the local CAD plugin (native format).
 *
 * Native is required for trusted React admin extensions. The descriptor factory
 * runs while Astro evaluates its config and carries only build-time metadata;
 * `createPlugin` is the runtime entrypoint that emdash's native loader imports
 * by name from `entrypoint`.
 *
 * See docs/big-picture.md — the Parts editor geometry panel lives in ./admin.
 */
export function platTrunkPlugin(): PluginDescriptor {
	return {
		id: "plat-trunk",
		version: "0.1.0",
		format: "native",
		entrypoint: "@plat-trunk/emdash-plugin",
		adminEntry: ADMIN_ENTRY,
		options: {},
	};
}

export function createPlugin() {
	return definePlugin({
		id: "plat-trunk",
		version: "0.1.0",
		capabilities: ["content:read"],
		hooks: {
			"content:afterSave": async (event, ctx) => {
				ctx.log.info("plat-trunk: content saved", {
					collection: event.collection,
					id: event.content?.id,
				});
			},
		},
		admin: {
			entry: ADMIN_ENTRY,
		},
	});
}
