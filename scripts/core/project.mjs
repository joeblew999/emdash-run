// The project a task acts on, worked out once: its folder, its site, its ports, its deployed address.
import { join } from "node:path";

/**
 * @typedef {object} Project
 * @property {string} root     the project's folder (where its mise.toml is)
 * @property {string} site     the site's folder
 * @property {string} siteName the site's folder, as the project names it
 * @property {string} dev      the dev site's address
 * @property {string} built    the built site's address
 * @property {string} devPort
 * @property {string} builtPort
 * @property {string} live     the deployed site's address, or ""
 * @property {string} scripts  emdash-run's scripts folder
 */

/** @param {NodeJS.ProcessEnv} env @param {string} cwd @param {string} scripts @returns {Project} */
export const projectOf = (env, cwd, scripts) => {
	const root = env.MISE_PROJECT_ROOT || env.MISE_CONFIG_ROOT || cwd;
	const siteName = env.SITE_FOLDER || "site";
	const devPort = env.SITE_PORT || "4321";
	const builtPort = env.PREVIEW_PORT || "4322";
	return { root, siteName, site: join(root, siteName), devPort, builtPort, dev: `http://127.0.0.1:${devPort}`, built: `http://127.0.0.1:${builtPort}`, live: env.LIVE_URL || "", scripts };
};
