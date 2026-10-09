import { getI18nConfig } from "emdash";

/**
 * The address of a path of the site in a language (astro.config.mjs: i18n):
 * as it is in the site's first language, under /<language> in any other.
 * "/posts/hello" is "/fr/posts/hello" in French, and "/" is "/fr/".
 */
export function localePath(locale: string | undefined, path: string): string {
	const first = getI18nConfig()?.defaultLocale;
	if (!locale || !first || locale === first) return path;
	return `/${locale}${path}`;
}
