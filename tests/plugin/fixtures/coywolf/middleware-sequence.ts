import { sequence } from "astro:middleware";
import { auth } from "./auth";
import { log } from "./log";

export const onRequest = sequence(auth, log);
