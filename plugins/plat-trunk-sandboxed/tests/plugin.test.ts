import {
	createPluginRuntimeTestHost,
	createPluginTestHost,
	type PluginRuntimeTestHost,
	type PluginTestHost,
} from "@emdash-cms/plugin-test";
import { afterEach, describe, expect, it } from "vitest";

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
				{ slug: "model_id", label: "Model", type: "text" },
				{ slug: "material", label: "Material", type: "text" },
				{ slug: "assembly", label: "Assembly", type: "text" },
				{ slug: "geometry_meta", label: "Geometry", type: "json" },
			],
		});

		const created = await runtimeHost.actions.content.create("parts", {
			data: {
				part_number: "MP-002",
				material: "Steel",
				model_id: "punched-cube",
				// A reference field. The panel reads only `geometry_meta`, so a part that
				// has one proves top-level fields are not leaking rather than being untested.
				assembly: "asm-motor-housing",
				// Snapshot of the linked model's manifest.json in cad-documents.
				geometry_meta: {
					model_name: "Model punched-cube",
					objects: 1,
					model_version: "0.7.0",
					model_updated: "2026-03-09T10:07:24.183Z",
					format: "automerge",
					source: "cad-documents",
					synced: "2026-10-05",
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
		expect(rows).toHaveLength(9);
		expect(rows).toEqual(
			expect.arrayContaining([
				{ label: "Part number", value: "MP-002" },
				{ label: "Material", value: "Steel" },
				{ label: "Model", value: "Model punched-cube" },
				{ label: "Objects", value: "1" },
				{ label: "Model version", value: "0.7.0" },
				{ label: "Model updated", value: "2026-03-09T10:07:24.183Z" },
				{ label: "Format", value: "automerge" },
				{ label: "Source", value: "cad-documents" },
				{ label: "Synced", value: "2026-10-05" },
			]),
		);

		// Top-level fields must not leak into the editor panel.
		expect(JSON.stringify(response)).not.toContain("asm-motor-housing");
	});
});
