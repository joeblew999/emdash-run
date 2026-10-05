import { describe, expect, it } from "vitest";

import { CONTENT_ORDER, mergeSeeds } from "../scripts/lib/merge-seed.mjs";

/**
 * The merge decides this site's schema and content, and until now had no tests at all — it was
 * a top-level script, so it could only be exercised by running the whole of `config:apply`
 * against the real template.
 *
 * These assertions also pin the **asymmetry** between the collection rule and the content
 * rule, which was previously only discoverable by reading the code.
 */

const base = () => ({
	$schema: "base-schema",
	version: "1",
	meta: { name: "Starter", description: "the template" },
	settings: { from: "base" },
	collections: [{ slug: "posts", label: "Posts (template)" }],
	taxonomies: [{ name: "category", label: "Categories (template)" }],
	menus: [{ slug: "main" }],
	widgetAreas: [{ slug: "sidebar" }],
	content: { posts: [{ id: "posts:hello" }] },
});

const cad = () => ({
	$schema: "cad-schema",
	meta: { name: "CAD", description: "the CAD seed" },
	collections: [
		{ slug: "parts", label: "Parts" },
		{ slug: "posts", label: "Posts (CAD)" },
	],
	taxonomies: [
		{ name: "category", label: "Categories (CAD)" },
		{ name: "material", label: "Materials" },
	],
	content: {
		parts: [{ id: "parts:mounting-plate", assembly: "$ref:assemblies:motor-housing" }],
		assemblies: [{ id: "assemblies:motor-housing" }],
		projects: [{ id: "projects:bracket" }],
	},
});

describe("collections and taxonomies", () => {
	it("keeps CAD-only entries and lets the template win a collision", () => {
		const merged = mergeSeeds(base(), cad());
		const slugs = merged.collections.map((c) => c.slug);

		expect(slugs).toContain("parts"); // CAD-only survives
		expect(slugs).toContain("posts");
		// The collision went to the template, NOT to CAD.
		expect(merged.collections.find((c) => c.slug === "posts").label).toBe("Posts (template)");
	});

	it("matches taxonomies by name, not slug", () => {
		const merged = mergeSeeds(base(), cad());
		const names = merged.taxonomies.map((t) => t.name);

		expect(names).toContain("material");
		expect(merged.taxonomies.find((t) => t.name === "category").label).toBe("Categories (template)");
	});
});

describe("content", () => {
	it("emits CAD content in dependency order so $refs resolve", () => {
		const merged = mergeSeeds(base(), cad());
		// The keys CAD declares, ordered dependency-first. `posts` is the template's, appended.
		const cadKeys = Object.keys(merged.content).filter((key) => key !== "posts");

		expect(cadKeys).toEqual(CONTENT_ORDER);
		expect(merged.content.projects[0].id).toBe("projects:bracket");
	});

	it("appends the template's content after CAD's", () => {
		const keys = Object.keys(mergeSeeds(base(), cad()).content);
		expect(keys.indexOf("parts")).toBeLessThan(keys.indexOf("posts"));
	});

	it("drops a duplicate id, and CAD's copy wins", () => {
		const b = base();
		const c = cad();
		// Same id on both sides — the opposite of the collection rule.
		c.content.parts.push({ id: "posts:hello", marker: "from CAD" });
		const merged = mergeSeeds(b, c);

		const hits = Object.values(merged.content).flat().filter((e) => e.id === "posts:hello");
		expect(hits).toHaveLength(1);
		expect(hits[0].marker).toBe("from CAD");
	});
});

describe("scalar precedence", () => {
	it("takes settings, menus and widgetAreas from the template", () => {
		const merged = mergeSeeds(base(), cad());
		expect(merged.settings).toEqual({ from: "base" });
		expect(merged.menus[0].slug).toBe("main");
		expect(merged.widgetAreas[0].slug).toBe("sidebar");
	});

	it("falls back to CAD when the template has none", () => {
		const b = base();
		b.menus = undefined;
		b.widgetAreas = undefined;
		b.settings = undefined;
		const merged = mergeSeeds(b, { ...cad(), menus: [{ slug: "cad-menu" }] });

		expect(merged.menus[0].slug).toBe("cad-menu");
		expect(merged.widgetAreas).toEqual([]);
		expect(merged.settings).toBeUndefined();
	});

	it("names the merged seed and joins both descriptions", () => {
		const merged = mergeSeeds(base(), cad());
		expect(merged.meta.name).toBe("Starter + CAD");
		expect(merged.meta.description).toBe("the template — the CAD seed");
	});

	it("falls back for a missing name rather than writing 'undefined + CAD'", () => {
		const b = base();
		b.meta = {};
		expect(mergeSeeds(b, cad()).meta.name).toBe("Site + CAD");
	});

	it("prefers the template's $schema and version, then CAD's, then '1'", () => {
		expect(mergeSeeds(base(), cad()).$schema).toBe("base-schema");
		expect(mergeSeeds({ ...base(), $schema: undefined }, cad()).$schema).toBe("cad-schema");
		expect(mergeSeeds({}, {}).version).toBe("1");
	});
});
