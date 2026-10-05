#!/usr/bin/env node
/**
 * merge-seed.mjs
 *
 * Merges the host template's demo seed with the CAD seed in config/cad.seed.json,
 * and writes the result to .src/site/seed/seed.json (the path the site's
 * package.json declares as `emdash.seed`).
 *
 * EmDash applies this automatically on the first request when the database is
 * empty — there is no separate seed command for D1.
 *
 * Rules:
 *   - collections / taxonomies: base (template) wins on slug/name collisions;
 *     CAD adds the ones the template does not have.
 *   - content: emitted in dependency order (projects → assemblies → parts) so
 *     `$ref:<id>` values resolve, then the template's own content.
 *   - menus / widgetAreas / settings: from the template.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ROOT comes from mise ([env]). Deriving it from this file's own location breaks the
// moment the file moves — it used to sit one level up, in scripts/.
const ROOT = process.env.ROOT;
if (!ROOT) throw new Error("ROOT is not set — run this via mise (mise run config:apply)");
const TEMPLATES_DIR = join(ROOT, ".src", "templates");
const SITE_DIR = join(ROOT, ".src", "site");
const TEMPLATE = process.env.TEMPLATE ?? "starter-cloudflare";

const basePath = join(TEMPLATES_DIR, TEMPLATE, "seed", "seed.json");
const cadPath = join(ROOT, "config", "cad.seed.json");
const outPath = join(SITE_DIR, "seed", "seed.json");

for (const p of [basePath, cadPath]) {
	if (!existsSync(p)) {
		console.error(`merge-seed: missing ${p} (run: mise run site:setup)`);
		process.exit(1);
	}
}

const base = JSON.parse(readFileSync(basePath, "utf8"));
const cad = JSON.parse(readFileSync(cadPath, "utf8"));

const union = (cadItems = [], baseItems = [], key) => {
	const m = new Map();
	for (const x of cadItems) m.set(x[key], x);
	for (const x of baseItems) m.set(x[key], x); // base wins
	return [...m.values()];
};

// Content keys in dependency order first (refs must point at already-applied ids).
const CAD_ORDER = ["projects", "assemblies", "parts"];
const cadContent = cad.content ?? {};
const content = {};
const seenIds = new Set();
const push = (key, entries = []) => {
	if (!content[key]) content[key] = [];
	for (const e of entries) {
		if (e?.id && seenIds.has(`${key}:${e.id}`)) continue;
		if (e?.id) seenIds.add(`${key}:${e.id}`);
		content[key].push(e);
	}
};
for (const key of CAD_ORDER) push(key, cadContent[key]);
for (const [key, entries] of Object.entries(cadContent)) {
	if (CAD_ORDER.includes(key)) continue;
	push(key, entries);
}
for (const [key, entries] of Object.entries(base.content ?? {})) push(key, entries);

const out = {
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

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(out, null, "\t")}\n`);

const entries = Object.values(content).reduce((n, a) => n + a.length, 0);
console.log(
	`  ✓ seed → .src/site/seed/seed.json (${out.collections.length} collections, ${entries} entries)`,
);
