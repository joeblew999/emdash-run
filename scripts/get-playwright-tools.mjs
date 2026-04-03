#!/usr/bin/env node
/**
 * get-playwright-tools.mjs
 *
 * Spawns the Playwright MCP server via stdio, sends tools/list,
 * and prints tool names to stdout (one per line).
 */

import { spawn } from "child_process";

const npx = process.env.NPX_BIN || "npx";

const server = spawn(npx, ["@playwright/mcp@latest"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env },
});

let buf = "";

server.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  const lines = buf.split("\n");
  buf = lines.pop(); // keep incomplete line
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1 && msg.result?.tools) {
        for (const t of msg.result.tools) {
          process.stdout.write(t.name + "\n");
        }
        server.kill();
        process.exit(0);
      }
    } catch {
      // not JSON yet, ignore
    }
  }
});

// Wait briefly for server to be ready, then send tools/list
setTimeout(() => {
  const req = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  server.stdin.write(req + "\n");
}, 1500);

setTimeout(() => {
  console.error("✗ Timeout waiting for playwright MCP tools/list");
  server.kill();
  process.exit(1);
}, 10000);
