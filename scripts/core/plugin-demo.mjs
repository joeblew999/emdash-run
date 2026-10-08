// plugin:demo — six plugins from EmDash's registry each DO their real thing on this machine's built
// site, with requests only: nobody clicks. plugin:works says a plugin loads and answers; this says
// it works — a setting shows on a page, a dead link is found, a visitor's message arrives.
//
// A plugin is a RECIPE: what to make, and the proof. The proof is asked first, and when it already
// holds nothing is made — so the task is safe to run again, and makes no second form or message.
// Adding a plugin is adding a recipe to the list at the end.
//
// The requests were read from each plugin's own bundle and then tried on a site (EmDash 1.2.0, the
// releases named below). A plugin's admin page is ONE address, POST …/plugins/<id>/admin, and it
// takes what the page's buttons and forms send: { type: "page_load" | "block_action" | "form_submit", … }.
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

import { reference, said } from "../plugin-api.mjs";
import { main as pluginJob } from "../plugin.mjs";
import { Exit } from "./calls.mjs";
import { savedName } from "./signin.mjs";

/**
 * @typedef {import("./graph.mjs").Graph} Graph @typedef {import("./graph.mjs").Ctx} Ctx
 * @typedef {import("../plugin-api.mjs").Answer} Answer
 * @typedef {(method: string, path: string, body?: unknown) => Promise<Answer>} Ask
 * What a recipe is given: the site, as its plugin is asked.
 * @typedef {object} Site
 * @property {string} id      the plugin's id on THIS site: the site makes one up when it installs a plugin
 * @property {Ask} api        EmDash's own API, signed in: a path under /_emdash/api
 * @property {Ask} route      one of the plugin's routes, signed in
 * @property {Ask} visitor    one of the plugin's routes as a stranger's browser asks it: nothing saved is sent
 * @property {(path: string) => Promise<Answer>} page   a page of the site, as a visitor gets it
 * @property {(seconds: number) => Promise<void>} sleep
 * @typedef {object} Recipe
 * @property {string} plugin                           as plugin:install takes it, with the release that was tried
 * @property {(site: Site) => Promise<void>} make      what is not there yet, each step only when it is missing
 * @property {(site: Site) => Promise<string>} proof   what shows it worked, in a few words; throws, saying why, when it does not hold
 */

/** An answer that is not a yes stops the recipe, with what was asked and what the site said. @param {Answer} r @param {string} what */
const must = (r, what) => {
	if (!r.ok) throw new Error(`${what} answered ${said(r)}`);
	return r;
};
/** A button or a form of a plugin's admin page. The page says how it went in a toast, with a 200 either way. @param {Site} site @param {string} what @param {Record<string, unknown>} sent */
const press = async (site, what, sent) => {
	const r = must(await site.route("POST", "admin", sent), what);
	if (r.data?.toast?.type === "error") throw new Error(`${what} answered: ${r.data.toast.message}`);
	return r;
};
/** A plugin's settings, as the admin's settings page reads and saves them. @param {Site} site */
const settings = async (site) => must(await site.api("GET", `/admin/plugins/${site.id}/settings`), "its settings").data.values ?? {};
/** @param {Site} site @param {Record<string, string>} values */
const set = async (site, values) => void must(await site.api("PUT", `/admin/plugins/${site.id}/settings`, { values }), "saving its settings");
const times = (/** @type {number} */ n) => (n === 1 ? "once" : `${n} times`);

// ─── what the recipes make ───────────────────────────────────────────────────────────────────────
// Each is the task's own and named after it, so nobody's content is edited, and whoever finds one
// in the admin later can tell where it came from.

// A published post with a link to a page that is not there: Link Guardian's dead link, and the entry
// LinguaDash translates. (A built site that signin:token set up has no content of its own: a seed's
// posts come with EmDash's set-up wizard, which that skips.)
const POST = "plugin-demo";
const DEAD_LINK = "https://emdashcms.com/this-page-does-not-exist-404";
const block = (/** @type {string} */ key, /** @type {object} */ more) => ({ _type: "block", _key: key, style: "normal", ...more });
const span = (/** @type {string} */ key, /** @type {string} */ text, /** @type {string[]} */ marks = []) => ({ _type: "span", _key: key, text, marks });
const postData = {
	title: "A post made by plugin:demo",
	excerpt: "Made by the task plugin:demo, for the plugins it tries.",
	content: [block("b1", { markDefs: [{ _key: "l1", _type: "link", href: DEAD_LINK }], children: [span("s1", "This post was made by the task plugin:demo. It links to "), span("s2", "a page that is not there", ["l1"]), span("s3", ", for a link checker to find.")] })],
};
/** The post, when it is there and published. @param {Site} site */
const findPost = async (site) => {
	const r = await site.api("GET", `/content/posts/${POST}`);
	return r.ok && r.data?.item?.status === "published" ? r.data.item : null;
};
/** @param {Site} site */
const makePost = async (site) => {
	let r = await site.api("GET", `/content/posts/${POST}`);
	if (r.status === 404) r = await site.api("POST", "/content/posts", { slug: POST, data: postData });
	const item = must(r, `the post ${POST}`).data.item;
	return item.status === "published" ? item : must(await site.api("POST", `/content/posts/${item.id}/publish`, {}), "publishing the post").data.item;
};

// An image with no alt text. Made here, 16 by 16, a checkerboard of two colours: nothing is
// downloaded and no image file is kept in the repo — and not the one-pixel image every site has,
// which EmDash, knowing an upload by what it holds, would answer with somebody's own file.
const IMAGE = "plugin-demo.png";
const ALT = "A small orange and slate checkerboard, made by plugin:demo";
export const png = () => {
	const chunk = (/** @type {string} */ type, /** @type {Buffer} */ data) => {
		const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
		const out = Buffer.alloc(body.length + 8);
		out.writeUInt32BE(data.length, 0);
		body.copy(out, 4);
		out.writeUInt32BE(crc32(body), body.length + 4);
		return out;
	};
	const size = 16;
	const head = Buffer.alloc(13);
	head.writeUInt32BE(size, 0);
	head.writeUInt32BE(size, 4);
	head.set([8, 2, 0, 0, 0], 8); // 8 bits a channel, red green blue
	const row = 1 + size * 3; // a row is a filter byte (0: none), then its pixels
	const rows = Buffer.alloc(size * row);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) rows.set((x + y) % 2 ? [0xf6, 0x82, 0x1f] : [0x1f, 0x29, 0x37], y * row + 1 + x * 3);
	return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", head), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
};
/** @param {Site} site */
const findImage = async (site) => (must(await site.api("GET", `/media?q=${IMAGE}`), "the media library").data?.items ?? []).find((/** @type {any} */ m) => m.filename === IMAGE) ?? null;
/** Is this image in the plugin's queue of images with no alt text? @param {Site} site @param {string} id */
const queued = async (site, id) => ((await press(site, "its queue of images with no alt text", { type: "page_load", page: "/alt-text" })).data?.blocks ?? []).some((/** @type {any} */ b) => (b.rows ?? []).some((/** @type {any} */ row) => row.action?.value === id));

// A form named Contact in each of the two forms plugins, and one message a visitor sends to it.
const FORM = "Contact";
const VISITOR = { name: "A Visitor", email: "visitor@example.com", message: "Hello from plugin:demo" };
// Contact Forms has no request that lists its forms (forms/list answers for the one id it is given):
// its Forms page does, a form as a few blocks — "Form ID: <id>", then its fields, the slug among them.
/** @param {Site} site */
const contactForm = async (site) => {
	let id = "";
	for (const b of (await press(site, "its Forms page", { type: "page_load", page: "/forms" })).data?.blocks ?? []) {
		id = /^Form ID: (\S+)/.exec(b.type === "context" ? b.text : "")?.[1] ?? id;
		if (b.type === "fields" && b.fields?.some((/** @type {any} */ f) => f.label === "Slug" && f.value === FORM.toLowerCase())) return id;
	}
	return "";
};
/** @param {Site} site @param {string} id */
const contactExport = async (site, id) => must(await site.route("GET", `submissions/export?formId=${id}`), "its export of submissions").text;
// Forms answers a refusal with a 200 too: { ok: false, code, message }.
/** @param {Answer} r @param {string} what */
const formsSaid = (r, what) => {
	if (must(r, what).data?.ok !== true) throw new Error(`${what} answered ${r.data?.code}: ${r.data?.message}`);
	return r.data;
};
/** @param {Site} site */
const formsForm = async (site) => (formsSaid(await site.route("POST", "list", {}), "its list of forms").items ?? []).find((/** @type {any} */ f) => (f.record?.published ?? f.record?.draft)?.title === FORM) ?? null;
/** The visitor's answers among a form's entries (the newest fifty). @param {Site} site @param {string} id */
const formsEntries = async (site, id) => (formsSaid(await site.route("POST", "entries", { formId: id }), "its entries").items ?? []).filter((/** @type {any} */ e) => e.entry?.answers?.message === VISITOR.message);
const field = (/** @type {string} */ id, /** @type {string} */ label, /** @type {string} */ type, /** @type {number} */ maxLength) => ({ id, label, description: "", required: true, width: "full", condition: null, type, placeholder: "", maxLength });

// ─── the recipes ─────────────────────────────────────────────────────────────────────────────────

/** @type {Recipe[]} */
export const recipes = [
	// Two settings, and every page of the site carries them. Only what is not set is set: a name or
	// a handle the site already has is its owner's, and the proof looks for whatever is there.
	{
		plugin: "@nookeshk.bsky.social/seo-suite@0.2.0",
		make: async (site) => {
			const now = await settings(site);
			const missing = Object.entries({ organizationName: "Acme", twitterHandle: "acme" }).filter(([key]) => !String(now[key] ?? "").trim());
			if (missing.length) await set(site, Object.fromEntries(missing));
		},
		proof: async (site) => {
			const now = await settings(site);
			const name = String(now.organizationName ?? "").trim();
			const handle = String(now.twitterHandle ?? "").trim().replace(/^@/, "");
			if (!name || !handle) throw new Error("its settings name no organisation, or no X handle");
			const home = must(await site.page("/"), "the home page").text;
			const lacks = [
				...(home.includes('"@type":"Organization"') && home.includes(`"name":${JSON.stringify(name)}`) ? [] : [`the organisation "${name}" as JSON-LD`]),
				...(home.includes(`name="twitter:site" content="@${handle}"`) ? [] : [`the X handle @${handle}`]),
			];
			if (lacks.length) throw new Error(`the home page does not carry ${lacks.join(", nor ")}`);
			return `the home page carries what its settings name: the organisation "${name}" as JSON-LD, and the X handle @${handle}`;
		},
	},
	// A dead link in a published post is found. Publishing the post has the plugin read its links,
	// and a pass — its "run a pass now" button — checks those not checked yet, a few at a time.
	{
		plugin: "@meekmedia.bsky.social/link-guardian@0.1.0",
		make: async (site) => {
			// Links to the site itself are left out: on this machine its address is localhost, which is
			// not a link any visitor will follow. Added to the patterns the site already has.
			const patterns = String((await settings(site)).ignorePatterns ?? "").split("\n").map((p) => p.trim()).filter(Boolean);
			if (!patterns.includes("http://localhost*")) await set(site, { ignorePatterns: [...patterns, "http://localhost*"].join("\n") });
			await makePost(site);
			// (a few passes: one checks a handful of links, and the check that publishing set off may still be on its way)
			for (let pass = 0; pass < 5; pass++) {
				const r = must(await site.route("POST", "pass", {}), "a pass");
				if (r.data?.ok !== true) throw new Error(`a pass answered ${r.data?.error?.code}: ${r.data?.error?.message}`);
				const found = must(await site.route("GET", "links/broken?limit=100"), "its list of broken links").data;
				if ((found?.links ?? []).some((/** @type {any} */ l) => l.url === DEAD_LINK)) return;
				await site.sleep(1);
			}
		},
		proof: async (site) => {
			const found = must(await site.route("GET", "links/broken?limit=100"), "its list of broken links").data;
			const link = (found?.links ?? []).find((/** @type {any} */ l) => l.url === DEAD_LINK);
			if (!link) throw new Error(`its list of broken links does not have ${DEAD_LINK}: it counts ${JSON.stringify(found?.counts ?? {})}`);
			return `it found the dead link in the post "${link.foundIn?.[0]?.title ?? POST}": ${DEAD_LINK} answers ${link.httpStatus} (${found.counts?.broken} broken of ${found.counts?.links} links it knows)`;
		},
	},
	// An image uploaded with no alt text is in its queue; the alt text saved through the queue's own
	// form is on the image, and the queue lets it go.
	{
		plugin: "@agenticecom.net/media-alt-text-queue@0.2.1",
		make: async (site) => {
			let image = await findImage(site);
			if (!image) {
				const form = new FormData();
				form.append("file", new Blob([png()], { type: "image/png" }), IMAGE);
				image = must(await site.api("POST", "/media", form), "the upload").data.item;
			}
			if (String(image.alt ?? "").trim()) return;
			if (!(await queued(site, image.id))) throw new Error(`its queue of images with no alt text does not list ${IMAGE}, which has none`);
			await press(site, "saving the alt text", { type: "form_submit", action_id: "save_alt", block_id: image.id, values: { alt: ALT }, page: "/alt-text" });
		},
		proof: async (site) => {
			const image = await findImage(site);
			if (!image) throw new Error(`the media library has no ${IMAGE}`);
			if (!String(image.alt ?? "").trim()) throw new Error(`${IMAGE} has no alt text`);
			if (await queued(site, image.id)) throw new Error(`${IMAGE} has alt text and its queue still lists it`);
			return `${IMAGE}, uploaded with no alt text, has the one saved through its queue ("${image.alt}"), and the queue no longer lists it`;
		},
	},
	// A form, and a visitor's message to it: sent with no sign-in, read back signed in. By its own
	// settings the plugin takes five messages an hour from one address (read in its bundle, not
	// tried), so one is sent only when the export has none.
	{
		plugin: "@masonjames.com/contact-forms@0.2.0",
		make: async (site) => {
			let id = await contactForm(site);
			if (!id) {
				await press(site, "saving the form", { type: "form_submit", action_id: "forms:save:new", page: "/forms", values: { name: FORM, slug: FORM.toLowerCase(), status: "active", notifyEmails: "", confirmationMessage: "Thanks.", redirectUrl: "", submitLabel: "Send" } });
				id = await contactForm(site);
				if (!id) throw new Error(`the form was saved, and its Forms page does not list one with the slug ${FORM.toLowerCase()}`);
			}
			if ((await contactExport(site, id)).includes(VISITOR.message)) return;
			const sent = must(await site.visitor("POST", "submit", { formId: id, data: VISITOR }), "a visitor's message");
			if (sent.data?.success !== true) throw new Error(`a visitor's message answered ${said(sent)}`);
		},
		proof: async (site) => {
			const id = await contactForm(site);
			if (!id) throw new Error(`it has no form with the slug ${FORM.toLowerCase()}`);
			const csv = await contactExport(site, id);
			if (!csv.includes(VISITOR.message)) throw new Error(`its export of the form's submissions does not have the visitor's message: ${csv.replace(/\s+/g, " ").slice(0, 200)}`);
			return `the message a visitor sent to its form "${FORM}" is in the export of submissions, ${times(csv.split(VISITOR.message).length - 1)}`;
		},
	},
	// A form made, published, and answered by a visitor: a ticket first, then the answers — no sooner
	// than the ticket says (sent at once they are refused, TOO_FAST: a person takes longer).
	{
		plugin: "@netdollar.dev/forms@0.1.0",
		make: async (site) => {
			let form = await formsForm(site);
			if (!form) {
				const definition = {
					schemaVersion: 1,
					title: FORM,
					description: "",
					fields: [field("name", "Name", "text", 200), field("email", "Email", "email", 200), field("message", "Message", "textarea", 5000)],
					settings: { submitLabel: "Send", confirmation: "Thanks.", notifications: [], opensAt: null, closesAt: null, mode: "standard" },
				};
				form = formsSaid(await site.route("POST", "create", { definition }), "making the form");
			}
			if (form.record.status === "draft") {
				const { revision } = formsSaid(await site.route("POST", "get", { id: form.id }), "reading the form");
				formsSaid(await site.route("POST", "publish", { id: form.id, revision }), "publishing the form");
			}
			if ((await formsEntries(site, form.id)).length) return;
			const ticket = formsSaid(await site.visitor("POST", "ticket", { id: form.id }), "a visitor's ticket");
			await site.sleep((ticket.minimumWaitMs ?? 1500) / 1000 + 0.5);
			formsSaid(await site.visitor("POST", "submit", { formId: form.id, ticket: ticket.ticket, answers: VISITOR, website: "" }), "a visitor's answers");
		},
		proof: async (site) => {
			const form = await formsForm(site);
			if (!form) throw new Error(`it has no form titled ${FORM}`);
			const mine = await formsEntries(site, form.id);
			if (!mine.length) throw new Error(`the entries of its form ${form.id} do not have the visitor's answers`);
			return `the answers a visitor sent to its published form "${FORM}" (${form.id}) are among its entries, ${times(mine.length)}`;
		},
	},
	// A French entry for a post: with no translation service set, a copy to translate, left as a
	// draft. French is added to the languages the site already translates into.
	{
		plugin: "@swiss.ky/linguadash@0.2.1",
		make: async (site) => {
			const locales = String((await settings(site)).targetLocales ?? "").split(",").map((l) => l.trim()).filter(Boolean);
			if (!locales.includes("fr")) await set(site, { targetLocales: [...locales, "fr"].join(", ") });
			const post = await makePost(site);
			await press(site, "its button that makes a missing translation", { type: "block_action", action_id: "translate-missing", value: `fr|posts|${post.id}`, page: "/translations" });
		},
		proof: async (site) => {
			const post = await findPost(site);
			if (!post) throw new Error(`there is no published post ${POST} to translate`);
			const all = must(await site.api("GET", `/content/posts/${post.id}/translations`), "the post's translations").data?.translations ?? [];
			const french = all.find((/** @type {any} */ t) => t.locale === "fr");
			if (!french) throw new Error(`the post ${POST} has no French entry: it is in ${all.map((/** @type {any} */ t) => t.locale).join(", ") || "no language"}`);
			return `the post "${POST}" has the French entry it made (${french.slug}, a ${french.status} to review)`;
		},
	},
];

// ─── the task ────────────────────────────────────────────────────────────────────────────────────

/**
 * How a site is asked: its answer as EmDash's JSON, read where it is used. No token: a visitor.
 * @param {import("./world.mjs").World} world @param {string} base @param {string} token @returns {Ask}
 */
const client = (world, base, token) => async (method, path, body) => {
	const form = body instanceof FormData; // (an upload: the request names its own content type)
	const init = {
		method,
		headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined && !form ? { "Content-Type": "application/json" } : {}) },
		...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }),
		seconds: 120,
	};
	let r = await world.ask(`${base}${path}`, init);
	// a read that got no answer is asked once more: seen on a local Cloudflare site, and not explained (scripts/plugin-api.mjs)
	if (r.status === 0 && method === "GET") r = await world.ask(`${base}${path}`, init);
	let json = null;
	try {
		json = JSON.parse(r.text);
	} catch {}
	return { status: r.status, ok: r.status >= 200 && r.status < 300, text: r.text, data: json?.data, error: json?.error };
};

/**
 * The plugins the site lacks, installed by the job behind plugin:install, agreeing to what each asks
 * for (--yes). It prints what that is, and ends by saying how it went: one it could not install is
 * a FAIL line of its own here.
 * @param {Ctx} ctx @returns {(plugins: string[]) => Promise<void>}
 */
const installer = ({ project }) => async (plugins) => {
	try {
		await pluginJob(["install", "--yes", `http://localhost:${project.builtPort}`, project.site, ...plugins]);
	} catch (e) {
		if (!(e instanceof Exit)) throw e;
	}
};

/**
 * Every recipe, one line each; the task fails when one did not hold.
 * @param {Ctx} ctx @param {Recipe[]} [list] @param {(plugins: string[]) => Promise<void>} [install]
 */
export const demo = async (ctx, list = recipes, install = installer(ctx)) => {
	const { world, project } = ctx;
	const origin = `http://localhost:${project.builtPort}`;
	world.say(`-> this machine, built site (site:preview): ${origin}`);
	const saved = join(world.config, "emdash-run", "tokens", `${savedName(origin, project.site)}.json`);
	const api = client(world, `${origin}/_emdash/api`, world.exists(saved) ? JSON.parse(world.read(saved)).token : "");
	const stranger = client(world, origin, "");
	const slug = (/** @type {Recipe} */ r) => reference(r.plugin).slug;
	const installed = async () => {
		const r = await api("GET", "/admin/plugins");
		if (r.status !== 200) throw new Error(`The site did not accept this machine's sign-in: GET /_emdash/api/admin/plugins answered ${said(r)}\nSign in first: mise run signin:token`);
		return (r.data?.items ?? []).filter((/** @type {any} */ p) => p.source === "registry");
	};
	let plugins = await installed();
	const missing = list.filter((r) => !plugins.some((/** @type {any} */ p) => p.registrySlug === slug(r)));
	if (missing.length) {
		world.say(`installing what the site does not have yet: ${missing.map(slug).join(", ")}`);
		await install(missing.map((r) => r.plugin));
		world.at("plugin:demo"); // (the install may have had other states reached, and what they print is under their names)
		plugins = await installed();
	}
	let failed = 0;
	for (const recipe of list) {
		// its id on this site, by the name the registry knows it by
		const plugin = plugins.find((/** @type {any} */ p) => p.registrySlug === slug(recipe));
		try {
			if (!plugin) throw new Error("it is not installed: the install, above, says why");
			/** @type {Site} */
			const site = {
				id: plugin.id,
				api,
				route: (method, route, body) => api(method, `/plugins/${plugin.id}/${route}`, body),
				visitor: (method, route, body) => stranger(method, `/_emdash/api/plugins/${plugin.id}/${route}`, body),
				page: (path) => stranger("GET", path),
				sleep: world.sleep,
			};
			const already = await recipe.proof(site).catch(() => "");
			if (!already) await recipe.make(site);
			world.say(`ok   ${slug(recipe)}: ${already ? `already so — ${already}` : await recipe.proof(site)}`);
		} catch (e) {
			failed++;
			world.say(`FAIL ${slug(recipe)}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	world.say(failed ? `${failed} of ${list.length} plugins did not do their real thing: the FAIL lines say what the site answered` : `all ${list.length} plugins did their real thing`);
	if (failed) throw new Exit(1);
};

/** @type {Graph} */
export const pluginDemo = {
	// A task for the site on this machine only stands on this first. Asked with --live it stops here,
	// before any other state is reached: a flag goes to every state a task stands on, and
	// signin:token --live would have signed in to the deployed site.
	"site:local-only": {
		done: ({ flags }) => !flags.live,
		work: () => {
			throw new Error("This task acts on the site on this machine only, and it was asked for the deployed one (--live). Nothing was done.");
		},
	},
	// Then what every task on registry plugins stands on here (pluginNeeds in tasks.mjs): the site
	// able to run sandboxed plugins, built, running, and this machine signed in to it.
	"plugin:demo": { needs: () => ["site:local-only", "plugin:sandbox", "signin:token"], work: (ctx) => demo(ctx) },
};
