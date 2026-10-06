// stop — the dev server this project's `start` started.
import { ok, stopServer } from "./lib.mjs";
ok(stopServer() ? "site stopped" : "no site was running");
