// The registry plugin tasks that change a site: plugin:install and plugin:favourites, plugin:update,
// plugin:remove.
// EmDash has no command for these: a registry plugin is installed in the admin only.
// Asked of EmDash, as an idea (emdash-cms/emdash discussion 3999): `emdash plugin install|remove`.
//
// INSTALL sends the two requests EmDash's admin sends when a person presses Install and agrees
// (admin/src/lib/api/registry.ts): POST …/admin/plugins/registry/verify, then …/registry/install
// with what verify answered as the acknowledgement. The publisher's DID comes from where the admin
// gets it: the registry's aggregator, whose address the site gives (resolvePackage). Not from
// `emdash-plugin info`: that looks the handle up at the publisher's own host first, and fails
// when that host is down (docs/upstream.md).
//
// UPDATE sends the admin's Update request, POST …/admin/plugins/registry/<id>/update, for the release
// that was named. EmDash has no request that only says what an update would ask for: sent with no
// agreement, it refuses a release that asks for more (CAPABILITY_ESCALATION and the like, with the
// difference) and otherwise updates there and then. So before anything is sent, the two releases
// are read from the registry's aggregator and compared; the site's own refusal is the second gate.
import { accessOf, agreed, client, declared, fail, lookUp, ready, reference, releaseOf, restartNode, said, siteAddress, whereIs } from "./plugin-api.mjs";
import { sandbox } from "./plugin-sandbox.mjs";
import { Exit } from "./core/calls.mjs";

export const install = async (/** @type {string[]} */ args, /** @type {string[]} */ flags) => {
	const [given, siteDir, ...refs] = args;
	const deployed = flags.includes("--deployed");
	const url = siteAddress(given, deployed);
	if (!refs.length) fail("Which plugin? mise run plugin:install -- <publisher>/<slug> — find one with: mise run plugin:search -- forms");
	const wanted = refs.flatMap((r) => r.split(/[\s,]+/)).filter(Boolean).map(reference);
	console.error(`-> ${whereIs(url)}`);
	const api = client(url, siteDir);
	if (!deployed) {
		const changed = await sandbox(siteDir);
		for (const line of changed) console.log(`sandbox: ${line}`);
		await ready(url, siteDir, api, changed.length > 0);
	}
	const manifest = await api("GET", "/_emdash/api/manifest");
	if (manifest.status !== 200) {
		fail(`The site did not accept this machine's sign-in: GET /_emdash/api/manifest answered ${said(manifest)}\nSign in first: mise run signin:token${deployed ? " -- --live" : ""}`);
	}
	if (!manifest.data.sandboxEnabled || !manifest.data.registry) {
		fail(`This site cannot install a registry plugin: it says sandboxEnabled=${manifest.data.sandboxEnabled}, registry=${JSON.stringify(manifest.data.registry ?? null)}.\n${deployed ? "On the deployed site that takes: mise run plugin:sandbox, then mise run live:ship (the Worker Loader binding needs the Workers Paid plan)." : "mise run plugin:sandbox makes the edits; then mise run site:preview. EmDash docs: deployment/plugin-sandbox."}`);
	}
	let failed = 0;
	let installed = 0;
	for (const w of wanted) {
		const { pkg, why } = await lookUp(manifest.data.registry.aggregatorUrl, w);
		if (!pkg) {
			console.log(`FAIL ${w.name}: the registry does not have it — ${why}`);
			failed++;
			continue;
		}
		const list = await api("GET", "/_emdash/api/admin/plugins");
		const there = list.data?.items?.find((/** @type {any} */ p) => p.source === "registry" && p.registryPublisherDid === pkg.did && p.registrySlug === w.slug);
		if (there && w.version && there.version !== w.version) {
			console.log(`FAIL ${w.name}: you asked for ${w.version} and the site has ${there.version}. To move it to a newer release: mise run plugin:update -- ${w.name}@${w.version}. To an older one: remove it first (mise run plugin:remove -- ${w.name})`);
			failed++;
			continue;
		}
		if (there) {
			console.log(`ok   ${w.name}: already installed — ${there.version}, ${there.status}, id ${there.id}${pkg.latestVersion && pkg.latestVersion !== there.version ? ` (the registry has ${pkg.latestVersion}: mise run plugin:update -- ${w.name}@${pkg.latestVersion})` : ""}`);
			continue;
		}
		// 1. what the admin's consent dialog shows: the site reads the publisher's signed records
		// a release asked for by version is the one verified and installed, newest or not
		const verify = await api("POST", "/_emdash/api/admin/plugins/registry/verify", { did: pkg.did, slug: w.slug, ...(w.version ? { version: w.version } : {}) });
		if (!verify.ok) {
			console.log(`FAIL ${w.name}: the site would not verify it — ${said(verify)}`);
			failed++;
			continue;
		}
		const v = verify.data;
		// A version asked for is the one installed, or none: a newer release may ask for more.
		if (w.version && v.version !== w.version) {
			console.log(`FAIL ${w.name}: you asked for ${w.version} and the site verified ${v.version}. Read what ${v.version} asks for (mise run plugin -- info ${w.publisher} ${w.slug}), then ask for it by that version`);
			failed++;
			continue;
		}
		// What the admin's consent dialog shows, all of it — this task agrees to it on your behalf.
		const strong = v.capabilities.filter((/** @type {any} */ c) => /:write$|:patch$|unrestricted|^email:|^network:/.test(c));
		const tools = v.mcpTools.map((/** @type {any} */ t) => (typeof t === "string" ? t : `${t.name ?? JSON.stringify(t)}${t.destructive ? " (destructive)" : ""}`));
		console.log(`     ${w.name} ${v.version} asks for:`);
		console.log(`       permissions: ${v.capabilities.join(", ") || "none"}`);
		if (strong.length) console.log(`       of those, it can change things or reach outside the site: ${strong.join(", ")}`);
		const hosts = v.allowedHosts ?? v.declaredAccess?.allowedHosts ?? v.declaredAccess?.network?.hosts;
		if (hosts?.length) console.log(`       hosts it may call: ${hosts.join(", ")}`);
		console.log(`       addresses open to visitors: ${v.publicRoutes.join(", ") || "none"}`);
		console.log(`       tools it gives to agents (MCP): ${tools.join(", ") || "none"}`);
				if ((strong.length || deployed) && !agreed(flags)) {
			console.log(`STOP ${w.name}: not installed. ${deployed ? "This is the deployed site" : "It asks for more than reading"}: say yes to the list above with  -- --yes`);
			failed++;
			continue;
		}
		// 2. the install, agreeing to exactly what was shown
		const install = await api("POST", "/_emdash/api/admin/plugins/registry/install", {
			did: pkg.did,
			slug: w.slug,
			version: v.version,
			acknowledgedDeclaredAccess: v.capabilities,
			acknowledgedMcpTools: v.mcpTools,
			acknowledgedPublicRoutes: v.publicRoutes,
			acknowledgedProfileCid: v.verification.profileCid,
			acknowledgedReleaseCid: v.verification.releaseCid,
		});
		if (!install.ok) {
			console.log(`FAIL ${w.name}: the site would not install it — ${said(install)}`);
			failed++;
			continue;
		}
		installed++;
		declared(url, siteDir, `${pkg.did}/${w.slug}`, { version: v.version, capabilities: v.capabilities, publicRoutes: v.publicRoutes });
		console.log(`ok   ${w.name}: installed — ${install.data.version}, id ${install.data.pluginId}`);
	}
	if (!deployed && installed) await restartNode(siteDir);
	if (!deployed) console.log(`The plugins are in the site's database and storage, which the dev site (site:start) shares. Check them: mise run plugin:works`);
	throw new Exit(failed ? 1 : 0);
};

export const update = async (/** @type {string[]} */ args, /** @type {string[]} */ flags) => {
	// The admin's Update, for a registry plugin, to the release that is named.
	const [given, siteDir, ...refs] = args;
	const deployed = flags.includes("--deployed");
	const url = siteAddress(given, deployed);
	const wanted = refs.flatMap((r) => r.split(/[\s,]+/)).filter(Boolean).map(reference);
	if (!wanted.length) fail("Which plugin, and to which release? mise run plugin:update -- <publisher>/<slug>@<version>");
	console.error(`-> ${whereIs(url)}`);
	const api = client(url, siteDir);
	if (!deployed) await ready(url, siteDir, api, false);
	const manifest = await api("GET", "/_emdash/api/manifest");
	if (manifest.status !== 200) fail(`The site did not accept this machine's sign-in: GET /_emdash/api/manifest answered ${said(manifest)}\nSign in first: mise run signin:token${deployed ? " -- --live" : ""}`);
	if (!manifest.data.registry) fail("This site has no registry configured, so it has no registry plugin to update.");
	const yes = agreed(flags);
	const list = (/** @type {string[]} */ a) => a.join(", ") || "nothing";
	let failed = 0;
	let updated = 0;
	for (const w of wanted) {
		const stop = (/** @type {string} */ state, /** @type {string} */ why) => {
			console.log(`${state} ${w.name}: ${why}`);
			failed++;
		};
		const { pkg, why } = await lookUp(manifest.data.registry.aggregatorUrl, w);
		if (!pkg) {
			stop("FAIL", `the registry does not have it — ${why}`);
			continue;
		}
		const items = (await api("GET", "/_emdash/api/admin/plugins")).data?.items ?? [];
		const there = items.find((/** @type {any} */ p) => p.source === "registry" && p.registryPublisherDid === pkg.did && p.registrySlug === w.slug);
		if (!there) {
			stop("FAIL", `not installed, so there is nothing to update. Install it: mise run plugin:install -- ${w.name}${w.version ? `@${w.version}` : ""}`);
			continue;
		}
		if (!w.version) {
			stop("FAIL", `to which release? The site has ${there.version} and the registry's newest is ${pkg.latestVersion ?? "unknown"}. Name it: mise run plugin:update -- ${w.name}@${pkg.latestVersion ?? "<version>"}`);
			continue;
		}
		if (there.version === w.version) {
			console.log(`ok   ${w.name}: already at ${there.version} — nothing to update (id ${there.id})`);
			continue;
		}
		// What each release says it needs, from the registry — nothing is sent to the site yet.
		const aggregator = manifest.data.registry.aggregatorUrl;
		const next = await releaseOf(aggregator, pkg.did, w.slug, w.version);
		if (!next.release) {
			stop("FAIL", `release ${w.version} — ${next.why}. It has: ${list(next.versions)}`);
			continue;
		}
		const now = await releaseOf(aggregator, pkg.did, w.slug, there.version);
		const key = `${pkg.did}/${w.slug}`;
		const kept = declared(url, siteDir, key);
		const granted = kept?.version === there.version ? kept : null;
		const asks = accessOf(next.release);
		const had = now.release ? accessOf(now.release) : null;
		const more = had ? asks.filter((a) => !had.includes(a)) : asks;
		const less = had ? had.filter((a) => !asks.includes(a)) : [];
		console.log(`     ${w.name}: ${there.version} -> ${w.version}`);
		console.log(`       ${there.version}, installed, was granted: ${granted ? list(granted.capabilities) : `not recorded — this machine did not install ${there.version} with plugin:install`}`);
		console.log(`       ${there.version} declares, by the registry: ${had ? list(had) : `unknown — ${now.why}`}`);
		console.log(`       ${w.version} declares, by the registry: ${list(asks)}`);
		console.log(`       so ${w.version} asks for ${more.length ? `MORE: ${list(more)}` : "nothing more"}${had ? "" : ` (all of it counted as more: what ${there.version} declares is not known)`}${less.length ? `; and no longer for: ${list(less)}` : ""}`);
		if ((more.length || deployed) && !yes) {
			stop("STOP", `not updated, and nothing was sent to the site. ${deployed ? "This is the deployed site" : "The new release asks for more than the installed one"}: say yes to the lines above with  -- --yes`);
			continue;
		}
		// The site's own gate. It compares the new release with the bundle it is running, and
		// refuses — one kind of difference at a time — what was not agreed to.
		/** @type {Record<string, unknown>} */
		const body = { version: w.version };
		let done = null;
		let shown = { added: [], removed: [], newlyPublic: [] };
		for (let attempt = 0; attempt < 4 && !done; attempt++) {
			const res = await api("POST", `/_emdash/api/admin/plugins/registry/${encodeURIComponent(there.id)}/update`, body);
			const details = res.error?.details ?? {};
			if (res.ok) done = res;
			else if (res.error?.code === "ALREADY_UP_TO_DATE") break;
			else if (["CAPABILITY_ESCALATION", "ROUTE_VISIBILITY_ESCALATION", "MCP_TOOL_CONSENT_REQUIRED"].includes(res.error?.code ?? "") && attempt < 3) {
				const added = details.capabilityChanges?.added ?? [];
				const newlyPublic = details.routeVisibilityChanges?.newlyPublic ?? [];
				const tools = (details.mcpTools ?? []).map((/** @type {any} */ t) => `${t.name ?? JSON.stringify(t)}${t.destructive ? " (destructive)" : ""}`);
				console.log(`       the site says ${w.version} needs agreement (${res.error?.code}):${added.length ? ` new permissions: ${list(added)};` : ""}${newlyPublic.length ? ` addresses newly open to visitors: ${list(newlyPublic)};` : ""}${tools.length ? ` tools it gives to agents (MCP): ${list(tools)}` : ""}`);
				if (!yes) {
					stop("STOP", "not updated: the site found more than the registry's listing showed. Say yes to the line above with  -- --yes");
					break;
				}
				shown = { added, removed: details.capabilityChanges?.removed ?? [], newlyPublic };
				if (res.error?.code === "CAPABILITY_ESCALATION") body.confirmCapabilityChanges = true;
				if (newlyPublic.length) body.acknowledgedPublicRoutes = newlyPublic;
				if (res.error?.code === "MCP_TOOL_CONSENT_REQUIRED") body.confirmMcpTools = true;
				body.acknowledgedProfileCid = details.verification?.profileCid;
				body.acknowledgedReleaseCid = details.verification?.releaseCid;
			} else {
				stop("FAIL", `the site would not update it — ${said(res)}`);
				break;
			}
		}
		if (!done) continue;
		updated++;
		// What it is granted now, for the next update and for plugin:works: the site's account of the difference.
		const changes = done.data.capabilityChanges ?? shown;
		const capabilities = granted ? [...granted.capabilities.filter((/** @type {any} */ c) => !(changes.removed ?? []).includes(c)), ...(changes.added ?? []).filter((/** @type {any} */ c) => !granted.capabilities.includes(c))] : null;
		const publicRoutes = kept?.publicRoutes ? [...new Set([...kept.publicRoutes, ...(done.data.routeVisibilityChanges?.newlyPublic ?? shown.newlyPublic)])] : null;
		if (capabilities && publicRoutes) declared(url, siteDir, key, { version: done.data.newVersion, capabilities, publicRoutes });
		console.log(`ok   ${w.name}: updated — ${done.data.oldVersion} -> ${done.data.newVersion}, id ${done.data.pluginId}${(changes.added ?? []).length ? `; newly granted: ${list(changes.added)}` : ""}`);
	}
	if (!deployed && updated) await restartNode(siteDir);
	if (updated) console.log(`Check ${updated > 1 ? "them" : "it"}: mise run plugin:works${deployed ? " -- --live" : ""}`);
	throw new Exit(failed ? 1 : 0);
};

export const remove = async (/** @type {string[]} */ args, /** @type {string[]} */ flags) => {
	// The admin's Uninstall, for a registry plugin. Its stored data is kept, as the admin keeps it
	// by default. One that is not installed is nothing to remove.
	const [given, siteDir, ...refs] = args;
	const deployed = flags.includes("--deployed");
	const url = siteAddress(given, deployed);
	if (!refs.length) fail("Which plugin? mise run plugin:remove -- <publisher>/<slug>");
	console.error(`-> ${whereIs(url)}`);
	const api = client(url, siteDir);
	if (!deployed) await ready(url, siteDir, api, false);
	const manifest = await api("GET", "/_emdash/api/manifest");
	if (manifest.status !== 200) fail(`The site did not accept this machine's sign-in: GET /_emdash/api/manifest answered ${said(manifest)}\nSign in first: mise run signin:token${deployed ? " -- --live" : ""}`);
	let failed = 0;
	let removed = 0;
	for (const w of refs.map(reference)) {
		const items = (await api("GET", "/_emdash/api/admin/plugins")).data?.items ?? [];
		const { pkg } = manifest.data.registry ? await lookUp(manifest.data.registry.aggregatorUrl, w) : {};
		const there = items.find((/** @type {any} */ p) => p.source === "registry" && p.registrySlug === w.slug && (!pkg || p.registryPublisherDid === pkg.did));
		if (!there) {
			console.log(`ok   ${w.name}: not installed — nothing to remove`);
			continue;
		}
		const gone = await api("POST", `/_emdash/api/admin/plugins/registry/${encodeURIComponent(there.id)}/uninstall`, { deleteData: false });
		if (!gone.ok) failed++;
		else removed++;
		console.log(gone.ok ? `ok   ${w.name}: removed (${there.version}, id ${there.id}); what it stored is kept` : `FAIL ${w.name}: the site would not remove it — ${said(gone)}`);
	}
	if (!deployed && removed) await restartNode(siteDir);
	throw new Exit(failed ? 1 : 0);
};
