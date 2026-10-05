import type { SandboxedPlugin } from "emdash/plugin";
import type { BlockResponse } from "@emdash-cms/blocks";

/**
 * Sandboxed twin of `plugins/plat-trunk`.
 *
 * The native plugin is trusted host code: it exports a React
 * `contentEditorPanels` entry and the host imports the component. This one may not
 * ship browser code, so it declares the same panel in `emdash-plugin.jsonc`
 * (`admin.editorPanels`) and answers it with Block Kit from the private route
 * named there. Same panel, same rows — different trust model.
 */

/** Reference fields aren't useful as inline text, so keep them out of the panel. */
const HIDDEN = new Set(["assembly", "brep_file", "step_file"]);

/** Friendlier labels for the keys we seed into `geometry_meta`. */
const LABELS: Record<string, string> = {
	vertices: "Vertices",
	faces: "Faces",
	edges: "Edges",
	bbox_mm: "Bounding box",
	volume_cm3: "Volume (cm³)",
	watertight: "Watertight",
	validation: "Validation",
	source: "Source",
	format: "Format",
	model: "Model",
};

function format(value: unknown): string {
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "string") return value;
	return JSON.stringify(value) ?? String(value);
}

/**
 * Build the label/value rows for a part. Deliberately equivalent to the native
 * panel's `asRows()` so the two trust models can be compared on the same entry.
 */
function geometryFields(data: Record<string, unknown>): Array<{ label: string; value: string }> {
	const fields: Array<{ label: string; value: string }> = [];
	const push = (label: string, value: unknown) => {
		if (value === undefined || value === null || value === "") return;
		fields.push({ label, value: format(value) });
	};

	push("Part number", data.part_number);
	push("Material", data.material);

	const meta = data.geometry_meta;
	if (meta && typeof meta === "object" && !Array.isArray(meta)) {
		for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
			if (!HIDDEN.has(key)) push(LABELS[key] ?? key, value);
		}
	}

	return fields;
}

const plugin: SandboxedPlugin = {
	routes: {
		hello: {
			handler: async (_routeCtx, ctx) => {
				ctx.log.info("hello route called", { pluginId: ctx.plugin.id });
				return { greeting: "hello", pluginId: ctx.plugin.id };
			},
		},

		/**
		 * Backs `admin.editorPanels[0]`. The host reloads and authorizes the saved
		 * entry before dispatch, so `routeCtx.ui.entry` is attested identity — read
		 * that, never an id from `routeCtx.input`. Panel load carries no draft data.
		 */
		"editor/geometry": {
			handler: async (routeCtx, ctx): Promise<BlockResponse> => {
				const ui = routeCtx.ui;
				const entry = ui?.surface === "content-editor-panel" ? ui.entry : undefined;
				if (!entry) {
					return { blocks: [{ type: "context", text: "No saved entry in context." }] };
				}

				// `ctx.content` exists only because the manifest declares
				// `content:read`. Guard anyway: the type is optional, and a missing
				// capability is a config mistake worth showing rather than throwing.
				if (!ctx.content) {
					return { blocks: [{ type: "context", text: "content:read capability not granted." }] };
				}

				const part = await ctx.content.get(entry.collection, entry.id);
				if (!part) {
					return { blocks: [{ type: "context", text: "Part not found." }] };
				}

				const fields = geometryFields((part.data ?? {}) as Record<string, unknown>);
				if (fields.length === 0) {
					return { blocks: [{ type: "context", text: "No geometry metadata on this part." }] };
				}

				return {
					blocks: [
						{ type: "header", text: "Geometry" },
						{ type: "fields", fields },
					],
				};
			},
		},
	},
};

export default plugin;
