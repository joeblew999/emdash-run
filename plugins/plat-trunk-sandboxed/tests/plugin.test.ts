import { afterEach, describe, expect, it } from "vitest";

import {
	createPluginRuntimeTestHost,
	createPluginTestHost,
	type PluginRuntimeTestHost,
	type PluginTestHost,
} from "@emdash-cms/plugin-test";

let host: PluginTestHost | undefined;
let runtimeHost: PluginRuntimeTestHost | undefined;

afterEach(async () => {
	await host?.dispose();
	await runtimeHost?.dispose();
	host = undefined;
	runtimeHost = undefined;
});

describe("hello route", () => {
	it("returns a greeting through the sandbox host", async () => {
		host = await createPluginTestHost();
		const result = await host.invokeRoute("hello");
		expect(result).toEqual({ greeting: "hello", pluginId: "plat-trunk-sandboxed" });
	});
});

/**
 * The panel is only worth anything if the host will actually hand it a saved
 * entry, so this goes through `loadEditorPanel` — the host-attested path that
 * reloads and authorizes the entry — rather than calling the route directly with
 * a hand-built `ui`.
 */
describe("geometry editor panel", () => {
	it("renders a saved part's geometry_meta as a fields block", async () => {
		runtimeHost = await createPluginRuntimeTestHost();
		await runtimeHost.fixtures.site({ name: "emdash-run" });
		// Mirrors the `parts` collection in config/cad.seed.json.
		await runtimeHost.fixtures.collection({
			slug: "parts",
			label: "Parts",
			fields: [
				{ slug: "part_number", label: "Part number", type: "text" },
				{ slug: "material", label: "Material", type: "text" },
				{ slug: "assembly", label: "Assembly", type: "text" },
				{ slug: "geometry_meta", label: "Geometry", type: "json" },
			],
		});

		const created = await runtimeHost.actions.content.create("parts", {
			data: {
				part_number: "MP-002",
				material: "Steel",
				// A reference field: the panel hides it, so a part that has one
				// proves hiding works rather than being untested.
				assembly: "asm-motor-housing",
				geometry_meta: {
					vertices: 1842,
					faces: 964,
					edges: 2790,
					bbox_mm: "120 × 80 × 12",
					volume_cm3: 48.2,
					watertight: true,
					validation: "ok",
					source: "plat-trunk",
					format: "STEP",
					model: "cad/parts/mp-002.step",
				},
			},
		});
		if (!created.success) throw new Error(created.error.message);

		const response = await runtimeHost.admin.loadEditorPanel(
			"plat-trunk-geometry",
			"parts",
			created.data.item.id,
		);

		expect(response.blocks[0]).toEqual({ type: "header", text: "Geometry" });

		const fieldsBlock = response.blocks.find((block) => block.type === "fields");
		expect(fieldsBlock).toBeDefined();
		const rows = fieldsBlock && "fields" in fieldsBlock ? fieldsBlock.fields : [];

		// Order-independent, but exact in both directions: no missing labels and
		// no extra ones sneaking in.
		expect(rows).toHaveLength(12);
		expect(rows).toEqual(
			expect.arrayContaining([
				{ label: "Part number", value: "MP-002" },
				{ label: "Material", value: "Steel" },
				{ label: "Vertices", value: "1842" },
				{ label: "Faces", value: "964" },
				{ label: "Edges", value: "2790" },
				{ label: "Bounding box", value: "120 × 80 × 12" },
				{ label: "Volume (cm³)", value: "48.2" },
				{ label: "Watertight", value: "Yes" },
				{ label: "Validation", value: "ok" },
				{ label: "Source", value: "plat-trunk" },
				{ label: "Format", value: "STEP" },
				{ label: "Model", value: "cad/parts/mp-002.step" },
			]),
		);

		// Reference fields must not leak into the editor panel.
		expect(JSON.stringify(response)).not.toContain("asm-motor-housing");
	});
});
