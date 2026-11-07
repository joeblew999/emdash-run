// The two custom rules live:zone writes (scripts/live-zone.mjs): the user agents they catch and the
// ones they leave, worked out here the way Cloudflare's `contains` does. Run by `mise run check`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { oldChrome, oldIos, rules } from "../../scripts/live-zone.mjs";

const caught = (/** @type {string} */ ua) => oldChrome().some((p) => ua.includes(p)) || oldIos().some((p) => ua.includes(p));
const chrome = (/** @type {number} */ v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`;
const ios = (/** @type {number} */ v, device = "iPhone; CPU iPhone OS") => `Mozilla/5.0 (${device} ${v}_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v}.1 Mobile/15E148 Safari/604.1`;

test("every Chrome before 140 is caught, and 140 to 199 are not", () => {
	for (let v = 2; v < 140; v++) assert.ok(caught(chrome(v)), `Chrome ${v}`);
	for (let v = 140; v < 200; v++) assert.ok(!caught(chrome(v)), `Chrome ${v}`);
});

test("iOS 15 and earlier are caught on iPhone and iPad, and 16 and later are not", () => {
	for (let v = 2; v <= 15; v++) {
		assert.ok(caught(ios(v)), `iPhone iOS ${v}`);
		assert.ok(caught(ios(v, "iPad; CPU OS")), `iPad iOS ${v}`);
	}
	for (let v = 16; v <= 30; v++) {
		assert.ok(!caught(ios(v)), `iPhone iOS ${v}`);
		assert.ok(!caught(ios(v, "iPad; CPU OS")), `iPad iOS ${v}`);
	}
});

test("today's Safari on a Mac and Firefox are not caught", () => {
	assert.ok(!caught("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15"));
	assert.ok(!caught("Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0"));
});

test("both rules are for the one host, leave verified bots alone, and fit Cloudflare's 4096 characters", () => {
	const [challenge, probes] = rules("www.example.com");
	for (const r of [challenge, probes]) {
		assert.ok(r.expression.startsWith('(http.host eq "www.example.com" and'));
		assert.ok(r.expression.length < 4096, `${r.expression.length} characters`);
		assert.ok(!r.expression.includes(" matches "), "no regular expression: the Free plan has none");
	}
	assert.equal(challenge.action, "managed_challenge");
	assert.ok(challenge.expression.includes("not cf.client.bot"));
	assert.equal(probes.action, "block");
	assert.throws(() => rules('x" or true or "'));
});
