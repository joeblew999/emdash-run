// The edits the plugin tasks make to astro.config.mjs (admin/plugin-config-edit.mjs), on the
// fixture configs in tests/fixtures/config/. Run by `mise run check`:  node --test "tests/*.test.mjs"
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { CannotEdit, addImport, addOption, addSandboxedPlugin, addToList, emdashCall, hasOption, imports, setSandboxRunner } from "../admin/plugin-config-edit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, "fixtures", "config", `${name}.mjs`), "utf8");
const tmp = mkdtempSync(join(tmpdir(), "config-edit-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
let n = 0;
// Node can still read it.
const parses = (text) => {
	const f = join(tmp, `c${n++}.mjs`);
	writeFileSync(f, text);
	const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
	assert.equal(r.status, 0, r.stderr);
};
// What the three tasks do to a config, one after the other: plugin:sandbox, plugin:new, and a
// native plugin's two lines.
const everything = (text, cloudflare) => {
	const a = setSandboxRunner(text, cloudflare);
	const b = addSandboxedPlugin(a, "save-log", "saveLog");
	const c = addImport(b, { module: "@emdash-cms/plugin-forms", named: "formsPlugin" });
	return addToList(c.text, "plugins", `${c.local}()`);
};
// The options of emdash({ … }) as text, and everything outside them.
const inside = (text) => {
	const { open, close } = emdashCall(text);
	return text.slice(open, close + 1);
};
const outside = (text) => {
	const { open, close } = emdashCall(text);
	return text.slice(0, open) + text.slice(close + 1);
};
const count = (text, part) => text.split(part).length - 1;

test("the starter template, Cloudflare: the runner, a sandboxed plugin and a native one", () => {
	const after = everything(fixture("starter-cloudflare"), true);
	parses(after);
	assert.match(after, /^import \{ d1, r2, sandbox \} from "@emdash-cms\/cloudflare";$/m, "sandbox joins the import that is there");
	assert.equal(count(after, '"@emdash-cms/cloudflare"'), 1);
	assert.match(after, /^import saveLog from "save-log";$/m);
	assert.match(after, /^import \{ formsPlugin \} from "@emdash-cms\/plugin-forms";$/m);
	assert.match(inside(after), /^\t\t\tsandboxRunner: sandbox\(\),$/m);
	assert.match(inside(after), /^\t\t\tsandboxed: \[saveLog\],$/m);
	assert.match(inside(after), /^\t\t\tplugins: \[formsPlugin\(\)\],$/m);
	assert.equal(everything(after, true), after, "run again: nothing changes");
});

test("the starter template, Node: the runner is a string, and there is no import for it", () => {
	const before = fixture("starter-node");
	const after = setSandboxRunner(before, false);
	parses(after);
	assert.match(inside(after), /^\t\t\tsandboxRunner: "@emdash-cms\/sandbox-workerd\/sandbox",$/m);
	assert.equal(outside(after), outside(before));
	assert.equal(setSandboxRunner(after, false), after);
	const all = everything(before, false);
	parses(all);
	assert.equal(everything(all, false), all);
});

test("a vite: { plugins: [ … ] } after emdash is never the one edited", () => {
	const before = fixture("vite-after");
	const after = everything(before, true);
	parses(after);
	assert.match(after, /\tvite: \{\n\t\tplugins: \[inspect\(\)\],\n\t\tsandboxRunner: "not EmDash's",\n\t\tsandboxed: \[early\],\n\t\},/, "vite's block is as it was");
	assert.match(after, /const early = \{ plugins: \[\], sandboxed: \[\] \};/, "and so is the object before the call");
	assert.match(after, /marketplace: \{ plugins: \["not-this-one"\] \},/, "and a plugins list one level down");
	assert.match(inside(after), /^\t\t\tplugins: \[formsPlugin\(\)\],$/m);
	assert.match(inside(after), /^\t\t\tsandboxed: \[saveLog\],$/m);
	assert.match(inside(after), /^\t\t\tsandboxRunner: sandbox\(\),$/m);
	assert.equal(everything(after, true), after);
});

test("everything already there: nothing changes, and no import is written twice", () => {
	const before = fixture("already");
	assert.equal(hasOption(before, "sandboxRunner"), true);
	assert.equal(everything(before, true), before);
	// the import alone, asked for again: sandbox is imported by the second line from that module
	assert.deepEqual(addImport(before, { module: "@emdash-cms/cloudflare", named: "sandbox" }), { text: before, local: "sandbox" });
	// a plugin called with options is the plugin
	assert.equal(addToList(before, "plugins", "formsPlugin()"), before);
});

test("a second entry joins the list that is there, laid out as it is", () => {
	const before = fixture("already");
	const after = addSandboxedPlugin(before, "@acme/other", "other");
	parses(after);
	assert.match(inside(after), /sandboxed: \[\n\t\t\t\tsaveLog,\n\t\t\t\tother,\n\t\t\t\],/);
	const native = addToList(before, "plugins", "auditLog()");
	parses(native);
	assert.match(inside(native), /plugins: \[formsPlugin\(\{ notify: true \}\), auditLog\(\)\],/);
	// a name imported under another name is used under that name
	const renamed = before.replace("import saveLog from", "import log from").replace("\t\t\t\tsaveLog,\n", "\t\t\t\tlog,\n");
	assert.equal(addSandboxedPlugin(renamed, "save-log", "saveLog"), renamed);
});

test("comments, strings, a template and a regular expression with braces in them", () => {
	const before = fixture("tricky");
	assert.equal(hasOption(before, "sandboxRunner"), false, "a commented-out option is not set");
	assert.equal(hasOption(before, "sandboxed"), false, "nor one inside a string or a regular expression");
	assert.equal(hasOption(before, "plugins"), true, "a quoted key is the option");
	assert.deepEqual(emdashCall(before).props.map((p) => p.name), ["database", "storage", "siteTitle", "plugins", "pattern", "label"]);
	const after = everything(before, true);
	parses(after);
	assert.match(after, /import \{\n\td1,\n\tr2,\n\tsandbox,\n\} from "@emdash-cms\/cloudflare";/, "sandbox joins a multi-line import");
	assert.match(inside(after), /"plugins": \[\n\t\t\t\t\/\/ none yet\n\t\t\t\tformsPlugin\(\),\n\t\t\t\],/);
	assert.match(inside(after), /^\t\t\tsandboxed: \[saveLog\],$/m);
	assert.match(after, /\tvite: \{ plugins: \[\] \},/);
	assert.ok(after.startsWith('// import { sandbox } from "@emdash-cms/cloudflare";   <- a comment, not an import\n/* emdash({ sandboxRunner: sandbox(), plugins: [ */\n'));
	assert.equal(everything(after, true), after);
	assert.throws(() => addImport(before, { module: "x", default: "local" }), CannotEdit, "a name the file already uses");
});

test("emdash({ … }) on one line", () => {
	const before = fixture("one-line");
	const after = everything(before, false);
	parses(after);
	assert.match(after, /emdash\(\{ plugins: \[formsPlugin\(\)\], sandboxRunner: "@emdash-cms\/sandbox-workerd\/sandbox", database: /);
	assert.match(after, /sandboxed: \[saveLog\] \}\)\],/);
	assert.equal(everything(after, false), after);
	const empty = 'import emdash from "emdash/astro";\nexport default { integrations: [emdash({})] };\n';
	assert.equal(addOption(empty, "sandboxed", "[a]"), 'import emdash from "emdash/astro";\nexport default { integrations: [emdash({ sandboxed: [a] })] };\n');
});

test("Windows line ends are kept", () => {
	const before = fixture("starter-cloudflare").replaceAll("\n", "\r\n");
	const after = everything(before, true);
	parses(after);
	assert.equal(count(after, "\r\n"), count(after, "\n"));
	assert.equal(everything(after, true), after);
});

test("an import with a default joins a module's named import, and the other way round", () => {
	const named = 'import { a } from "m";\nimport emdash from "emdash/astro";\n';
	assert.equal(addImport(named, { module: "m", default: "d" }).text, 'import d, { a } from "m";\nimport emdash from "emdash/astro";\n');
	const byDefault = 'import d from "m";\nimport emdash from "emdash/astro";\n';
	assert.equal(addImport(byDefault, { module: "m", named: "a" }).text, 'import d, { a } from "m";\nimport emdash from "emdash/astro";\n');
	assert.deepEqual(addImport('import { a as b } from "m";\n', { module: "m", named: "a" }), { text: 'import { a as b } from "m";\n', local: "b" });
	assert.equal(addImport("export default {};\n", { module: "m", named: "a" }).text, 'import { a } from "m";\nexport default {};\n');
	assert.equal(imports('import "side-effect";\nimport * as ns from "n";\nimport type { T } from "t";\n').map((i) => i.module).join(), "side-effect,n,t");
});

test("a shape it cannot edit safely: it says why, and returns nothing", () => {
	const refuses = (name, edit, why) => assert.throws(() => edit(fixture(name)), (e) => e instanceof CannotEdit && why.test(e.message), name);
	refuses("refuse-spread", (t) => setSandboxRunner(t, true), /spread/);
	refuses("refuse-spread", (t) => addSandboxedPlugin(t, "save-log", "saveLog"), /spread/);
	refuses("refuse-variable", (t) => setSandboxRunner(t, false), /not given its options written out/);
	refuses("refuse-variable", (t) => addSandboxedPlugin(t, "save-log", "saveLog"), /not given its options written out/);
	refuses("refuse-two-calls", (t) => setSandboxRunner(t, false), /2 times/);
	refuses("refuse-list", (t) => addSandboxedPlugin(t, "save-log", "saveLog"), /sandboxed .* is not a list written out/);
	refuses("refuse-list", (t) => addToList(t, "plugins", "x()"), /plugins .* is more than a list/);
	assert.throws(() => setSandboxRunner("export default {};\n", false), /does not import EmDash's integration/);
	assert.throws(() => setSandboxRunner('import emdash from "emdash/astro";\nexport default {};\n', false), /never calls emdash/);
});
