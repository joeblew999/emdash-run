// A made-up EmDash for the tests of site:seed and site:demo: as much of its API, and of the pages
// it serves, as those two ask of it. It keeps what it is sent, and answers in the shapes EmDash
// 1.2.0 was seen to answer in. Given to the made-up world (fake-world.mjs) as its `answers`.

export const TOKEN = "ec_pat_SAVED"; // what signin:token saved on this machine
export const SHOWN_ONCE = "ec_pat_SHOWN_ONCE"; // what EmDash answers a new API token with
export const SIGNATURE = "SIGNED"; // what makes a link a preview link

/**
 * It starts as a site just made from EmDash's starter template does: its model, a primary menu, a
 * sidebar, a title — and nothing in them.
 */
export const emdash = () => {
	/** @type {Record<string, any[]>} */
	const has = {
		collections: [
			{ slug: "posts", label: "Posts", commentsEnabled: false, commentsModeration: "first_time", fields: [{ slug: "title" }, { slug: "featured_image" }, { slug: "content" }, { slug: "excerpt" }] },
			{ slug: "pages", label: "Pages", commentsEnabled: false, commentsModeration: "first_time", fields: [{ slug: "title" }, { slug: "content" }] },
		],
		taxonomies: [{ name: "category" }, { name: "tag" }],
		menus: [{ name: "primary", items: [] }],
		areas: [{ name: "sidebar", widgets: [] }],
		relations: [], terms: [], media: [], bylines: [], entries: [], sections: [], comments: [], redirects: [], tokens: [], archives: [],
	};
	/** @type {Record<string, unknown>} */
	const settings = { title: "My Site", tagline: "Built with EmDash" };
	const backups = { enabled: false, retention: 7 };
	let ids = 0;
	/** every request it was sent @type {{ method: string, path: string, signed: boolean }[]} */
	const asked = [];

	const yes = (/** @type {unknown} */ data, status = 200) => ({ status, text: JSON.stringify({ success: true, data }) });
	const no = (/** @type {number} */ status, /** @type {string} */ code, /** @type {string} */ message) => ({ status, text: JSON.stringify({ success: false, error: { code, message } }) });
	const page = (/** @type {string} */ body) => ({ status: 200, text: `<!DOCTYPE html><html>${body}</html>`, headers: { "content-type": "text/html" } });
	/** Kept in a list, with an id of its own. @param {any[]} list @param {Record<string, unknown>} thing @returns {any} */
	const keep = (list, thing) => {
		list.push({ id: `ID${++ids}`, ...thing });
		return list.at(-1);
	};
	/** @param {any[]} list @param {string} field @param {unknown} value @returns {any} */
	const by = (list, field, value) => list.find((x) => x[field] === value);
	/** What is there, or EmDash's own "not found". @param {unknown} thing @param {string} what @param {(thing: any) => unknown} [as] */
	const found = (thing, what, as = (x) => x) => (thing ? yes(as(thing)) : no(404, "NOT_FOUND", `${what} not found`));
	const entry = (/** @type {string} */ type, /** @type {string} */ key) => has.entries.find((e) => e.type === type && (e.id === key || e.slug === key));
	const withRev = (/** @type {any} */ e, status = 200) => yes({ item: e, _rev: `rev${e.version}` }, status);
	const commentsOff = () => (by(has.collections, "slug", "posts").commentsEnabled ? null : no(403, "COMMENTS_DISABLED", "Comments are not enabled for this collection"));

	// the API: a method, a path, what it answers — and `true` where a visitor may ask it too
	/** @type {[string, RegExp, (at: string[], body: any, query: URLSearchParams) => { status: number, text: string }, boolean?][]} */
	const api = [
		["GET", /^\/settings$/, () => yes(settings)],
		// (a group of settings sent in part is put beside the rest of the group: what is not sent stays)
		["POST", /^\/settings$/, (_, body) => yes(Object.assign(settings, Object.fromEntries(Object.entries(body).map(([key, value]) => [key, key === "seo" || key === "social" ? { .../** @type {any} */ (settings[key]), .../** @type {any} */ (value) } : value]))))],
		["GET", /^\/schema\/collections\/(\w+)$/, ([, slug]) => found(by(has.collections, "slug", slug), `Collection not found: ${slug}`, (item) => ({ item }))],
		["POST", /^\/schema\/collections$/, (_, body) => yes({ item: keep(has.collections, { commentsEnabled: false, fields: [], ...body }) }, 201)],
		["PUT", /^\/schema\/collections\/(\w+)$/, ([, slug], body) => yes({ item: Object.assign(by(has.collections, "slug", slug), body) })],
		["POST", /^\/schema\/collections\/(\w+)\/fields$/, ([, slug], body) => found(by(has.collections, "slug", slug), `Collection not found: ${slug}`, (c) => ({ item: keep(c.fields, body) }))],
		["GET", /^\/relations$/, () => yes({ relations: has.relations })],
		["POST", /^\/relations$/, (_, body) => yes({ relation: keep(has.relations, body) }, 201)],
		["GET", /^\/taxonomies\/(\w+)$/, ([, name]) => found(by(has.taxonomies, "name", name), `Taxonomy '${name}'`, (taxonomy) => ({ taxonomy }))],
		["POST", /^\/taxonomies$/, (_, body) => yes({ taxonomy: keep(has.taxonomies, body) }, 201)],
		["GET", /^\/taxonomies\/(\w+)\/terms$/, ([, name]) => yes({ terms: has.terms.filter((t) => t.name === name) })],
		["GET", /^\/taxonomies\/(\w+)\/terms\/([\w-]+)$/, ([, name, slug]) => found(has.terms.find((t) => t.name === name && t.slug === slug), `Term '${slug}'`, (term) => ({ term }))],
		["POST", /^\/taxonomies\/(\w+)\/terms$/, ([, name], body) => (by(has.taxonomies, "name", name) ? yes({ term: keep(has.terms, { name, parentId: null, ...body }) }, 201) : no(404, "NOT_FOUND", `Taxonomy '${name}' not found`))],
		["GET", /^\/media$/, (_, __, query) => yes({ items: has.media.filter((m) => m.filename.includes(query.get("q") ?? "")) })],
		["POST", /^\/media$/, (_, form) => yes({ item: keep(has.media, { filename: form.get("file").name, mimeType: form.get("file").type, width: Number(form.get("width") ?? 1200), height: Number(form.get("height") ?? 800), alt: form.get("alt"), caption: form.get("caption"), focalX: null, focalY: null, url: "/_emdash/api/media/file/KEY.png" }) }, 201)],
		["PUT", /^\/media\/(\w+)$/, ([, id], body) => yes({ item: Object.assign(by(has.media, "id", id), body) })],
		["GET", /^\/admin\/bylines$/, (_, __, query) => yes({ items: has.bylines.filter((b) => b.slug.includes(query.get("search") ?? "")) })],
		["POST", /^\/admin\/bylines$/, (_, body) => yes(keep(has.bylines, body), 201)],
		["GET", /^\/content\/(\w+)$/, ([, type], _, query) => yes({ items: has.entries.filter((e) => e.type === type && e.status === (query.get("status") ?? e.status)) })],
		["POST", /^\/content\/(\w+)$/, ([, type], body) => {
			// a reference field that is bound to a relation is given beside the data, not in it
			const bound = (by(has.collections, "slug", type)?.fields ?? []).filter((/** @type {any} */ f) => f.validation?.relation && f.slug in body.data).map((/** @type {any} */ f) => f.slug);
			if (bound.length) return no(400, "VALIDATION_ERROR", `Reference fields bound to a relation are set through 'references', not 'data': ${bound.join(", ")}`);
			if (entry(type, body.slug)) return no(409, "CONFLICT", `The slug '${body.slug}' is taken`);
			return withRev(keep(has.entries, { type, status: "draft", version: 1, revisions: 0, publishedAt: null, scheduledAt: null, bylines: [], seo: {}, taxonomies: {}, ...body }), 201);
		}],
		["GET", /^\/content\/(\w+)\/([\w-]+)$/, ([, type, key]) => (entry(type, key) ? withRev(entry(type, key)) : no(404, "NOT_FOUND", `Content item not found: ${key}`))],
		// An update has to give back the _rev of what it changes. One of the entry's data is a revision of
		// its own; one of only what search engines read is not.
		["PUT", /^\/content\/(\w+)\/(\w+)$/, ([, type, key], { _rev, data, ...more }) => {
			const e = entry(type, key);
			if (_rev !== `rev${e.version}`) return no(409, "CONFLICT", "Content has been modified since last read (version conflict)");
			Object.assign(e, more, { data: { ...e.data, ...data }, version: e.version + 1, revisions: e.revisions + (data ? 1 : 0) });
			return withRev(e);
		}],
		["POST", /^\/content\/(\w+)\/(\w+)\/(publish|unpublish|schedule)$/, ([, type, key, verb], body) => {
			const e = entry(type, key);
			Object.assign(e, verb === "publish" ? { status: "published", publishedAt: "2026-01-01T00:00:00.000Z", revisions: e.revisions || 1 } : verb === "unpublish" ? { status: "draft" } : { status: "scheduled", scheduledAt: body.scheduledAt });
			e.version++;
			return withRev(e);
		}],
		["GET", /^\/content\/(\w+)\/(\w+)\/revisions$/, ([, type, key]) => yes({ items: [], total: entry(type, key).revisions })],
		["GET", /^\/content\/(\w+)\/(\w+)\/terms\/(\w+)$/, ([, type, key, name]) => yes({ terms: entry(type, key).taxonomies[name] ?? [] })],
		["POST", /^\/content\/(\w+)\/(\w+)\/preview-url$/, ([, type, key]) => yes({ url: `/${type}/${entry(type, key).slug}?_preview=${SIGNATURE}` })],
		["GET", /^\/menus\/([\w-]+)$/, ([, name]) => found(by(has.menus, "name", name), `Menu '${name}'`)],
		["POST", /^\/menus$/, (_, body) => yes({ name: keep(has.menus, { ...body, items: [] }).name }, 201)],
		["POST", /^\/menus\/([\w-]+)\/items$/, ([, name], body) => yes(keep(by(has.menus, "name", name).items, { parentId: null, customUrl: null, referenceId: null, ...body }), 201)],
		["GET", /^\/widget-areas\/([\w-]+)$/, ([, name]) => found(by(has.areas, "name", name), `Widget area "${name}"`)],
		["POST", /^\/widget-areas$/, (_, body) => yes({ name: keep(has.areas, { ...body, widgets: [] }).name }, 201)],
		["POST", /^\/widget-areas\/([\w-]+)\/widgets$/, ([, name], body) => yes(keep(by(has.areas, "name", name).widgets, body), 201)],
		["GET", /^\/sections\/([\w-]+)$/, ([, slug]) => found(by(has.sections, "slug", slug), `Section "${slug}"`)],
		["POST", /^\/sections$/, (_, body) => yes(keep(has.sections, body), 201)],
		["GET", /^\/comments\/posts\/(\w+)$/, ([, id]) => commentsOff() ?? yes({ items: has.comments.filter((c) => c.on === id) }), true],
		["POST", /^\/comments\/posts\/(\w+)$/, ([, id], body) => commentsOff() ?? yes({ id: keep(has.comments, { on: id, parentId: null, ...body }).id, status: "approved" }, 201), true],
		["GET", /^\/redirects$/, (_, __, query) => yes({ items: has.redirects.filter((r) => r.source.includes(query.get("search") ?? "")) })],
		["POST", /^\/redirects$/, (_, body) => yes(keep(has.redirects, body), 201)],
		["GET", /^\/search$/, (_, __, query) => yes({ items: has.entries.filter((e) => e.status === "published" && e.data.title.toLowerCase().includes(query.get("q"))).map((e) => ({ slug: e.slug, title: e.data.title })) }), true],
		["GET", /^\/admin\/api-tokens$/, () => yes({ items: has.tokens })],
		["POST", /^\/admin\/api-tokens$/, (_, body) => yes({ token: SHOWN_ONCE, info: keep(has.tokens, body) }, 201)],
		["GET", /^\/settings\/backups$/, () => yes({ settings: backups, archives: has.archives, storageAvailable: true })],
		["PUT", /^\/settings\/backups$/, (_, body) => yes(Object.assign(backups, body))],
		["POST", /^\/settings\/backups\/archives$/, () => yes(keep(has.archives, { name: "emdash-backup.json" }), 201)],
	];

	const site = {
		has,
		settings,
		asked,
		/** the requests it answers with a server error, while this is set @type {RegExp | null} */
		refuses: null,
		/** What it changed: every request but the reads — and but the asking for a preview link, which makes a signature and keeps nothing. */
		writes: () => asked.filter((a) => a.method !== "GET" && !a.path.endsWith("/preview-url")).map((a) => `${a.method} ${a.path.replace("/_emdash/api", "").replace(/\/ID\d+/g, "/{id}")}`),
		/** @param {string} url @param {RequestInit} [init] @returns {{ status: number, text?: string, headers?: Record<string, string> }} */
		answers: (url, init = {}) => {
			const { pathname, searchParams } = new URL(url);
			const method = init.method ?? "GET";
			const signed = /** @type {Record<string, string>} */ (init.headers ?? {}).Authorization === `Bearer ${TOKEN}`;
			asked.push({ method, path: pathname, signed });
			if (site.refuses?.test(`${method} ${pathname}`)) return no(500, "INTERNAL_ERROR", "the database is locked");
			if (pathname.startsWith("/_emdash/api/media/file/")) return { status: 200, text: "the picture", headers: { "content-type": "image/png" } };
			if (pathname.startsWith("/_emdash/api/")) {
				for (const [verb, path, answer, open] of api) {
					const at = verb === method ? path.exec(pathname.slice("/_emdash/api".length)) : null;
					if (!at) continue;
					if (!open && !signed) return no(401, "UNAUTHORIZED", "Authentication required");
					return answer(at, typeof init.body === "string" ? JSON.parse(init.body) : init.body, searchParams);
				}
				return { ...page("<title>Not Found</title>"), status: 404 }; // (what the real one answers a request it has no route for)
			}
			// the pages a visitor is served
			if (pathname === "/") {
				// (the site's icon and the picture for a shared link, once the settings name them: each by the
				// address the library gives that picture)
				const icon = by(has.media, "id", /** @type {any} */ (settings.favicon)?.mediaId);
				const shared = by(has.media, "id", /** @type {any} */ (settings.seo)?.defaultOgImage?.mediaId);
				return page(`<title>${settings.title}</title>${icon ? `<link rel="icon" href="${icon.url}" type="${icon.mimeType}">` : ""}${shared ? `<meta property="og:image" content="http://localhost:4322${shared.url}">` : ""}<nav>${by(has.menus, "name", "primary").items.map((/** @type {any} */ i) => `<a>${i.label}</a>`).join("")}</nav>`);
			}
			// what the settings say to robots, with the line EmDash adds
			if (pathname === "/robots.txt") return { status: 200, text: `${/** @type {any} */ (settings.seo)?.robotsTxt ?? "User-agent: *\nAllow: /"}\n\nSitemap: http://localhost:4322/sitemap.xml\n` };
			const post = entry("posts", /^\/posts\/([\w-]+)$/.exec(pathname)?.[1] ?? "");
			if (post) return post.status === "published" || searchParams.get("_preview") === SIGNATURE ? page(`<h1>${post.data.title}</h1>${post.data.featured_image ? `<img alt="${post.data.featured_image.alt}">` : ""}`) : { status: 302, headers: { location: "/404" } };
			const sent = by(has.redirects, "source", pathname);
			return sent ? { status: sent.type, headers: { location: sent.destination } } : { status: 404 };
		},
	};
	return site;
};
