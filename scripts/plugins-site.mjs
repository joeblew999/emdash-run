#!/usr/bin/env node
/** `mise run plugins-site:<sub>` — the registry's web UI (plugins.emdashcms.com) on :4330 */
import { env, run, sh } from "./lib/exec.mjs";

const EMDASH_DIR = env("EMDASH_DIR");
const APP = `${EMDASH_DIR}/apps/plugins-site`;
const sub = process.argv[2];

switch (sub) {
	case "install":
		run("pnpm", ["install", "--frozen-lockfile"], { cwd: EMDASH_DIR });
		run("pnpm", ["--filter", "@emdash-cms/plugins-site^...", "build"], { cwd: EMDASH_DIR });
		break;
	case "start":
		// :4330, not the default :4321 — that is the host site's port.
		run("pnpm", ["exec", "astro", "dev", "--port", "4330"], { cwd: APP });
		break;
	case "up":
		sh("pitchfork start plugins-site");
		console.log("→ plugins UI: http://localhost:4330/");
		break;
	case "logs":
		run("pitchfork", ["logs", "plugins-site", "--follow"]);
		break;
	default:
		console.error(`plugins-site: unknown subcommand "${sub}" (install|start|up|logs)`);
		process.exit(1);
}
