---
title: Seed files
nav_order: 4
parent: Guides
---

# Seed files: fill a running site from one

A seed file is EmDash's own way to say what a site is made of, in one JSON file ([its schema](https://emdashcms.com/seed.schema.json)). EmDash applies one only to an empty database. `site:seed` applies one to a site that is running and has content in it.

```sh
mise run site:seed                    # the site's own seed file
mise run site:seed -- more.json       # another: a relative path is from the project's folder
```

With no file it takes the site's own, where EmDash looks for one: `.emdash/seed.json`, the file `emdash.seed` in the site's `package.json` names, or `seed/seed.json`.

Each thing the file names is made if it is not there and left alone if it is. One line per section says what was made and what was already there; a `skip` line says what was not applied; a `FAIL` line says what the site answered, and the task then fails. What is applied, section by section: [`site:seed`](../reference/tasks.md#siteseed).

It acts on this machine's built site and no other: [This machine or deployed](local-or-deployed.md#three-tasks-never-act-on-a-deployed-site).

## A set-up of your own

[`site:demo`](../reference/tasks.md#sitedemo) applies [`seeds/demo.json`](https://github.com/joeblew999/emdash-run/blob/main/seeds/demo.json), a small site with something in every section but relations and block types. Copy that file into your repo, change it, and apply it with `site:seed`.

`site:demo` itself is for a site with nothing of its own: it replaces the site's title, tagline, social links and what robots are told with the demo's.

## What is not applied

`site:seed` adds: a thing that is already there is left as it is, and nothing is removed. A setting the site has is the site's own. Three things that are there are changed to what the file says:

- **A collection:** comments on or off, and the fields the admin lists its entries by.
- **An entry that is a draft never published,** where the file has it published: it is published. `site:seed` cannot tell an entry a run left half made from a draft of your own with that slug.
- **An entry with an empty picture field,** where the file names a picture for it: the picture is fetched and put there.

| In the file | What happens |
|---|---|
| A key that is not EmDash's seed format | Not applied |
| `blockTypes` | Not applied: the file gives each as its versions, and the API makes one from a single list of fields |
| A translation: a taxonomy, a term, an entry, a menu or a menu item with `translationOf` | Not applied |
| A term's `locale` | The term is made in the site's own language |
| A byline's `avatar` | The byline is made without it |
| An entry with no `slug` | Not applied: it could not be found again |
| A picture inside a body, as a `$media` in one of its blocks | The entry is made without that block. A picture that is a field's whole value is fetched and uploaded |
| A widget's `settings` | Not applied, as in EmDash's own seeding: a widget's options go in `props` |
| A section with no `source`, or marked as a theme's | Made as an editor's: the API takes an editor's or an import's only |
| A menu item's `locale`, and the file's `defaultLocale` | Not applied |

The last two rows have no `skip` line. Every other row is said in one.

## What a seed file cannot say

- **A logo, a favicon, or the picture a shared link is shown with.** The format has a key for each, and each takes the id a picture has in the site's library, which a file cannot know.
- **An entry's title and description for search engines, or the day a draft is to be published.** The format is closed: its schema allows no key it does not name, and it names none for these.
- **Whether comments wait for approval, a visitor's comment, a revision, an API token, a backup.** The same.

`site:demo` makes those in code for the demo, all but the logo (`scripts/core/demo.mjs`). On a site of your own they are set in the admin: `mise run site:status` says where for some of them, once this machine is signed in to the running built site.

## Limits

- No task turns a running site back into a seed file, and EmDash's own `emdash export-seed` cannot reach a Cloudflare site's local database ([Upstream issues](../upstream.md)).
- Nothing combines two seed files: `site:seed` takes one.
- Pictures are fetched from their addresses: it needs the internet.
- The test step applies the site's own file. A file given by name is covered by a unit test, not by a run on a real site.
