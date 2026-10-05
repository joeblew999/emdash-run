#!/usr/bin/env node
/**
 * clean-tokens.mjs
 *
 * Revokes all API tokens (or tokens matching a name filter).
 * Uses dev-bypass session auth — localhost only.
 *
 * Usage:
 *   node scripts/clean-tokens.mjs           ← revoke ALL tokens
 *   node scripts/clean-tokens.mjs mcp-dev   ← revoke tokens named "mcp-dev"
 *   node scripts/clean-tokens.mjs mcp-user  ← revoke tokens named "mcp-user"
 */

const URL_BASE = "http://localhost:4321";
const nameFilter = process.argv[2] || null;  // empty string → no filter (revoke all)

async function main() {
  // Step 1 — setup/dev-bypass: idempotent; creates dev user if needed, returns session
  const bypassRes = await fetch(`${URL_BASE}/_emdash/api/setup/dev-bypass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!bypassRes.ok) {
    console.error(`setup/dev-bypass failed: ${bypassRes.status}`);
    process.exit(1);
  }
  const cookies = bypassRes.headers.getSetCookie?.() ?? [];
  if (cookies.length === 0) {
    console.error("No session cookie — is the server running?");
    process.exit(1);
  }
  const cookieHeader = cookies.map((c) => c.split(";")[0].trim()).join("; ");
  const headers = {
    "Content-Type": "application/json",
    "X-EmDash-Request": "1",
    Cookie: cookieHeader,
  };

  // Step 2 — list tokens
  const listRes = await fetch(`${URL_BASE}/_emdash/api/admin/api-tokens`, { headers });
  if (!listRes.ok) {
    console.error(`List tokens failed: ${listRes.status}`);
    process.exit(1);
  }
  const { data } = await listRes.json();
  const all = data?.items ?? [];
  const targets = nameFilter ? all.filter((t) => t.name === nameFilter) : all;

  if (targets.length === 0) {
    console.log(`No tokens${nameFilter ? ` named "${nameFilter}"` : ""} to revoke.`);
    return;
  }

  console.log(`→ Revoking ${targets.length} token(s)${nameFilter ? ` named "${nameFilter}"` : ""}...`);

  // Step 3 — delete each
  let revoked = 0;
  for (const t of targets) {
    const res = await fetch(`${URL_BASE}/_emdash/api/admin/api-tokens/${t.id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      revoked++;
      console.log(`  ✓ ${t.name} (${t.prefix}...)`);
    } else {
      console.error(`  ✗ ${t.name} (${t.prefix}...) → ${res.status}`);
    }
  }
  console.log(`✓ Revoked ${revoked}/${targets.length} tokens`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
