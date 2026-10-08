# For agents

Everything about this repo is in [docs/](docs/README.md), the same pages developers read. Nothing is kept here, so there is one source of truth. The same index for machines: https://joeblew999.github.io/emdash-run/llms.txt

Read, in this order:

1. [docs/README.md](docs/README.md): what this is, the map, and the index of every page.
2. [docs/rules.md](docs/rules.md): the working rules. They are binding.
3. [docs/reference/status.md](docs/reference/status.md): what works at this commit, task by task. Then the open issues: `mise run issues`.
4. The page for the part you are changing, from the index.
5. [docs/writing.md](docs/writing.md) before you write or change a page in `docs/`.

When you learn or change something, write it in the page in `docs/` it belongs to, and run `mise run docs:lint`. Don't add README files elsewhere.
