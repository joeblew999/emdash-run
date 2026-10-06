#!/usr/bin/env node
/**
 * `mise run mise:reorder | mise:check` — maintenance for mise.toml itself.
 *
 *   reorder  Reorder the sections (core first, optional extras last). Refuses to write
 *            unless the section-title set matches exactly, so a section cannot be dropped.
 *   check    Assert the 1:1 mapping between mise namespaces and scripts/<namespace>.mjs.
 *            Strict noun:verb — every namespace has exactly one script of the same name,
 *            and every top-level script is a namespace (helpers live in scripts/lib/).
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

import { env } from "./lib/exec.mjs";

const ROOT = env("ROOT");
const MISE = `${ROOT}/mise.toml`;
const sub = process.argv[2];

function reorder() {
	const lines = readFileSync(MISE, "utf8").split("\n");
	const starts = [];
	for (let i = 0; i < lines.length; i++) {
		if (/^# -{20,}$/.test(lines[i]) && /^# \S/.test(lines[i + 1] ?? "")) starts.push(i);
	}
	if (starts.length === 0) throw new Error(`no section banners found in ${MISE}`);

	const preamble = lines.slice(0, starts[0]).join("\n");
	const sections = starts.map((start, index) => {
		const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
		return {
			title: lines[start + 1].replace(/^# /, ""),
			body: lines.slice(start, end).join("\n"),
		};
	});

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

	const out = [preamble.trimEnd(), ...order.map((title) => byTitle.get(title).trimEnd())].join(
		"\n\n",
	);
	writeFileSync(MISE, `${out}\n`);
	console.log(`reordered ${order.length} sections in mise.toml`);
}

function check() {
	// The rule that matters is not "every namespace has a script" — most tasks should be inline
	// shell in mise.toml, and only a namespace whose tasks actually CALL a script needs one.
	// So: a referenced script must exist, and a script must be referenced. Inline tasks are fine.
	const miseText = readFileSync(MISE, "utf8");
	const referenced = new Set(
		[...miseText.matchAll(/scripts\/([A-Za-z0-9_-]+)\.mjs/g)].map((match) => match[1]),
	);
	const scripts = readdirSync(`${ROOT}/scripts`, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
		.map((entry) => entry.name.replace(/\.mjs$/, ""));

	const problems = [];
	for (const name of referenced) {
		if (!scripts.includes(name))
			problems.push(`mise.toml calls scripts/${name}.mjs, which does not exist`);
	}
	for (const name of scripts) {
		if (!referenced.has(name)) problems.push(`scripts/${name}.mjs is not called by any task`);
	}

	if (problems.length > 0) {
		console.error("mise/scripts mapping is broken:");
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log(`✓ ${scripts.length} scripts, every one referenced by mise.toml`);
}

if (sub === "reorder") reorder();
else if (sub === "check") check();
else {
	console.error(`mise: unknown subcommand "${sub}" (reorder|check)`);
	process.exit(1);
}
