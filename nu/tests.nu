# Unit tests for the pure logic. Run by `mise run check`; needs no site and no settings.
use std/assert
use lib.nu [split-args wait-for request]
use site.nu
use plugin.nu

let fixtures = ($env.FILE_PWD | path join "fixtures")
let template = (open ($fixtures | path join "template.json"))
let project = (open ($fixtures | path join "project.json"))
let order = ["projects" "assemblies" "parts"]
let merged = (site merge-seeds $template $project $order "CAD")

# The whole merge, byte for byte: the fixtures give every rule a case.
assert equal ($merged | to json --indent 4) (open --raw ($fixtures | path join "expected.json") | str trim)

# The rules by name, so a failure says which one broke.
assert equal ($merged.collections | where slug == "posts" | first | get label) "Posts (template)" "a collection collision goes to the template"
assert equal ($merged.taxonomies | where name == "category" | first | get label) "Category (template)" "a taxonomy collision goes to the template"
assert equal ($merged.content.posts | where id == "posts:shared" | first | get data.title) "Shared (project)" "a content collision goes to the project"
assert equal ($merged.content | columns | first 3) $order "content is ordered dependency-first"
assert equal ($merged.menus | first | get name) "primary" "menus come from the template"
assert equal ($merged.widgetAreas | first | get name) "sidebar" "widget areas fall back to the project"
assert equal $merged.version "1" "the version is the template's"
assert equal $merged.meta.name "Starter + CAD" "the label is appended to the site name"

# A project with no seed of its own runs on the template's.
let alone = (site merge-seeds $template {} [] "")
assert equal $alone.meta.name "Starter" "no label leaves the site name alone"
assert equal ($alone.collections | get slug) ($template.collections | get slug) "no project seed keeps the template's collections"
assert equal ($alone.content.posts | length) 2 "no project seed keeps the template's content"

# Keys the merge does not know about pass through instead of being dropped.
let extra = (site merge-seeds ($template | insert somethingNew [{id: "t"}]) ($project | insert alsoNew {on: true}) $order "CAD")
assert equal $extra.somethingNew [{id: "t"}] "an unknown key in the template's seed survives"
assert equal $extra.alsoNew {on: true} "an unknown key in the project's seed survives"
assert equal (site merge-seeds ($template | insert bylines [{id: "editorial"}]) $project $order "CAD").bylines [{id: "editorial"}] "the template's bylines survive"

# Task arguments, as mise hands them over: one shell-quoted string.
assert equal (split-args "") [] "no arguments"
assert equal (split-args "alpha 'two words' '{\"k\":1}' --dry") ["alpha" "two words" '{"k":1}' "--dry"] "quoted arguments and flags"
assert equal (split-args "'it'\\''s' 'say \"hi\"'") ["it's" 'say "hi"'] "a quote inside an argument"
assert equal (split-args "a   b") ["a" "b"] "runs of spaces"

# Waits are bounded, and a request to nothing reports status 0 rather than throwing.
let before = (date now)
assert equal (wait-for "http://127.0.0.1:9/" 2) false "waiting on a dead port gives up"
assert (((date now) - $before) < 40sec) "…within its limit"
assert equal (request GET "http://127.0.0.1:9/" --timeout 1sec).status 0 "a dead port is status 0, not an exception"

# Keyed lists are unioned, so a project's redirect survives a template that has redirects.
let lists = (site merge-seeds ($template | insert redirects [{source: "/a", destination: "/t"} {source: "/b", destination: "/t"}]) ($project | insert redirects [{source: "/a", destination: "/p"} {source: "/c", destination: "/p"}]) $order "CAD")
assert equal ($lists.redirects | get source | sort) ["/a" "/b" "/c"] "redirects from both seeds are kept"
assert equal ($lists.redirects | where source == "/a" | first | get destination) "/t" "a redirect collision goes to the template"

# Plugin registration.
assert equal (plugin registration []) "// GENERATED from plugins/ by the harness — do not edit.\n/** @type {any[]} */\nexport const sandboxed = [];\n" "no plugins is an empty list"
let two = (plugin registration ["zeta" "@scope/alpha"])
assert ($two | str contains 'import local0 from "@scope/alpha";') "plugins are imported in sorted order"
assert ($two | str contains 'export const sandboxed = [local0, local1];') "every plugin is registered"

print "  ✓ 27 unit tests"
