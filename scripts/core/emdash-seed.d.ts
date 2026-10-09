// An EmDash seed file, as EmDash's own types have it (src/seed/types.ts in its package, EmDash
// 1.2.0; the same as https://emdashcms.com/seed.schema.json). Kept in step by hand, and only what
// site:seed and site:demo read: the package is the site's, not this repo's, and the type check
// has to pass where no site is installed.
//
// Types only: nothing here runs. A file is these once EmDash's own check has passed it (validateSeed).
import type { Shapes } from "./emdash-requests.js";

export interface Seed {
	$schema?: string;
	version: "1";
	defaultLocale?: string;
	meta?: { name?: string; description?: string; author?: string };
	/** (as the site takes them: one key at a time) */
	settings?: Shapes["SettingsUpdateBody"];
	collections?: SeedCollection[];
	blockTypes?: unknown[];
	relations?: SeedRelation[];
	taxonomies?: SeedTaxonomy[];
	menus?: SeedMenu[];
	redirects?: SeedRedirect[];
	widgetAreas?: SeedWidgetArea[];
	sections?: SeedSection[];
	bylines?: SeedByline[];
	/** by collection */
	content?: Record<string, SeedEntry[]>;
}

type Support = "drafts" | "revisions" | "preview" | "scheduling" | "search" | "seo";

export interface SeedCollection {
	slug: string;
	label: string;
	labelSingular?: string;
	description?: string;
	icon?: string;
	admin?: { listColumns?: string[]; quickCreate?: boolean };
	supports?: Support[];
	urlPattern?: string;
	routable?: boolean;
	hidden?: boolean;
	sortOrder?: number;
	group?: string;
	commentsEnabled?: boolean;
	editLocking?: boolean;
	titleField?: string;
	dateField?: string;
	fields: SeedField[];
}

export interface SeedField {
	slug: string;
	label: string;
	type: Shapes["CreateFieldBody"]["type"];
	required?: boolean;
	unique?: boolean;
	searchable?: boolean;
	indexed?: boolean;
	translatable?: boolean;
	defaultValue?: unknown;
	validation?: Shapes["CreateFieldBody"]["validation"];
	widget?: string;
	options?: Record<string, unknown>;
}

export interface SeedRelation {
	slug: string;
	parentCollection: string;
	childCollection: string;
	parentLabel: string;
	parentLabelSingular?: string;
	childLabel: string;
	childLabelSingular?: string;
	maxChildrenPerParent?: number | null;
	maxParentsPerChild?: number | null;
}

export interface SeedTaxonomy {
	id?: string;
	name: string;
	label: string;
	labelSingular?: string;
	hierarchical?: boolean;
	collections?: string[];
	locale?: string;
	translationOf?: string;
	terms?: SeedTerm[];
}

export interface SeedTerm {
	id?: string;
	slug: string;
	label: string;
	description?: string;
	/** the slug of the term it is under */
	parent?: string;
	locale?: string;
	translationOf?: string;
}

export interface SeedMenu {
	id?: string;
	name: string;
	label: string;
	locale?: string;
	translationOf?: string;
	items: SeedMenuItem[];
}

export interface SeedMenuItem {
	id?: string;
	type: Shapes["CreateMenuItemBody"]["type"];
	label?: string;
	/** a custom item's address */
	url?: string;
	/** a page or a post: the id the entry has in the file */
	ref?: string;
	collection?: string;
	target?: "_blank" | "_self";
	titleAttr?: string;
	cssClasses?: string;
	locale?: string;
	translationOf?: string;
	children?: SeedMenuItem[];
}

export interface SeedRedirect {
	source: string;
	destination: string;
	type?: 301 | 302 | 307 | 308;
	enabled?: boolean;
	groupName?: string | null;
}

export interface SeedWidgetArea {
	name: string;
	label: string;
	description?: string;
	widgets: SeedWidget[];
}

export interface SeedWidget {
	type: "content" | "menu" | "component";
	title?: string;
	content?: Record<string, unknown>[];
	menuName?: string;
	componentId?: string;
	/** (in the format, and dropped by EmDash's own seeding: a widget's options are its props) */
	settings?: unknown;
	props?: Record<string, unknown>;
}

export interface SeedSection {
	slug: string;
	title: string;
	description?: string;
	keywords?: string[];
	content: Record<string, unknown>[];
	source?: "theme" | "user" | "import";
}

export interface SeedByline {
	/** the id a credit names it by, in the file */
	id: string;
	slug: string;
	displayName: string;
	bio?: string;
	websiteUrl?: string;
	isGuest?: boolean;
	avatar?: unknown;
}

export interface SeedEntry {
	/** the id a "$ref:" and a menu item name it by, in the file */
	id: string;
	slug?: string | null;
	status?: "published" | "draft";
	data: Record<string, unknown>;
	/** taxonomy -> the slugs of its terms */
	taxonomies?: Record<string, string[]>;
	bylines?: { byline: string; roleLabel?: string }[];
	locale?: string;
	translationOf?: string;
}

/** A picture a field names by its address. */
export interface SeedPicture {
	url: string;
	alt?: string;
	filename?: string;
	caption?: string;
}
