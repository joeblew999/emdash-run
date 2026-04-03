#!/usr/bin/env node
/**
 * patch-plugin.mjs
 *
 * Links the local plugin/ package into the emdash pnpm workspace after a
 * git reset. Run from the repo root — called by mise run server:build.
 *
 * Usage: node scripts/patch-plugin.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMDASH_DIR = join(ROOT, "emdash");
const HOST_DIR = join(EMDASH_DIR, "demos", "plugins-demo");

// 1. Patch pnpm-workspace.yaml to include ../plugin
const wsPath = join(EMDASH_DIR, "pnpm-workspace.yaml");
let wsContent = readFileSync(wsPath, "utf8");
if (!wsContent.includes("../plugin")) {
	// Insert into the packages: block, before the blank line that follows it
	wsContent = wsContent.replace(
		/^(packages:(?:\n  - .+)+)/m,
		"$1\n  - '../plugin'",
	);
	writeFileSync(wsPath, wsContent);
	console.log("  ✓ Added ../plugin to pnpm-workspace.yaml");
} else {
	console.log("  ~ ../plugin already in pnpm-workspace.yaml");
}

// 2. Patch plugins-demo package.json to add the workspace dep
const pkgPath = join(HOST_DIR, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
if (!pkg.dependencies["@plat-trunk/emdash-plugin"]) {
	pkg.dependencies["@plat-trunk/emdash-plugin"] = "workspace:*";
	writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n");
	console.log("  ✓ Added @plat-trunk/emdash-plugin to plugins-demo deps");
} else {
	console.log("  ~ @plat-trunk/emdash-plugin already in plugins-demo deps");
}
