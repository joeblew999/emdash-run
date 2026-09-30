#!/usr/bin/env node
/**
 * find-plugins.mjs
 *
 * Discover EmDash CMS plugins on GitHub and write a catalog under
 * docs/plugin-catalog/ (plugins.json + INDEX.md + per-plugin stubs).
 *
 * Auth:
 *   Reads GITHUB_TOKEN (or GH_TOKEN) from env. With fnox:
 *     fnox exec -- mise run plugins:catalog
 *   No token works (60 req/hr unauth, hits the wall fast).
 *
 * Usage (via mise):
 *   mise run plugins:catalog          ← discover + write
 *   mise run plugins:catalog:dry      ← print JSON to stdout, no files
 *   mise run plugins:catalog:full     ← include README excerpts (slower)
 *
 * Direct:
 *   node scripts/find-plugins.mjs [--dry] [--readmes] [--include-empty]
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.ROOT || process.cwd();
const OUT_DIR = path.join(ROOT, "docs", "plugin-catalog");
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const DRY = process.argv.includes("--dry");
const FETCH_READMES = process.argv.includes("--readmes");
const INCLUDE_EMPTY = process.argv.includes("--include-empty");

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "emdash-run/find-plugins",
};
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(endpoint, accept) {
  const url = endpoint.startsWith("http") ? endpoint : `https://api.github.com${endpoint}`;
  const h = accept ? { ...headers, Accept: accept } : headers;
  const res = await fetch(url, { headers: h });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status} on ${endpoint}: ${body.slice(0, 200)}`);
  }
  return accept === "application/vnd.github.raw" ? res.text() : res.json();
}

async function searchRepos(query, perPage = 100) {
  const all = [];
  for (let page = 1; page <= 3; page++) {
    const params = new URLSearchParams({
      q: query,
      per_page: String(perPage),
      page: String(page),
    });
    const resp = await gh(`/search/repositories?${params}`);
    all.push(...resp.items);
    if (resp.items.length < perPage) break;
    await sleep(TOKEN ? 2100 : 6500);
  }
  return all;
}

const CATEGORY_RULES = [
  [/seo|search.console|llms\.txt|json-?ld/, "seo"],
  [/email|mail|smtp|resend|postmark|lettermint|sendgrid/, "email"],
  [/analytics|tracking|gtm|ga4|insights|reading.time/, "analytics"],
  [/commerce|shop|stripe|membership|paywall|x402/, "commerce"],
  [/lms|course|quiz|certificate|learn/, "lms"],
  [/slack|discord|teams|notif|webhook/, "communication"],
  [/social|share|buffer|bluesky|mastodon/, "social"],
  [/i18n|locale|multilingual|japanese|admin-ja/, "i18n"],
  [/ai|rag|llm|inject|moderation/, "ai"],
  [/trust|sensitive|leak|security|audit/, "trust"],
  [/static|export|deploy|build.hook/, "deployment"],
  [/forum|wiki|comments/, "community"],
  [/calendar|ics|ical/, "calendar"],
  [/tenant|multitenant|adapter|infra/, "infrastructure"],
  [/theme|template/, "theme"],
  [/registry|awesome|catalog|render/, "ecosystem"],
  [/form|contact/, "forms"],
  [/syntax|highlight|block|embed|color|widget|cover/, "blocks"],
];

function categorize(repo) {
  const blob = `${repo.full_name} ${repo.description ?? ""} ${(repo.topics ?? []).join(" ")}`.toLowerCase();
  for (const [pat, cat] of CATEGORY_RULES) if (pat.test(blob)) return cat;
  return "other";
}

function isPluginish(repo) {
  const name = repo.full_name.toLowerCase();
  const desc = (repo.description ?? "").toLowerCase();
  const topics = (repo.topics ?? []).map((t) => t.toLowerCase());
  if (/plugin|theme|adapter|render/.test(name)) return true;
  if (topics.includes("emdash-plugin")) return true;
  if (
    /plugin|extension|adapter|widget|theme/.test(desc) &&
    /emdash/.test(desc + name + topics.join(" "))
  )
    return true;
  if (name.startsWith("emdash-cms/") && !name.endsWith("/emdash")) return true;
  if (/awesome-emdash|emdashcms-org|emdash-render/.test(name)) return true;
  return false;
}

async function fetchReadmeExcerpt(fullName) {
  try {
    const text = await gh(`/repos/${fullName}/readme`, "application/vnd.github.raw");
    return text
      .split("\n")
      .filter((l) => !l.startsWith("![") && !l.startsWith("[!") && !l.startsWith(">"))
      .map((l) => l.replace(/^#+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" ")
      .slice(0, 280);
  } catch {
    return undefined;
  }
}

const QUERIES = [
  "topic:emdash",
  "topic:emdash-plugin",
  "topic:emdash-cms",
  "emdash-plugin in:name",
  "emdash plugin in:description",
  "emdash adapter in:description",
  "emdash theme in:description",
];

async function main() {
  console.error(`→ find-plugins  auth=${TOKEN ? "yes" : "no"}  out=${OUT_DIR}`);

  const seen = new Map();
  for (const q of QUERIES) {
    try {
      console.error(`  query: ${q}`);
      const repos = await searchRepos(q);
      for (const r of repos) {
        const e = seen.get(r.full_name);
        if (e) e.queries.add(q);
        else seen.set(r.full_name, { repo: r, queries: new Set([q]) });
      }
      await sleep(TOKEN ? 2100 : 6500);
    } catch (err) {
      console.error(`  query failed: ${q}: ${err.message}`);
    }
  }

  console.error(`  total unique: ${seen.size}`);
  const plugins = [...seen.values()].filter(({ repo }) => isPluginish(repo));
  console.error(`  after plugin filter: ${plugins.length}`);
  const filtered = INCLUDE_EMPTY
    ? plugins
    : plugins.filter(
        ({ repo }) => repo.description?.trim() || (repo.topics ?? []).length > 0,
      );
  console.error(`  after empty filter: ${filtered.length}`);

  const catalog = [];
  for (const { repo, queries } of filtered) {
    const entry = {
      full_name: repo.full_name,
      url: repo.html_url,
      homepage: repo.homepage || null,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      pushed_at: repo.pushed_at,
      created_at: repo.created_at,
      topics: repo.topics ?? [],
      license: repo.license?.spdx_id ?? null,
      archived: repo.archived,
      category: categorize(repo),
      source_queries: [...queries],
    };
    if (FETCH_READMES) {
      entry.readme_excerpt = await fetchReadmeExcerpt(repo.full_name);
      await sleep(150);
    }
    catalog.push(entry);
  }

  catalog.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      b.stars - a.stars ||
      a.full_name.localeCompare(b.full_name),
  );

  if (DRY) {
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, "plugins.json");
  await fs.writeFile(jsonPath, JSON.stringify(catalog, null, 2) + "\n");
  console.error(`  ✓ wrote ${jsonPath} (${catalog.length} entries)`);

  // Generate INDEX.md grouped by category
  const byCategory = new Map();
  for (const e of catalog) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category).push(e);
  }
  const sortedCategories = [...byCategory.keys()].sort();
  const today = new Date().toISOString().slice(0, 10);
  const indexLines = [
    `# EmDash Plugin Catalog`,
    ``,
    `_Auto-generated by \`scripts/find-plugins.mjs\` on ${today}._`,
    `_Editorial notes live in \`NOTES.md\`._`,
    ``,
    `**${catalog.length}** plugins/ecosystem repos across **${sortedCategories.length}** categories.`,
    ``,
    `## Plugin signature`,
    ``,
    "```typescript",
    `import { definePlugin } from "emdash";`,
    `export default definePlugin({ hooks, routes, admin });`,
    "```",
    ``,
    `For sandboxed plugins (Cloudflare Worker isolates), \`id\`/\`version\`/\`capabilities\` go in a separate \`manifest.json\` descriptor.`,
    ``,
    `---`,
    ``,
  ];
  for (const cat of sortedCategories) {
    const items = byCategory.get(cat);
    indexLines.push(`## ${cat} (${items.length})`);
    indexLines.push("");
    indexLines.push(`| Plugin | ★ | Pushed | Description |`);
    indexLines.push(`|---|--:|---|---|`);
    for (const e of items) {
      const desc = (e.description ?? "").replace(/\|/g, "\\|") || "—";
      indexLines.push(
        `| [${e.full_name}](${e.url}) | ${e.stars} | ${e.pushed_at.slice(0, 10)} | ${desc} |`,
      );
    }
    indexLines.push("");
  }
  const indexPath = path.join(OUT_DIR, "INDEX.md");
  await fs.writeFile(indexPath, indexLines.join("\n"));
  console.error(`  ✓ wrote ${indexPath}`);

  // Per-plugin markdown stubs
  const stubsDir = path.join(OUT_DIR, "plugins");
  await fs.mkdir(stubsDir, { recursive: true });
  for (const e of catalog) {
    const slug = e.full_name.replace("/", "__");
    const lines = [
      `# ${e.full_name}`,
      ``,
      `- **Category:** ${e.category}`,
      `- **URL:** ${e.url}`,
      e.homepage ? `- **Homepage:** ${e.homepage}` : null,
      `- **Stars:** ${e.stars} · **Forks:** ${e.forks}`,
      `- **Language:** ${e.language ?? "—"} · **License:** ${e.license ?? "—"}`,
      `- **Pushed:** ${e.pushed_at.slice(0, 10)} · **Created:** ${e.created_at.slice(0, 10)}`,
      e.topics.length ? `- **Topics:** ${e.topics.join(", ")}` : null,
      ``,
      `## Description`,
      ``,
      e.description ?? "_(none)_",
      e.readme_excerpt ? `\n## README excerpt\n\n${e.readme_excerpt}` : null,
      ``,
      `_Discovered via:_ ${e.source_queries.join(" · ")}`,
    ].filter((l) => l !== null);
    await fs.writeFile(path.join(stubsDir, `${slug}.md`), lines.join("\n") + "\n");
  }
  console.error(`  ✓ wrote ${catalog.length} stubs in ${stubsDir}/`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
