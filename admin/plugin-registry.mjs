// The registry plugin tasks that change a site: plugin:install and plugin:favourites, plugin:remove.
// EmDash has no command for these: a registry plugin is installed in the admin only.
// Asked of EmDash, as an idea (emdash-cms/emdash discussion 3999): `emdash plugin install|remove`.
//
// INSTALL sends the two requests EmDash's admin sends when a person presses Install and agrees
// (admin/src/lib/api/registry.ts): POST …/admin/plugins/registry/verify, then …/registry/install
// with what verify answered as the acknowledgement. The publisher's DID comes from where the admin
// gets it: the registry's aggregator, whose address the site gives (resolvePackage). Not from
// `emdash-plugin info`: that looks the handle up at the publisher's own host first, and fails
// when that host is down (docs/upstream.md).
import { agreed, client, declared, fail, lookUp, ready, reference, restartNode, said, siteAddress, whereIs } from "./plugin-client.mjs";
import { sandbox } from "./plugin-site.mjs";

export const install = async (args, flags) => {
	const [given, siteDir, ...refs] = args;
	const deployed = flags.includes("--deployed");
	const url = siteAddress(given, deployed);
	if (!refs.length) fail("Which plugin? mise run plugin:install -- <publisher>/<slug> — find one with: mise run plugin:search -- forms");
	const wanted = refs.flatMap((r) => r.split(/[\s,]+/)).filter(Boolean).map(reference);
	console.error(`-> ${whereIs(url)}`);
	const api = client(url, siteDir);
	if (!deployed) {
		const changed = sandbox(siteDir);
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
		const there = list.data?.items?.find((p) => p.source === "registry" && p.registryPublisherDid === pkg.did && p.registrySlug === w.slug);
		if (there && w.version && there.version !== w.version) {
			console.log(`FAIL ${w.name}: you asked for ${w.version} and the site has ${there.version}. Remove it first (mise run plugin:remove -- ${w.name}), or ask for ${there.version}`);
			failed++;
			continue;
		}
		if (there) {
			console.log(`ok   ${w.name}: already installed — ${there.version}, ${there.status}, id ${there.id}${pkg.latestVersion && pkg.latestVersion !== there.version ? ` (the registry has ${pkg.latestVersion}: update it in the admin, Plugins)` : ""}`);
			continue;
		}
		// 1. what the admin's consent dialog shows: the site reads the publisher's signed records
		const verify = await api("POST", "/_emdash/api/admin/plugins/registry/verify", { did: pkg.did, slug: w.slug });
		if (!verify.ok) {
			console.log(`FAIL ${w.name}: the site would not verify it — ${said(verify)}`);
			failed++;
			continue;
		}
		const v = verify.data;
		// A version asked for is the one installed, or none: a newer release may ask for more.
		if (w.version && v.version !== w.version) {
			console.log(`FAIL ${w.name}: you asked for ${w.version} and the registry's release is ${v.version}. Read what ${v.version} asks for (mise run plugin -- info ${w.publisher} ${w.slug}), then ask for it by that version`);
			failed++;
			continue;
		}
		// What the admin's consent dialog shows, all of it — this task agrees to it on your behalf.
		const strong = v.capabilities.filter((c) => /:write$|:patch$|unrestricted|^email:|^network:/.test(c));
		const tools = v.mcpTools.map((t) => (typeof t === "string" ? t : `${t.name ?? JSON.stringify(t)}${t.destructive ? " (destructive)" : ""}`));
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
	if (!deployed && installed) restartNode(siteDir);
	if (!deployed) console.log(`The plugins are in the site's database and storage, which the dev site (site:start) shares. Check them: mise run plugin:works`);
	process.exit(failed ? 1 : 0);
};

export const remove = async (args, flags) => {
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
		const there = items.find((p) => p.source === "registry" && p.registrySlug === w.slug && (!pkg || p.registryPublisherDid === pkg.did));
		if (!there) {
			console.log(`ok   ${w.name}: not installed — nothing to remove`);
			continue;
		}
		const gone = await api("POST", `/_emdash/api/admin/plugins/registry/${encodeURIComponent(there.id)}/uninstall`, { deleteData: false });
		if (!gone.ok) failed++;
		else removed++;
		console.log(gone.ok ? `ok   ${w.name}: removed (${there.version}, id ${there.id}); what it stored is kept` : `FAIL ${w.name}: the site would not remove it — ${said(gone)}`);
	}
	if (!deployed && removed) restartNode(siteDir);
	process.exit(failed ? 1 : 0);
};
