import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

export default definePlugin({
	hooks: {
		"content:afterSave": {
			handler: async (event: any, ctx: PluginContext) => {
				ctx.log.info("Content saved", {
					collection: event.collection,
					id: event.content.id,
				});
			},
		},
	},
});
