# Generated tools coverage

## The problem this solves

`src/tools/generated/generateTools.ts` walks `src/tools/generated/openapi.json` and builds one
generic MCP tool per operation. Many operations already have a richer, hand-written tool
elsewhere in `src/tools/` (e.g. `list_alerts` in `src/tools/alerts.ts` vs. the spec's `listAlerts`
operation). Without exclusion, both would show up in the tool list — same underlying endpoint,
two different tool names, confusing the LLM about which one to call.

There used to be a separate `src/tools/generated/blacklist.ts` — a hand-maintained array of
`{method, path}` pairs. It required updating in a second place every time a hand-written tool
was added or removed, and it was easy to forget (and never showed up as a compile error).

## How it works now

Every hand-written tool object can declare an optional `coversEndpoint` field naming the exact
OpenAPI operation it duplicates, as a `"method:path"` string:

```ts
export const listAlertsTool = {
    name: "list_alerts",
    coversEndpoint: "get:/analytics/v1/alerts",
    description: "...",
    // ...
};
```

`src/tools/handWrittenTools.ts` imports every hand-written tool into `HAND_WRITTEN_TOOLS` (this
array is also what `src/server.ts`'s stdio `ListTools` response spreads — it's the same array you
already have to keep up to date for a new tool to be exposed at all) and derives:

```ts
export const COVERED_ENDPOINTS: Set<string> = new Set(/* "method:path" for every coversEndpoint */);
```

`generateTools(document, coveredEndpoints)` takes that set as a parameter and skips any operation
whose `${method}:${pathTemplate}` key is present. Both transports pass `COVERED_ENDPOINTS`:

- stdio: `src/tools/generated/registry.ts`
- Worker (HTTP/SSE): `doit-mcp-server/src/index.ts`

## What to do when adding a hand-written tool

If the tool calls an endpoint that also exists as an operation in
`src/tools/generated/openapi.json`, add `coversEndpoint: "method:path"` to the tool object
itself, using the **spec's** method and path template (with the spec's own `{param}` names) — not
necessarily the tool's own runtime HTTP verb. That's it. No second file to edit.

If the tool doesn't correspond to any single spec operation (aggregates several endpoints,
hits a non-public endpoint, or is a purely internal flow tool), don't add `coversEndpoint` —
leaving it off is correct, not an oversight.

## The one gotcha: method mismatch

`update_resource_permissions` in `src/tools/permissions.ts` calls `PATCH` against
`/sharing/v1/{resourceType}/{resourceId}` at runtime, but the OpenAPI spec's operation for that
same path is `PUT`. Its `coversEndpoint` is deliberately `"put:..."` —
matching the **spec operation being suppressed**, not the tool's own request method. If you ever
see a generated tool that seems to duplicate a hand-written tool despite the hand-written tool
having a `coversEndpoint`, check for exactly this kind of method mismatch first: look up the
actual spec operation for that path in `openapi.json` and match `coversEndpoint` to it.

## Verifying coverage

`src/tools/__tests__/handWrittenTools.test.ts` checks that `COVERED_ENDPOINTS` has one entry per
tool declaring `coversEndpoint` and that there are no duplicate `method:path` pairs across
hand-written tools. It does **not** check that every hand-written tool that *should* declare
`coversEndpoint` actually does — that's a judgment call made when the tool is written. When in
doubt, grep `openapi.json` for the resource path before deciding whether to add the field.
