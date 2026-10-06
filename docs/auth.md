# Auth Design Notes

## EmDash auth system (from source)

### Roles (numeric hierarchy)
- SUBSCRIBER  10
- CONTRIBUTOR 20
- AUTHOR      30
- EDITOR      40
- ADMIN       50

Single integer on the User record. Authorization is `user.role >= threshold`.

### Two auth paths

**Session auth (browser)**
WebAuthn passkey → session ID in cookie → looked up on each request.
Full implicit access, no scope restrictions.

**API token auth (programmatic)**
Prefixed tokens (`ec_pat_` `ec_oat_` `ec_ort_`), SHA-256 hashed, never stored raw.
Tokens carry explicit scopes. The `admin` scope bypasses all scope checks.
`clampScopes()` at token issuance — you cannot issue yourself scopes your role does not permit.

### Token scopes
- `content:read`
- `content:write`
- `media:read`
- `media:write`
- `schema:read`
- `schema:write`
- `taxonomies:manage`
- `menus:manage`
- `settings:read`
- `settings:manage`
- `mcp:tools`
- `transfer:export`
- `transfer:analyze`
- `transfer:execute`
- `admin`

### OAuth server
Full OAuth 2.0 — authorization code flow, device flow, PKCE, token refresh/revoke.
Used by the CLI and MCP server.

### Dev bypass (localhost only)
`POST /_emdash/api/auth/dev-bypass`
Creates a dev admin user (`dev@emdash.local`) and sets an Astro session.
Only works when `import.meta.env.DEV` is true.
The harness signs in through `POST /_emdash/api/setup/dev-bypass`, which also completes first-time setup.

## Our token strategy

| Token | Scopes | Who |
|-------|--------|-----|
| token-admin | `admin` | AI agents, devs, Claude Code (minted by `mise run dev` into `run/token-admin.txt`) |
| token-user | `content:read content:write media:read media:write` | Max, end users (create in the admin, or `mise run emdash -- …`) |
| ricos | `content:read media:read` | Fukumitsu / RICOS API access |

## The authZ gap we filed as an issue

Issue #52 on emdash-cms/emdash.

The 4-role model (Admin/Editor/Author/Contributor) is too coarse for CAD.
We need resource-level permissions:
- "Alice can edit assembly X but not assembly Y"
- "Agent can write to this part record only"
- Permissions following the assembly hierarchy

A Zanzibar-style tuple model (subject, relation, object) would address this.
Proof of concept: https://github.com/joeblew999/zanzojs/blob/feat/better-auth-plugin/examples/workspace-d1/README.md
