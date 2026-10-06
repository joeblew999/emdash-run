# plugins/

Local plugins live here, one directory each. Do not create one by hand:

```
mise run plugin:new -- <name>      scaffold it with the official CLI, fit it to this site, load it
mise run plugin:probe -- <name>    ask the RUNNING site to call it
mise run plugin:remove -- <name>   take it out again
mise run plugin:roundtrip          all three with a throwaway plugin — proves the toolchain works
```

A directory with an `emdash-plugin.jsonc` is a sandboxed plugin and is registered with the site
automatically. See `docs/plugin.md`. After editing one: `mise run dev`.
