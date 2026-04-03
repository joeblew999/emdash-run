#!/usr/bin/env node
/**
 * emdash.mjs
 *
 * Appends --url after user args so the CLI parses them correctly.
 * The CLI auto-uses dev-bypass for localhost — no token needed.
 *
 * Usage: node scripts/emdash.mjs content list projects
 */

import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "emdash/packages/core/dist/cli/index.mjs");

const args = [...process.argv.slice(2), "--url", "http://localhost:4321"];

const child = spawn(process.execPath, [CLI, ...args], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
