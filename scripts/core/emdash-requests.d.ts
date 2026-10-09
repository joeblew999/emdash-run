// The requests the tasks make of EmDash's HTTP API themselves: what EmDash's own client
// (emdash-client.mjs) has no call for. A path, a method, a body and an answer here are EmDash's own
// account of them — emdash-api.d.ts, which `mise run dev:api-types` writes from emdash-openapi.json
// — so a request EmDash does not have, or a body it would not take, fails `mise run dev:types`.
//
// Types only: nothing here runs. Written by hand; the generated file is emdash-api.d.ts.
import type { components, paths } from "./emdash-api.js";

export type Shapes = components["schemas"];

/** One request: what it is given in its path, its query and its body, and the data it answers with. `never`: it takes none. */
export interface Asked<Path, Query, Body, Data> {
	path: Path;
	query: Query;
	body: Body;
	data: Data;
}

type Method = "get" | "post" | "put" | "patch" | "delete";
/** The data of whichever answer says yes. */
type Answered<R> = { [S in keyof R]: S extends 200 | 201 ? (R[S] extends { content: { "application/json": { data: infer D } } } ? D : never) : never }[keyof R];
/** A request as the generated list has one, in the form above. */
type Listed<O> = Asked<
	O extends { parameters: { path: infer P } } ? P : never,
	O extends { parameters: { query?: infer Q } } ? Exclude<Q, undefined> : never,
	O extends { requestBody?: infer B } ? (Exclude<B, undefined> extends { content: { "application/json": infer J } } ? J : never) : never,
	O extends { responses: infer R } ? Answered<R> : never
>;
/** EmDash's list, by path (without the /_emdash/api every one of them starts with) and method. */
type List = {
	[P in keyof paths as P extends `/_emdash/api${infer Rest}` ? Rest : never]: { [M in Method as paths[P][M] extends object ? M : never]: Listed<paths[P][M]> };
};

// ─── where the list (EmDash 1.2.0) and the site differ ──────────────────────────────────────────
// Each of these was asked of a running site; the shapes are EmDash's own, from its source
// (src/api/schemas, src/astro/routes/api). They go when the list has them.

/** A byline, as the site answers one. */
interface Byline {
	id: string;
	slug: string;
	displayName: string;
	bio: string | null;
	websiteUrl: string | null;
	isGuest: boolean;
}
/** An API token as the site lists one: never the token itself. */
interface TokenInfo {
	id: string;
	name: string;
	prefix: string;
	scopes: string[];
}
interface Backups {
	settings: { enabled: boolean; retention: number };
	archives: { name: string; size: number; lastModified: string }[];
	storageAvailable: boolean;
}
interface Relation {
	slug: string;
	parentCollection: string;
	childCollection: string;
	parentLabel: string;
	parentLabelSingular?: string | null;
	childLabel: string;
	childLabelSingular?: string | null;
	maxChildrenPerParent?: number | null;
	maxParentsPerChild?: number | null;
}

/** Requests the site answers that the list does not have. */
interface Unlisted {
	// the list has this as PUT: the site answers PUT with its "not found" page, and POST with the settings
	"/settings": { post: List["/settings"]["put"] };
	"/relations": { get: Asked<never, never, never, { relations: Relation[] }>; post: Asked<never, never, Relation, unknown> };
	"/taxonomies": { post: Asked<never, never, { name: string; label: string; labelSingular?: string; hierarchical?: boolean; collections?: string[]; locale?: string }, unknown> };
	"/admin/bylines": {
		get: Asked<never, { search?: string }, never, { items: Byline[] }>;
		post: Asked<never, never, { slug: string; displayName: string; bio?: string | null; websiteUrl?: string | null; isGuest?: boolean }, Byline>;
	};
	"/content/{collection}/{id}/revisions": { get: Asked<{ collection: string; id: string }, never, never, { items: unknown[]; total: number }> };
	"/content/{collection}/{id}/preview-url": { post: Asked<{ collection: string; id: string }, never, { expiresIn?: string | number; pathPattern?: string }, { url: string; expiresAt: number }> };
	"/admin/api-tokens": {
		get: Asked<never, never, never, { items: TokenInfo[] }>;
		// (the answer also holds the new token, once: it is not named here, so that nothing can read it)
		post: Asked<never, never, { name: string; scopes: string[]; expiresAt?: string }, { info: TokenInfo }>;
	};
	"/settings/backups": { get: Asked<never, never, never, Backups>; put: Asked<never, never, Backups["settings"], Backups["settings"]> };
	"/settings/backups/archives": { post: Asked<never, never, never, Backups["archives"][number]> };
}
/** Requests the list has, and the site answers otherwise. */
interface Corrected {
	// the list says a bare collection: the site answers { item }, and with it whether comments are on
	"/schema/collections/{slug}": {
		get: Asked<{ slug: string }, { includeFields?: string }, never, { item: Shapes["Collection"] & { commentsEnabled: boolean; commentsModeration: string } }>;
	};
}
/** Requests the list has that the site does not answer. */
interface Refused {
	"/settings": "put";
}

/** Every request the tasks may make: the list, as corrected. */
export type Requests = {
	[P in keyof List | keyof Unlisted]: Omit<P extends keyof List ? Omit<List[P], P extends keyof Refused ? Refused[P] : never> : unknown, P extends keyof Corrected ? keyof Corrected[P] : never> &
		(P extends keyof Unlisted ? Unlisted[P] : unknown) &
		(P extends keyof Corrected ? Corrected[P] : unknown);
};

/** What a request is to be given: its path's names, its query, its body — each asked for only where the request has one. */
export type Given<R> =
	R extends Asked<infer Path, infer Query, infer Body, unknown>
		? ([Path] extends [never] ? { path?: never } : { path: Path }) & ([Query] extends [never] ? { query?: never } : { query?: Query }) & ([Body] extends [never] ? { body?: never } : { body?: Body })
		: never;
export type Data<R> = R extends Asked<unknown, unknown, unknown, infer D> ? D : never;
/** (nothing has to be given to a request that takes nothing) */
type Rest<G> = {} extends G ? [given?: G] : [given: G];

/** A request, sent: the data of its answer — or, refused, what the site said, thrown. */
export type Send = <P extends keyof Requests, M extends keyof Requests[P]>(method: M, path: P, ...given: Rest<Given<Requests[P][M]>>) => Promise<Data<Requests[P][M]>>;
type Get<P extends keyof Requests> = Requests[P] extends { get: infer G } ? G : never;
/** A GET of one thing: its data, or null when the site has no such thing. */
export type Find = <P extends keyof Requests>(path: P, ...given: Rest<Given<Get<P>>>) => Promise<Data<Get<P>> | null>;
