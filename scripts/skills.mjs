#!/usr/bin/env node
import { createHash } from "node:crypto";
/**
 * `mise run skills:<sub>` — the skills CLI, plus the EmDash skills the site ships.
 *
 * The EmDash skills live in **two** places, for two reasons:
 *
 *   `.github/skills/<name>/`   COMMITTED, and the one that matters. VS Code Copilot reads
 *                              `.github/skills/`, and — the reason this exists — skills are
 *                              discovered when a session **starts**. `.claude/skills/` is
 *                              gitignored, so on a fresh clone the link does not exist yet,
 *                              and an agent that starts before anyone has run `skills:sync`
 *                              has no EmDash knowledge at all. That is not hypothetical: it
 *                              happened, and a whole session went into rediscovering
 *                              `export-seed`, `site import` and the file-vs-D1 database trap
 *                              by trial and error while these skills sat on disk unread.
 *
 *   `.claude/skills/emdash`    a SYMLINK, for Claude Code. Deliberately not committed: it
 *                              points into gitignored `.src/`, so it would be broken on any
 *                              other clone.
 *
 * The vendored copy can drift from the site when the template or `EMDASH_VERSION` changes,
 * so `check` compares the two trees and `repo:check` fails when they differ.
 */
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
} from "node:fs";
import { join, relative } from "node:path";

import { env, sh } from "./lib/exec.mjs";

const ROOT = env("ROOT");
const SITE_DIR = env("SITE_DIR");
const VENDOR_DIR = `${ROOT}/.github/skills`;
const sub = process.argv[2];
const arg = process.argv[3];

/** The skills CLI has no "restrict agents" flag, so it also writes other agents' dirs. */
const NON_CLAUDE_DIRS = [".crush", ".goose", ".cursor", ".augment", ".continue", ".codebuddy"];

/** Where the site ships its skills. `.claude/skills` first, `.agents/skills` as the fallback. */
function shippedSkillsDir() {
	if (existsSync(`${SITE_DIR}/.claude/skills`)) return `${SITE_DIR}/.claude/skills`;
	if (existsSync(`${SITE_DIR}/.agents/skills`)) return `${SITE_DIR}/.agents/skills`;
	return null;
}

/** Every file under `dir`, as `relativePath → sha256`, so two trees can be compared. */
function hashTree(dir) {
	const out = new Map();
	const walk = (current) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const full = join(current, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.isFile()) {
				out.set(relative(dir, full), createHash("sha256").update(readFileSync(full)).digest("hex"));
			}
		}
	};
	if (existsSync(dir) && statSync(dir).isDirectory()) walk(dir);
	return out;
}

function syncEmdash() {
	const src = shippedSkillsDir();
	if (!src) {
		console.log(`  ⚠ no shipped skills found in ${SITE_DIR} (.claude/skills or .agents/skills)`);
		return;
	}

	// 1. Vendor a real, committed copy where Copilot will find it at session start.
	const names = readdirSync(src, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.toSorted();
	rmSync(VENDOR_DIR, { recursive: true, force: true });
	mkdirSync(VENDOR_DIR, { recursive: true });
	for (const name of names) cpSync(`${src}/${name}`, `${VENDOR_DIR}/${name}`, { recursive: true });
	console.log(`  ✓ ${names.length} EmDash skills vendored → .github/skills/ (committed)`);

	// 2. Symlink for Claude Code. A RELATIVE target: the link lives at .claude/skills/emdash,
	// so the target is always ../../.src/site/… — an absolute one would break on another clone.
	mkdirSync(`${ROOT}/.claude/skills`, { recursive: true });
	const rel = src.includes(".agents/")
		? "../../.src/site/.agents/skills"
		: "../../.src/site/.claude/skills";
	rmSync(`${ROOT}/.claude/skills/emdash`, { recursive: true, force: true });
	symlinkSync(rel, `${ROOT}/.claude/skills/emdash`);
	console.log(`  ✓ .claude/skills/emdash → ${rel}`);
}

/** Fail if the committed copy has drifted from what the site ships. */
function check() {
	const src = shippedSkillsDir();
	if (!src) {
		console.log(`  ⚠ no shipped skills to compare against — run: mise run site:setup`);
		return;
	}

	const shipped = hashTree(src);
	const vendored = hashTree(VENDOR_DIR);
	const problems = [];

	for (const [path, hash] of shipped) {
		if (!vendored.has(path)) problems.push(`missing from .github/skills: ${path}`);
		else if (vendored.get(path) !== hash) problems.push(`differs: ${path}`);
	}
	for (const path of vendored.keys()) {
		if (!shipped.has(path)) problems.push(`not shipped by the site: ${path}`);
	}

	if (problems.length > 0) {
		console.error(`skills:check — .github/skills has drifted from ${relative(ROOT, src)}:`);
		for (const problem of problems.slice(0, 20)) console.error(`  - ${problem}`);
		console.error("  fix: mise run skills:sync");
		process.exit(1);
	}
	console.log(`  ✓ ${vendored.size} vendored skill files match the site's`);
}

switch (sub) {
	case "sync":
		syncEmdash();
		break;
	case "check":
		check();
		break;
	case "add-all":
		syncEmdash();
		sh(`skills add kinoward/agent-skills/mise-guide --yes --agents "Claude Code"`);
		for (const dir of NON_CLAUDE_DIRS) rmSync(`${ROOT}/${dir}`, { recursive: true, force: true });
		console.log("  ✓ non-Claude agent dirs removed");
		break;
	case "find":
		sh(`skills find "${arg}"`);
		break;
	case "add":
		sh(`skills add "${arg}" --yes --agents "Claude Code"`);
		break;
	case "remove":
		sh(`skills remove "${arg}" --yes`);
		break;
	case "remove-all":
		sh("skills remove --all --yes");
		break;
	case "update":
		sh("skills update");
		break;
	case "restore":
		sh("skills experimental_install");
		break;
	case "list":
		sh("skills list");
		break;
	default:
		console.error(`skills: unknown subcommand "${sub}"`);
		process.exit(1);
}
