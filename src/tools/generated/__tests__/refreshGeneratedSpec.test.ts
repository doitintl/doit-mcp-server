import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, "../../../../scripts/refresh-generated-spec.mjs");
const SNAPSHOT = path.resolve(__dirname, "../openapi.json");

function specWith(extra: string): string {
    return `openapi: 3.0.1
info:
  title: test
  version: "1.0.0"
paths:
  /things:
    get:
      operationId: listThings
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Thing"
components:
  schemas:
    Thing:
      type: object
      properties:
        id:
          type: string
${extra}`;
}

describe("refresh-generated-spec script", () => {
    let dir: string;
    let output: string;

    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), "refresh-spec-"));
        output = path.join(dir, "out.json");
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    function run(spec: string) {
        const source = path.join(dir, "spec.yaml");
        writeFileSync(source, spec);
        return spawnSync(process.execPath, [SCRIPT, source, output], { encoding: "utf8", timeout: 30_000 });
    }

    it.each([
        ["file:// URL", "file:///etc/hostname"],
        ["loopback http URL", "http://127.0.0.1/"],
        ["remote https URL", "https://example.com/spec.yaml"],
    ])("fails instead of inlining an external $ref to a %s", (_label, ref) => {
        const result = run(
            specWith(`    Leak:\n      $ref: "${ref}"\n`).replace("info:\n", `info:\n  x-note:\n    $ref: "${ref}"\n`)
        );

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("non-local $ref");
        expect(existsSync(output)).toBe(false);
    });

    it("does not read a sibling file referenced relatively from a local-path source", () => {
        writeFileSync(path.join(dir, "secret.txt"), "TOP-SECRET-CONTENT");
        const result = run(specWith(`    Leak:\n      $ref: "./secret.txt"\n`));

        expect(result.status).not.toBe(0);
        expect(result.stderr).not.toContain("TOP-SECRET-CONTENT");
        expect(existsSync(output)).toBe(false);
    });

    it("rejects content outside the expected OpenAPI shape", () => {
        const result = run(specWith("").replace("info:\n", "info:\n  x-note: unexpected\n"));

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('unexpected key "info.x-note"');
        expect(existsSync(output)).toBe(false);
    });

    it("dereferences local $refs and writes a snapshot with no $ref left", () => {
        const result = run(specWith(""));

        expect(result.status, result.stderr).toBe(0);
        const written = readFileSync(output, "utf8");
        expect(written).not.toContain("$ref");
        expect(JSON.parse(written).paths["/things"].get.responses["200"].content["application/json"].schema).toEqual({
            type: "object",
            properties: { id: { type: "string" } },
        });
    });

    it("accepts the checked-in snapshot unchanged", () => {
        const result = spawnSync(process.execPath, [SCRIPT, SNAPSHOT, output], { encoding: "utf8", timeout: 30_000 });

        expect(result.status, result.stderr).toBe(0);
        expect(readFileSync(output, "utf8")).toBe(readFileSync(SNAPSHOT, "utf8"));
    });
});
