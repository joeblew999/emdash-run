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

/**
 * Keys that would be a file reference rather than a display value. Nothing currently uses
 * them; kept as a guard, because a bare R2 key rendered as text is useless in the panel.
 */
const HIDDEN = new Set(["scene_key", "automerge_key", "brep_file", "step_file"]);

/**
 * Labels for the keys in `geometry_meta`. Those keys are a snapshot of the linked
 * plat-trunk model's `manifest.json` — see `model_id` and `config/cad.seed.json`.
 */
const LABELS: Record<string, string> = {
	model_name: "Model",
	objects: "Objects",
	model_version: "Model version",
	model_updated: "Model updated",
	format: "Format",
	source: "Source",
	synced: "Synced",
};

function format(value: unknown): string {
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}

/**
 * Narrow an unknown to a plain object. A type predicate, so callers never need an `as` —
 * an assertion here would silently accept an array or a primitive.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

function asRows(entry: PanelContext["entry"]): Array<[string, string]> {
	const data = isRecord(entry?.data) ? entry.data : {};
	const rows: Array<[string, string]> = [];
	const push = (label: string, value: unknown) => {
		if (value === undefined || value === null || value === "") return;
		rows.push([label, format(value)]);
	};
	push("Part number", data.part_number);
	push("Material", data.material);
	const meta = data.geometry_meta;
	if (isRecord(meta)) {
		for (const [key, value] of Object.entries(meta)) {
			if (!HIDDEN.has(key)) push(LABELS[key] ?? key, value);
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
