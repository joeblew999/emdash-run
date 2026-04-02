import node from "@astrojs/node";
import react from "@astrojs/react";
import { auditLogPlugin } from "@emdash-cms/plugin-audit-log";
import { embedsPlugin } from "@emdash-cms/plugin-embeds";
import { webhookNotifierPlugin } from "@emdash-cms/plugin-webhook-notifier";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { sqlite } from "emdash/db";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    react(),
    emdash({
      database: sqlite({ url: "file:./data.db" }),

      // Site info
      name: "plat-trunk CAD",

      plugins: [
        auditLogPlugin(),
        webhookNotifierPlugin(),
        embedsPlugin(),
      ],

      // CAD collections defined here so they exist on first boot.
      // The schema builder in the admin UI can extend these further.
      collections: [
        {
          slug: "projects",
          label: "Projects",
          labelSingular: "Project",
          description: "Top-level CAD projects",
          icon: "folder",
          supports: ["drafts", "revisions"],
          fields: [
            { slug: "name",        type: "string",  label: "Name",        required: true },
            { slug: "description", type: "text",    label: "Description"                },
            { slug: "status",      type: "select",  label: "Status",      required: true,
              validation: { options: ["active", "archived", "on-hold"] },
              defaultValue: "active" },
            { slug: "metadata",    type: "json",    label: "Metadata"                   },
          ],
        },
        {
          slug: "assemblies",
          label: "Assemblies",
          labelSingular: "Assembly",
          description: "Assembly hierarchy nodes",
          icon: "layers",
          supports: ["drafts", "revisions"],
          fields: [
            { slug: "name",       type: "string",    label: "Name",        required: true },
            { slug: "project",    type: "reference", label: "Project",     required: true,
              options: { collection: "projects" } },
            { slug: "parent",     type: "reference", label: "Parent Assembly",
              options: { collection: "assemblies" } },
            { slug: "status",     type: "select",    label: "Status",
              validation: { options: ["draft", "in-review", "approved", "released"] },
              defaultValue: "draft" },
            { slug: "metadata",   type: "json",      label: "Geometry Metadata"          },
          ],
        },
        {
          slug: "parts",
          label: "Parts",
          labelSingular: "Part",
          description: "Individual CAD parts with geometry",
          icon: "box",
          supports: ["drafts", "revisions"],
          fields: [
            { slug: "name",          type: "string",    label: "Name",         required: true },
            { slug: "part_number",   type: "string",    label: "Part Number",  unique: true    },
            { slug: "assembly",      type: "reference", label: "Assembly",     required: true,
              options: { collection: "assemblies" } },
            { slug: "brep_file",     type: "file",      label: "BREP File"                    },
            { slug: "step_file",     type: "file",      label: "STEP File"                    },
            { slug: "material",      type: "select",    label: "Material",
              validation: { options: ["aluminium", "steel", "titanium", "carbon-fibre", "plastic", "other"] } },
            { slug: "status",        type: "select",    label: "Status",
              validation: { options: ["draft", "in-review", "approved", "released"] },
              defaultValue: "draft" },
            { slug: "version",       type: "integer",   label: "Version",      defaultValue: 1 },
            { slug: "geometry_meta", type: "json",      label: "Geometry",
              widget: "plat-trunk:preview",
              options: { cad_url: "https://cad.ubuntusoftware.net" } },
          ],
        },
      ],
    }),
  ],
});
