import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package exports", () => {
    it("exposes the CLI root and transport-independent core entry", () => {
        const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

        expect(packageJson.bin).toBe("dist/index.js");
        expect(packageJson.exports).toEqual({
            ".": {
                types: "./dist/index.d.ts",
                import: "./dist/index.js",
            },
            "./core": {
                types: "./dist/core.d.ts",
                import: "./dist/core.js",
            },
        });
        expect(packageJson.files).toEqual(["dist"]);
        expect(packageJson.scripts.prepare).toBeUndefined();
        expect(packageJson.scripts.deploy).toBe("yarn build && npm publish --access public");
    });
});
