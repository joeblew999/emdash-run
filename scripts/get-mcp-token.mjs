#!/usr/bin/env node
/**
 * get-mcp-token.mjs
 *
 * Gets an EmDash MCP API token via dev-bypass (localhost only).
 *
 * Usage:
 *   node scripts/get-mcp-token.mjs admin
 *   node scripts/get-mcp-token.mjs user
 *
 * Outputs the raw token to stdout.
 * The caller (mise task) saves it to run/token-admin.txt or run/token-user.txt
 */

const URL_BASE = "http://localhost:4321";

const SCOPES = {
  admin: ["admin"],
  user: ["content:read", "content:write", "media:read", "media:write"],
};

const NAME = {
  admin: "token-admin",
  user: "token-user",
};

async function main() {
  const kind = process.argv[2];
  if (!SCOPES[kind]) {
    console.error("Usage: node scripts/get-mcp-token.mjs admin|user");
    process.exit(1);
  }

  // Step 1 — setup/dev-bypass: idempotent; creates dev user + marks setup complete if needed
  const bypassRes = await fetch(`${URL_BASE}/_emdash/api/setup/dev-bypass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!bypassRes.ok) {
    console.error(`setup/dev-bypass failed: ${bypassRes.status}`);
    process.exit(1);
  }

  // Collect all Set-Cookie headers
  const cookies = bypassRes.headers.getSetCookie?.() ?? [];
  if (cookies.length === 0) {
    console.error("No cookies returned from dev-bypass — is the server running?");
    process.exit(1);
  }

  // Build cookie string: strip attributes, keep name=value only
  const cookieHeader = cookies
    .map((c) => c.split(";")[0].trim())
    .join("; ");

  const sessionHeaders = {
    "Content-Type": "application/json",
    "X-EmDash-Request": "1",
    Cookie: cookieHeader,
  };

  // Step 2 — delete any existing tokens with the same name (idempotency)
  const listRes = await fetch(`${URL_BASE}/_emdash/api/admin/api-tokens`, {
    headers: sessionHeaders,
  });
  if (listRes.ok) {
    const listBody = await listRes.json();
    const existing = (listBody?.data?.items ?? []).filter(
      (t) => t.name === NAME[kind]
    );
    for (const t of existing) {
      await fetch(`${URL_BASE}/_emdash/api/admin/api-tokens/${t.id}`, {
        method: "DELETE",
        headers: sessionHeaders,
      });
    }
    if (existing.length > 0) {
      process.stderr.write(`→ Revoked ${existing.length} existing ${NAME[kind]} token(s)\n`);
    }
  }

  // Step 3 — create API token using the session cookie
  const tokenRes = await fetch(`${URL_BASE}/_emdash/api/admin/api-tokens`, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      name: NAME[kind],
      scopes: SCOPES[kind],
    }),
  });

  const body = await tokenRes.json();

  if (!tokenRes.ok || !body?.data?.token) {
    console.error(`Token creation failed (${tokenRes.status}):`, JSON.stringify(body));
    process.exit(1);
  }

  process.stdout.write(body.data.token);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
