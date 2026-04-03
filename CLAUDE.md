Use mise and pitchfork to do everything. Keep them in sync.

Make sure it all works — dogfood it yourself and verify.

Use the EMDash MCP to work with content. Use Playwright MCP to validate the Web GUI.

See README.md for setup order, daily workflow, and what to run when things break.

These help too:

https://mise.jdx.dev/schema/mise.json
https://pitchfork.jdx.dev/schema.json 


EmDash has its own CLAUDE.md at emdash/.claude/CLAUDE.md — read it for EmDash-specific guidance.

Architecture decisions are in docs/adr/ — read them before making structural changes.

Skills in `.claude/skills/` are automatically loaded. On a fresh clone, run `mise run skills:restore` to reinstall marketplace skills, then `mise run skills:sync:emdash` to symlink the emdash skills. Or run `mise run skills:add:all` to do both at once.
