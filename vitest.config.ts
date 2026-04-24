import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: [
			"src/**/__tests__/**/*.test.ts",
			"test/**/*.test.ts",
		],
	},
});
