#!/usr/bin/env node
/**
 * `mise run skills:<sub>` — the skills CLI, plus the EmDash skill symlink.
 *
 * `.claude/skills/emdash` points at the skills the site ships, so they track the template
 * version instead of being copied.
 */
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";

import { env, sh } from "./lib/exec.mjs";

const ROOT = env("ROOT");
const SITE_DIR = env("SITE_DIR");
const sub = process.argv[2];
const arg = process.argv[3];

/** The skills CLI has no "restrict agents" flag, so it also writes other agents' dirs. */
const NON_CLAUDE_DIRS = [".crush", ".goose", ".cursor", ".augment", ".continue", ".codebuddy"];

function syncEmdash() {
	mkdirSync(`${ROOT}/.claude/skills`, { recursive: true });
	// A RELATIVE target: the link lives at .claude/skills/emdash, so the target is always
	// ../../.src/site/…. An absolute symlink would break on any other clone, and pointing
	// into a gitignored dir means it must never be committed.
	let rel = "";
	if (existsSync(`${SITE_DIR}/.claude/skills`)) rel = "../../.src/site/.claude/skills";
	else if (existsSync(`${SITE_DIR}/.agents/skills`)) rel = "../../.src/site/.agents/skills";
	if (!rel) {
		console.log(`  ⚠ no shipped skills found in ${SITE_DIR} (.claude/skills or .agents/skills)`);
		return;
	}
	rmSync(`${ROOT}/.claude/skills/emdash`, { recursive: true, force: true });
	symlinkSync(rel, `${ROOT}/.claude/skills/emdash`);
	console.log(`  ✓ .claude/skills/emdash → ${rel}`);
}

switch (sub) {
	case "sync-emdash":
		syncEmdash();
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
