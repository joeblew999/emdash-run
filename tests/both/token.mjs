// signin:token and the CLI, on either site: ONE set of steps, run on this machine's built site
// (tests/signin) and on the deployed one (tests/live). The product's own rule — no flag is this
// machine, --live is the deployed site — is the only difference between the two runs.
import { mise, says, saysAnyCase } from "../lib/site.mjs";
import { step } from "../lib/step.mjs";

/** @param {{ live: boolean }} on */
export const tokenSteps = ({ live }) => {
	const flag = live ? ["--live"] : [];
	const where = live ? "--live" : "--preview"; // how the emdash task is told which site
	const on = live ? "the deployed site" : "this machine's built site";
	const administrator = async () => saysAnyCase(await mise("emdash", "whoami", where), "admin");

	step("signin:token", `${on}: the CLI is an administrator of it`, async () => {
		await mise("signin:token", ...flag);
		await administrator();
	});
	step("signin:token", `${on}, run again: still an administrator`, async () => {
		await mise("signin:token", ...flag);
		await administrator();
	});
	step("emdash", `${on}: ${where} reads and writes it`, async () => {
		says(await mise("emdash", "schema", "list", where), "slug");
		await mise("emdash", "content", "create", "pages", where, "--slug", `test-${Date.now()}`, "--data", JSON.stringify({ title: "Made by the test" }));
	});
};
