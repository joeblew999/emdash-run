/**
 * Trusted React admin extensions for the plat-trunk plugin.
 *
 * emdash discovers `contentEditorPanels` from this module (declared via the
 * descriptor's `adminEntry` and the runtime's `admin.entry`). Panels need no
 * page or widget declaration.
 *
 * The panel types live in `@emdash-cms/admin`, which is not published as an
 * installable package, so the context is typed locally from the documented shape.
 */
interface PanelContext {
	entry?: { slug?: string; data?: Record<string, unknown> } & Record<string, unknown>;
	collection?: string;
	locale?: string;
}

/** Reference fields aren't useful as inline text, so keep them out of the table. */
const HIDDEN = new Set(["assembly", "brep_file", "step_file"]);

function asRows(entry: PanelContext["entry"]): Array<[string, string]> {
	const data = (entry?.data ?? {}) as Record<string, unknown>;
	const rows: Array<[string, string]> = [];
	const push = (label: string, value: unknown) => {
		if (value === undefined || value === null || value === "") return;
		rows.push([label, typeof value === "string" ? value : JSON.stringify(value)]);
	};
	push("Part number", data.part_number);
	push("Material", data.material);
	const meta = data.geometry_meta;
	if (meta && typeof meta === "object") {
		for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
			if (!HIDDEN.has(key)) push(key, value);
		}
	}
	return rows;
}

/** Geometry summary, shown in the Parts editor sidebar. */
function GeometryPanel({ entry }: PanelContext) {
	const rows = asRows(entry);
	if (rows.length === 0) {
		return <p className="text-sm text-kumo-subtle">No geometry metadata on this part.</p>;
	}
	return (
		<dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
			{rows.map(([label, value]) => (
				<div key={label} className="contents">
					<dt className="text-kumo-subtle">{label}</dt>
					<dd className="break-words">{value}</dd>
				</div>
			))}
		</dl>
	);
}

export const contentEditorPanels = [
	{
		id: "plat-trunk-geometry",
		title: "Geometry",
		component: GeometryPanel,
		collections: ["parts"],
		order: 10,
	},
];
