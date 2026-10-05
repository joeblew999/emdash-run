#!/usr/bin/env node
/**
 * One-off: reorder the sections of mise.toml so the core workflow comes first and the
 * optional extras (registry, plugins-site) come last. Section order in TOML is purely
 * cosmetic — this changes no behaviour — but it decides what a reader sees first.
 *
 * Splits on the `# ----` / `# TITLE` / `# ----` banners, reorders by title, refuses to
 * write unless the title set matches exactly (so a section can never be dropped).
 *
 *   node scripts/reorder-mise-sections.mjs [path/to/mise.toml]
 */
import fs from "node:fs";

const path = process.argv[2] ?? "mise.toml";
const src = fs.readFileSync(path, "utf8");
const lines = src.split("\n");

const bannerStart = /^# -{20,}$/;
const starts = [];
for (let i = 0; i < lines.length; i++) {
	if (bannerStart.test(lines[i]) && /^# \S/.test(lines[i + 1] ?? "")) starts.push(i);
}
if (starts.length === 0) throw new Error(`no section banners found in ${path}`);

const preamble = lines.slice(0, starts[0]).join("\n");
const sections = starts.map((start, index) => {
	const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
	return {
		title: lines[start + 1].replace(/^# /, ""),
		body: lines.slice(start, end).join("\n"),
	};
});

/** Core flow first, then deploy/plugin/skills/cli, then the optional extras. */
const order = [
	"SRC (gitignored checkouts)",
	"SITE (host site = official template copy, runs on :4321)",
	"TOP-LEVEL WORKFLOW",
	"PITCHFORK (daemon manager)",
	"MCP TOKENS",
	"DEPLOY (Cloudflare)",
	"PLUGIN DEVELOPMENT",
	"SKILLS (Claude Code agent skills)",
	"EMDASH CLI",
	'REGISTRY (the plugin "marketplace" — emdash\'s aggregator, run locally)',
	"PLUGINS SITE (the registry's web UI — plugins.emdashcms.com)",
];

const byTitle = new Map(sections.map((section) => [section.title, section.body]));
const missing = order.filter((title) => !byTitle.has(title));
const unexpected = [...byTitle.keys()].filter((title) => !order.includes(title));
if (missing.length > 0 || unexpected.length > 0) {
	console.error("refusing to write — section titles do not match:");
	if (missing.length > 0) console.error("  missing:", missing);
	if (unexpected.length > 0) console.error("  unexpected:", unexpected);
	process.exit(1);
}

const out = [preamble.trimEnd(), ...order.map((title) => byTitle.get(title).trimEnd())].join("\n\n");
fs.writeFileSync(path, `${out}\n`);
console.log(`reordered ${order.length} sections in ${path}`);
