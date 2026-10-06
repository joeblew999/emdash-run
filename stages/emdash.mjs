// emdash — the official CLI, untouched, aimed at this project's site.
import { emdash, given } from "./lib.mjs";
process.exit(emdash(given(), { allowFail: true }).code);
