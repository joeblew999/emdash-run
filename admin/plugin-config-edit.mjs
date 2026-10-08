// The edits the plugin tasks make to a site's astro.config.mjs, as functions from text to text.
// No file is read or written here: admin/plugin-site.mjs does that, and tests/config-edit.test.mjs
// runs these on fixture texts.
//
// Every edit
//   - acts only inside the ONE emdash({ … }) call, at the top level of its own braces: braces are
//     matched, and strings, template text, comments and regular expressions are skipped. A
//     `plugins: [` under `vite:` is never touched;
//   - changes nothing when what it would add is already there. An import is merged into an
//     import from the same module, never written a second time;
//   - throws CannotEdit, with the reason, when the file is not of a shape it can edit safely.
//     Nothing is half-edited: the caller writes the text only when every edit returned.
//
// EmDash has no command that writes these lines: `emdash-plugin init` and `pnpm add` leave them to
// the developer, and `create-emdash --sandboxed-plugins` does not switch the sandbox on
// (docs/upstream.md).

export class CannotEdit extends Error {}

const CODE = 0;
const COMMENT = 1;
const TEXT = 2; // a string, template text or a regular expression: its quotes too

// What each character of the source is: code, comment or text.
export const kinds = (text) => {
	const kind = new Uint8Array(text.length);
	const n = text.length;
	const mark = (from, to, as) => kind.fill(as, from, Math.min(to, n));
	const modes = [{ template: false, depth: 0, inTemplate: false }];
	let prev = ""; // the last character of code that was not white space
	let i = 0;
	while (i < n) {
		const top = modes.at(-1);
		const c = text[i];
		const d = text[i + 1];
		if (top.template) {
			if (c === "\\") {
				mark(i, i + 2, TEXT);
				i += 2;
			} else if (c === "`") {
				mark(i, i + 1, TEXT);
				modes.pop();
				prev = '"';
				i++;
			} else if (c === "$" && d === "{") {
				mark(i, i + 2, TEXT);
				modes.push({ template: false, depth: 0, inTemplate: true });
				prev = "{";
				i += 2;
			} else {
				mark(i, i + 1, TEXT);
				i++;
			}
			continue;
		}
		if (c === "/" && d === "/") {
			const e = text.indexOf("\n", i);
			const end = e < 0 ? n : e;
			mark(i, end, COMMENT);
			i = end;
		} else if (c === "/" && d === "*") {
			const e = text.indexOf("*/", i + 2);
			const end = e < 0 ? n : e + 2;
			mark(i, end, COMMENT);
			i = end;
		} else if (c === '"' || c === "'") {
			let j = i + 1;
			while (j < n && text[j] !== c && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
			mark(i, j + 1, TEXT);
			prev = '"';
			i = j + 1;
		} else if (c === "`") {
			mark(i, i + 1, TEXT);
			modes.push({ template: true });
			i++;
		} else if (c === "/" && (prev === "" || "(,=:[!&|?{;+-*%<>~^".includes(prev))) {
			// a regular expression, where a value can start; anywhere else a / divides
			let j = i + 1;
			let inClass = false;
			while (j < n && text[j] !== "\n" && (inClass || text[j] !== "/")) {
				if (text[j] === "\\") j++;
				else if (text[j] === "[") inClass = true;
				else if (text[j] === "]") inClass = false;
				j++;
			}
			mark(i, j + 1, TEXT);
			prev = '"';
			i = j + 1;
		} else {
			if (top.inTemplate && c === "{") top.depth++;
			else if (top.inTemplate && c === "}") {
				if (top.depth === 0) {
					mark(i, i + 1, TEXT);
					modes.pop();
					i++;
					continue;
				}
				top.depth--;
			}
			if (!/\s/.test(c)) prev = c;
			i++;
		}
	}
	return kind;
};

const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");
const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
// Past white space and comments.
const skipSpace = (text, kind, i, end = text.length) => {
	while (i < end && (kind[i] === COMMENT || (kind[i] === CODE && /\s/.test(text[i])))) i++;
	return i;
};
// Back over white space and comments: the index after the last character that is neither.
const trimBack = (text, kind, i, start) => {
	while (i > start && (kind[i - 1] === COMMENT || (kind[i - 1] === CODE && /\s/.test(text[i - 1])))) i--;
	return i;
};
// The bracket that closes the one at `open`.
const closing = (text, kind, open) => {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		if (kind[i] !== CODE) continue;
		if ("{[(".includes(text[i])) depth++;
		else if ("}])".includes(text[i]) && --depth === 0) return i;
	}
	throw new CannotEdit("its brackets do not match");
};
// The comma-separated items between two brackets, at their own level: where each starts and ends
// (`end` is its comma, or the closing bracket).
const items = (text, kind, open, close) => {
	const found = [];
	let i = open + 1;
	for (;;) {
		i = skipSpace(text, kind, i, close);
		if (i >= close) return found;
		let depth = 0;
		let j = i;
		for (; j < close; j++) {
			if (kind[j] !== CODE) continue;
			if ("{[(".includes(text[j])) depth++;
			else if ("}])".includes(text[j])) depth--;
			else if (text[j] === "," && depth === 0) break;
		}
		found.push({ start: i, end: j });
		i = j + 1;
	}
};
// The white space a line starts with.
const indentAt = (text, i) => /^[ \t]*/.exec(text.slice(text.lastIndexOf("\n", i - 1) + 1, i))[0];
// One more item in a bracketed list, after the ones there, laid out as they are.
const appendItem = (text, kind, open, close, entry) => {
	const all = items(text, kind, open, close);
	if (!all.length) {
		const inner = text.slice(open + 1, close);
		if (inner.trim() === "") return text.slice(0, open + 1) + (text[open] === "{" ? ` ${entry} ` : entry) + text.slice(close);
		// only comments in it: a line of its own before the closing bracket, when that has one
		const lineStart = text.lastIndexOf("\n", close - 1) + 1;
		if (lineStart <= open || text.slice(lineStart, close).trim() !== "") return text.slice(0, close) + entry + text.slice(close);
		return text.slice(0, lineStart) + `${text.slice(lineStart, close)}\t${entry},${eolOf(text)}` + text.slice(lineStart);
	}
	const last = all.at(-1);
	const trailing = last.end < close; // a comma after the last item
	const lastEnd = trimBack(text, kind, last.end, last.start);
	if (!text.slice(open, all[0].start).includes("\n")) return text.slice(0, lastEnd) + `, ${entry}` + text.slice(lastEnd);
	const line = eolOf(text) + indentAt(text, last.start) + entry;
	return trailing ? text.slice(0, last.end + 1) + line + "," + text.slice(last.end + 1) : text.slice(0, lastEnd) + "," + line + text.slice(lastEnd);
};

// ── imports ──────────────────────────────────────────────────────────────────────────────────

// Every import statement: its module, what it binds, and where it is.
export const imports = (text, kind = kinds(text)) => {
	const found = [];
	for (const m of text.matchAll(/^([ \t]*)import\b\s*(?:([^;'"()]*?)\s*\bfrom\s*)?(["'])([^"'\n]+)\3[ \t]*;?[ \t]*(?:\r?\n|$)/gm)) {
		const start = m.index + m[1].length;
		if (kind[start] !== CODE) continue;
		const clause = m[2] ?? "";
		const clauseStart = clause ? text.indexOf(clause, start + 6) : -1;
		const open = clause.indexOf("{");
		const close = clause.lastIndexOf("}");
		const before = (open < 0 ? clause : clause.slice(0, open)).replace(/,\s*$/, "").trim();
		const typeOnly = /^type\s+[\w${*]/.test(clause);
		const named = open < 0 ? [] : clause.slice(open + 1, close).split(",").map((s) => s.trim().replace(/^type\s+/, "")).filter(Boolean).map((s) => {
			const [imported, local] = s.split(/\s+as\s+/);
			return { imported, local: local ?? imported };
		});
		const namespace = /^\*\s*as\s+([\w$]+)$/.exec(before)?.[1] ?? /,\s*\*\s*as\s+([\w$]+)$/.exec(before)?.[1] ?? null;
		const byDefault = typeOnly ? null : /^([\w$]+)/.exec(before.replace(/^\*.*$/, ""))?.[1] ?? null;
		found.push({
			module: m[4],
			default: byDefault,
			namespace,
			named,
			typeOnly,
			odd: clause.includes("/"), // a comment inside it: left alone
			start: m.index,
			end: m.index + m[0].length,
			endsLine: /\n$/.test(m[0]),
			defaultEnd: byDefault ? clauseStart + clause.indexOf(byDefault) + byDefault.length : -1,
			open: open < 0 ? -1 : clauseStart + open,
			close: open < 0 ? -1 : clauseStart + close,
		});
	}
	return found;
};

// One name imported from a module: `{ default: "forms" }` or `{ named: "sandbox" }`. Returns the
// text and the name it is bound to in the file, which is the one already there when the module
// already gives it under another name.
export const addImport = (text, { module, default: byDefault, named }) => {
	const kind = kinds(text);
	const all = imports(text, kind);
	const same = all.filter((i) => i.module === module && !i.typeOnly);
	for (const i of same) {
		if (byDefault && i.default) return { text, local: i.default };
		const there = named && i.named.find((n) => n.imported === named);
		if (there) return { text, local: there.local };
	}
	const local = byDefault ?? named;
	const bound = all.some((i) => i.default === local || i.namespace === local || i.named.some((n) => n.local === local));
	const declared = [...text.matchAll(new RegExp(`\\b(?:const|let|var|function|class)\\s+${escaped(local)}\\b`, "g"))].some((m) => kind[m.index] === CODE);
	if (bound || declared) throw new CannotEdit(`it already uses the name ${local} for something else`);
	const into = same.find((i) => !i.odd && !i.namespace);
	if (named && into && into.open >= 0) return { text: appendItem(text, kind, into.open, into.close, named), local };
	if (named && into) return { text: text.slice(0, into.defaultEnd) + `, { ${named} }` + text.slice(into.defaultEnd), local };
	if (byDefault && into) return { text: text.slice(0, into.open) + `${byDefault}, ` + text.slice(into.open), local };
	const eol = eolOf(text);
	const last = all.at(-1);
	const at = last ? last.end : 0;
	const line = byDefault ? `import ${byDefault} from "${module}";` : `import { ${named} } from "${module}";`;
	return { text: text.slice(0, at) + (last && !last.endsLine ? eol : "") + line + eol + text.slice(at), local };
};

// ── the emdash({ … }) call ───────────────────────────────────────────────────────────────────

// The one call of EmDash's integration, and the braces of its options.
export const emdashCall = (text, kind = kinds(text)) => {
	const name = imports(text, kind).find((i) => i.module === "emdash/astro" && !i.typeOnly)?.default;
	if (!name) throw new CannotEdit('it does not import EmDash\'s integration:  import emdash from "emdash/astro"');
	const calls = [...text.matchAll(new RegExp(`(?<![\\w$.])${escaped(name)}\\s*\\(`, "g"))].filter((m) => kind[m.index] === CODE);
	if (calls.length !== 1) throw new CannotEdit(calls.length ? `it calls ${name}( … ) ${calls.length} times, and this cannot tell which is the site's` : `it never calls ${name}( … )`);
	const open = skipSpace(text, kind, calls[0].index + calls[0][0].length);
	if (text[open] !== "{" || kind[open] !== CODE) throw new CannotEdit(`${name}( … ) is not given its options written out as { … }`);
	const close = closing(text, kind, open);
	const props = items(text, kind, open, close).map((p) => {
		const quoted = kind[p.start] === TEXT && /["']/.test(text[p.start]);
		const key = quoted ? /^(["'])((?:\\.|(?!\1).)*)\1/.exec(text.slice(p.start, p.end)) : /^[\w$]+/.exec(text.slice(p.start, p.end));
		const afterKey = key ? skipSpace(text, kind, p.start + key[0].length, p.end) : p.end;
		const hasValue = key && text[afterKey] === ":" && kind[afterKey] === CODE;
		return { ...p, name: key ? (quoted ? key[2] : key[0]) : null, spread: text.startsWith("...", p.start), value: hasValue ? skipSpace(text, kind, afterKey + 1, p.end) : -1 };
	});
	return { name, open, close, props, kind };
};
const option = (call, name) => {
	const found = call.props.find((p) => p.name === name && !p.spread);
	if (!found && call.props.some((p) => p.spread)) throw new CannotEdit(`the options of ${call.name}({ … }) include a spread (...), so this cannot tell whether ${name} is already set`);
	return found ?? null;
};

// Is this option set, at the top level of emdash({ … })?
export const hasOption = (text, name) => option(emdashCall(text), name) !== null;

// One option in emdash({ … }), as its first. Nothing when the option is already set.
export const addOption = (text, name, value) => {
	const call = emdashCall(text);
	if (option(call, name)) return text;
	const { open, close, props } = call;
	const eol = eolOf(text);
	const firstAt = props.length ? props[0].start : close;
	const breakAt = text.indexOf("\n", open);
	if (breakAt < 0 || breakAt > firstAt) {
		// on one line:  emdash({ database: … })
		if (!props.length && text.slice(open + 1, close).trim() === "") return text.slice(0, open + 1) + ` ${name}: ${value} ` + text.slice(close);
		return text.slice(0, open + 1) + ` ${name}: ${value},` + (/\s/.test(text[open + 1]) ? "" : " ") + text.slice(open + 1);
	}
	const indent = props.length && !text.slice(text.lastIndexOf("\n", firstAt) + 1, firstAt).trim() ? indentAt(text, firstAt) : indentAt(text, close) + "\t";
	return text.slice(0, breakAt + 1) + `${indent}${name}: ${value},${eol}` + text.slice(breakAt + 1);
};

// One entry in a list option of emdash({ … }): `sandboxed: [a]` or `plugins: [a()]`. Nothing when
// the list already has it — the same name, called with or without arguments.
export const addToList = (text, name, entry) => {
	const call = emdashCall(text);
	const found = option(call, name);
	if (!found) return addOption(text, name, `[${entry}]`);
	const { kind } = call;
	if (found.value < 0 || text[found.value] !== "[" || kind[found.value] !== CODE) throw new CannotEdit(`${name} in ${call.name}({ … }) is not a list written out as [ … ]`);
	const close = closing(text, kind, found.value);
	if (skipSpace(text, kind, close + 1, found.end) < found.end) throw new CannotEdit(`${name} in ${call.name}({ … }) is more than a list written out as [ … ]`);
	const ident = /^[\w$]+/.exec(entry)?.[0] ?? entry;
	const has = items(text, kind, found.value, close).some((it) => {
		const t = text.slice(it.start, trimBack(text, kind, it.end, it.start));
		return t === entry || (t.startsWith(ident) && !/[\w$]/.test(t[ident.length] ?? ""));
	});
	return has ? text : appendItem(text, kind, found.value, close, entry);
};

// ── what the tasks ask for ───────────────────────────────────────────────────────────────────

// The sandbox runner, as EmDash's docs give it (deployment/plugin-sandbox).
export const sandboxRunnerLines = (cloudflare) =>
	cloudflare ? ['import { sandbox } from "@emdash-cms/cloudflare";', "sandboxRunner: sandbox(),   // inside emdash({ … })"] : ['sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox",   // inside emdash({ … })'];
export const setSandboxRunner = (text, cloudflare) => {
	if (hasOption(text, "sandboxRunner")) return text;
	if (!cloudflare) return addOption(text, "sandboxRunner", '"@emdash-cms/sandbox-workerd/sandbox"');
	const withImport = addImport(text, { module: "@emdash-cms/cloudflare", named: "sandbox" });
	return addOption(withImport.text, "sandboxRunner", `${withImport.local}()`);
};

// A sandboxed plugin package, whose default export is its descriptor (what `emdash-plugin build` makes).
export const sandboxedPluginLines = (pkg, local) => [`import ${local} from "${pkg}";`, `sandboxed: [${local}],   // inside emdash({ … })`];
export const addSandboxedPlugin = (text, pkg, local) => {
	emdashCall(text);
	const withImport = addImport(text, { module: pkg, default: local });
	return addToList(withImport.text, "sandboxed", withImport.local);
};
