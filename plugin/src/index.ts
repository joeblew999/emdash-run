import type { PluginDescriptor } from "emdash";

export function platTrunkPlugin(): PluginDescriptor {
	return {
		id: "plat-trunk",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@plat-trunk/emdash-plugin/sandbox",
		options: {},
		capabilities: ["read:content"],
	};
}
