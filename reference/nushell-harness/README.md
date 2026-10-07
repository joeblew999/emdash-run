# The nushell harness — reference only

What this repo was until 2026-10-07: about 1,800 lines of nushell behind 32 mise tasks, copied into
each project. It is not loaded, not tested and not maintained. It is kept because it records the
places EmDash 1.1.0 needed help — the plugin scaffold's wrong versions, seeded images on a
Cloudflare site, the local database's hashed file name — each of which is a candidate gap for a
stage in `docs/plans/done/2026-10-07-stages.md`.

What replaced it is `tasks.toml` at the repo root: EmDash's own commands, in order, as mise tasks.
