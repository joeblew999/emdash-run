// What a release declares, as plugin:update prints and compares it (accessOf in scripts/plugin-api.mjs).
import assert from "node:assert/strict";
import { test } from "node:test";

import { accessOf, reference } from "../../scripts/plugin-api.mjs";

const release = (/** @type {Record<string, unknown>} */ declaredAccess) => ({ version: "1.0.0", release: { extensions: { "com.emdashcms.experimental.package.releaseExtension": { declaredAccess } } } });
const more = (/** @type {unknown} */ from, /** @type {unknown} */ to) => accessOf(to).filter((a) => !accessOf(from).includes(a));

test("a release's declared access, one line each", () => {
	assert.deepEqual(accessOf(release({ content: { read: {}, write: {} }, email: { send: {} } })), ["content.read", "content.write", "email.send"]);
	assert.deepEqual(accessOf(release({ network: { request: { allowedHosts: ["b.example", "a.example"] } } })), ["network.request to a.example", "network.request to b.example"]);
	assert.deepEqual(accessOf(release({ network: { request: {} } })), ["network.request to any host"]);
	assert.deepEqual(accessOf(release({ network: { request: { allowedHosts: [] } } })), ["network.request to no host"]);
	assert.deepEqual(accessOf({ version: "1.0.0", release: {} }), []);
});

test("what a newer release asks for that the installed one did not", () => {
	const old = release({ content: { read: {} }, network: { request: { allowedHosts: ["a.example"] } } });
	assert.deepEqual(more(old, old), []);
	assert.deepEqual(more(old, release({ content: { read: {}, write: {} }, network: { request: { allowedHosts: ["a.example"] } } })), ["content.write"]);
	assert.deepEqual(more(old, release({ content: { read: {} }, network: { request: { allowedHosts: ["a.example", "evil.example"] } } })), ["network.request to evil.example"], "one more host is more");
	assert.deepEqual(more(old, release({ content: { read: {} }, network: { request: {} } })), ["network.request to any host"], "dropping the list of hosts is more");
	assert.deepEqual(more(old, release({ content: { read: {} } })), [], "asking for less is not more");
});

test("a plugin is named <publisher>/<slug>, with or without @ and a version", () => {
	assert.deepEqual(reference("@netdollar.dev/forms@0.1.0"), { publisher: "netdollar.dev", slug: "forms", name: "@netdollar.dev/forms", version: "0.1.0" });
	assert.deepEqual(reference("netdollar.dev/forms"), { publisher: "netdollar.dev", slug: "forms", name: "@netdollar.dev/forms", version: null });
});
