/**
 * Merge the host template's demo seed with the CAD seed in `config/cad.seed.json`.
 *
 * **Pure on purpose.** No file reads, no writes, no `process.exit` — the I/O lives in
 * `scripts/config.mjs`, which is what `config:apply` runs. As a top-level script this logic
 * could only be exercised by running the whole thing against the real template; now the rules
 * that decide this site's schema and content are unit-tested in `tests/merge-seed.test.mjs`.
 *
 * The rules are deliberately **not uniform**, and that asymmetry is asserted rather than
 * implied — it was previously only visible by reading the code:
 *
 *   - `collections` / `taxonomies`: a collision goes to the **template** (`base`).
 *   - `content`: CAD is emitted first, so on an id collision **CAD survives** and the
 *     template's copy is dropped. Opposite to the collections rule, on purpose: the CAD seed
 *     is this repo's reason to exist, and its ids are namespaced (`parts:motor-housing`) so a
 *     real clash would be a malformed seed either way.
 *   - content order is dependency-first, because entries carry `$ref:<id>` values that have to
 *     resolve to something already applied.
 *   - `menus` / `widgetAreas` / `settings`: the template's, falling back to CAD's.
 */

/** Content keys in dependency order. Entries carry `$ref:` values, so order matters. */
export const CONTENT_ORDER = ["projects", "assemblies", "parts"];

/** Union two lists by key, with `base` winning on collision. */
function union(cadItems = [], baseItems = [], key) {
	const merged = new Map();
	for (const item of cadItems) merged.set(item[key], item);
	for (const item of baseItems) merged.set(item[key], item); // base wins
	return [...merged.values()];
}

export function mergeSeeds(base, cad) {
	const cadContent = cad.content ?? {};
	const content = {};
	const seenIds = new Set();

	const push = (key, entries = []) => {
		content[key] ??= [];
		for (const entry of entries) {
			// Ids are already namespaced (`parts:mounting-plate`), so the id alone identifies an
			// entry. The previous key was `${key}:${id}`, which built `parts:parts:motor-housing`
			// and so would not have caught a cross-collection duplicate.
			if (entry?.id) {
				if (seenIds.has(entry.id)) continue;
				seenIds.add(entry.id);
			}
			content[key].push(entry);
		}
	};

	// Dependency order first, then anything else CAD declares, then the template's own content.
	for (const key of CONTENT_ORDER) push(key, cadContent[key]);
	for (const [key, entries] of Object.entries(cadContent)) {
		if (CONTENT_ORDER.includes(key)) continue;
		push(key, entries);
	}
	for (const [key, entries] of Object.entries(base.content ?? {})) push(key, entries);

	return {
		$schema: base.$schema ?? cad.$schema,
		version: base.version ?? cad.version ?? "1",
		meta: {
			...base.meta,
			name: `${base.meta?.name ?? "Site"} + CAD`,
			description: [base.meta?.description, cad.meta?.description].filter(Boolean).join(" — "),
		},
		settings: base.settings ?? cad.settings,
		collections: union(cad.collections, base.collections, "slug"),
		taxonomies: union(cad.taxonomies, base.taxonomies, "name"),
		menus: base.menus ?? cad.menus ?? [],
		widgetAreas: base.widgetAreas ?? cad.widgetAreas ?? [],
		content,
	};
}
