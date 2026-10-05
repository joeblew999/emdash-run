#!/usr/bin/env node
/** `mise run mcp:token-admin | mcp:token-user | mcp:clean-tokens` */
import { mkdirSync, writeFileSync } from "node:fs";

import { env, out, run } from "./lib/exec.mjs";

const ROOT = env("ROOT");
const RUN_DIR = env("RUN_DIR");
const sub = process.argv[2];

mkdirSync(RUN_DIR, { recursive: true });

if (sub === "token-admin" || sub === "token-user") {
	const admin = sub === "token-admin";
	const token = out("node", [`${ROOT}/scripts/get-mcp-token.mjs`, admin ? "admin" : "user"]);
	if (admin) {
		// admin token = full access (content, schema, media, taxonomy, plugins)
		writeFileSync(`${RUN_DIR}/token-admin.txt`, `${token}\n`);
		// _.file in mise.toml loads this into the environment for the EmDash MCP server.
		writeFileSync(`${RUN_DIR}/token-admin.env`, `EMDASH_TOKEN=${token}\n`);
		console.log("✓ Token saved → run/token-admin.txt");
	} else {
		writeFileSync(`${RUN_DIR}/token-user.txt`, `${token}\n`);
		console.log("✓ Token saved → run/token-user.txt");
	}
} else if (sub === "clean-tokens") {
	run("node", [`${ROOT}/scripts/clean-tokens.mjs`]);
} else {
	console.error(`mcp: unknown subcommand "${sub}" (token-admin|token-user|clean-tokens)`);
	process.exit(1);
}
