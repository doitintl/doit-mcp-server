import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["stdio/**/*.test.ts", "process/**/*.test.ts"],
        testTimeout: 15000,
        setupFiles: ["setup.ts"],
    },
});
