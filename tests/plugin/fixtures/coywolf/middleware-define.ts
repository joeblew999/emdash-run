import { REGISTRY_CONTACT_FORMS_ID } from "@masonjames/emdash-contact-forms/registry-embed";
import { defineMiddleware } from "astro:middleware";
import { withEmDashRuntime } from "emdash/middleware";

// Why this is here: Contact Forms' block (astro.config.mjs) draws its form on the server, and
// asks the plugin which fields it has through locals.emdash.handlePluginApiRoute. EmDash 1.2.0
// gives a page asked for by a visitor a short locals.emdash that has no such function (a signed-in
// editor's page has the whole one), so a visitor read "This form is currently unavailable."
// where the form should be.
//
// This gives a visitor's page that one question and no other: a form's fields, its button and its
// thank-you, which are what the page shows anyway. Nothing is opened to requests: the question is
// asked while the page is drawn, and the plugin's route stays signed-in-only over HTTP.
//
// To take it out: when the package asks for its form through a route open to visitors, or EmDash
// gives a visitor's page the function again, delete this file.
const FORM_OF = "/forms/list";

export const onRequest = defineMiddleware((context, next) => {
	const emdash = context.locals.emdash;
	if (emdash && typeof emdash.handlePluginApiRoute !== "function") {
		emdash.handlePluginApiRoute = async (pluginId, method, path, request) => {
			if (pluginId !== REGISTRY_CONTACT_FORMS_ID || method !== "POST" || path !== FORM_OF) {
				return { success: false, error: { code: "NOT_FOUND", message: "Plugin route not found" } };
			}
			return withEmDashRuntime((runtime) => runtime.handlePluginApiRoute(pluginId, method, path, request));
		};
	}
	return next();
});
