/**
 * plat-trunk plugin implementation (the `entrypoint` module).
 *
 * Standard-format entry: default-export `{ hooks, routes }`. Identity
 * (id/version/capabilities) comes from the descriptor in `./index.ts`.
 *
 * Do NOT wrap this in `definePlugin()` — the integration wraps it with
 * `adaptSandboxEntry` so the same module works in `plugins: []` and `sandboxed: []`.
 */
export default {
	hooks: {
		"content:afterSave": {
			handler: async (event, ctx) => {
				ctx.log.info("plat-trunk: content saved", {
					collection: event.collection,
					id: event.content?.id,
				});
			},
		},
	},
};
