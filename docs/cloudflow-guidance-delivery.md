# Delivering CloudFlow authoring guidance to the model

Status: **implemented** in this package and in the remote Worker in a separate private repo.
CloudFlow workflow guidance now loads through the
[authoring skill](../skills/doit-cloudflow-authoring/SKILL.md), rather than global server
instructions. The package migration is complete; hosted adoption requires a package release
and a dependency update in the separate consumer (see §9).
The Worker consumes the `/core` exports: it passes `SERVER_INSTRUCTIONS` to both the legacy
`initialize` and modern `server/discover` paths, serves the CloudFlow authoring guide resource,
and integrates the shared skill registry, including native discovery for supported clients.
These delivery capabilities do not establish whether an individual client puts the instructions
into model context or whether the original behavioural comparison passed (see §§6–7).

Original implementation scope: `doitintl/doit-mcp-server` only. No API change, no change to the
flow builder; the companion Worker adoption is now implemented separately.

This document preserves the original delivery design: §§1–5 describe the problem and decisions
at the time, including the need for a companion Worker change. §§6–9 record current delivery
status and remaining validation. The canonical guide lives in the
[skill reference](../skills/doit-cloudflow-authoring/references/authoring-guide.md);
[`src/docs/cloudflowGuidance.ts`](../src/docs/cloudflowGuidance.ts) retains essential tool hints
and exports the same bundled guide bytes. JavaScript is the default, bare upstream input
access fails the node, and test runs can execute real actions on drafts.

## 1. The problem

`docs/cloudflow-authoring.md` documents the CloudFlow runtime contract correctly and completely.
Its opening paragraph says MCP clients get none of this guidance otherwise. That is accurate,
and it is the bug: **the file is referenced by nothing in `src/`**, so nothing ever sends it
anywhere. It is a document for humans reading the repo, sitting in a repo whose job is to talk
to models.

The cost is not hypothetical. In an end-to-end session driving this server, a three-node flow
(manual trigger → fetch a saved report → Python node returning a row count) took ~45 minutes and
produced three flows for one requested. Both builder-generated `codeNode`s were broken, in the
two ways `docs/cloudflow-authoring.md` already names: one defined a `def handler(input)` nothing
calls, the other read a bare `input` the runtime does not inject. Both nodes reported `complete`
and returned `{"message": null}`. Import dry-run passed, test-run dry-run passed, the run
succeeded — the only signal was a row count of 0 against a report known to have ~240 rows.
Diagnosing it required importing a throwaway flow that dumped the Python globals to discover
`nodes`, which is documented on line 52 of a file the model was never shown.

## 2. Three delivery channels, two audiences

This is the part that determines the plan, and it is easy to get backwards.

| Channel | stdio (`src/server.ts`) | Remote Worker (consumes `/core`) |
|---|---|---|
| Server `instructions` | set here | Worker constructs its own `Server` — needs a change there too |
| Resources | handler here | Worker has its own handlers — needs a change there too |
| **Tool descriptions** | from the tool objects | **same objects via `/core` — propagates for free** |

`src/core.ts` exports tools, prompts, `executeToolHandler`, `HAND_WRITTEN_TOOLS` and constants —
but no server construction. So a change to `src/server.ts` reaches the stdio server and nothing
else.

**Consequence:** tool descriptions are the only channel that reaches the remote transport from
this repo alone. Since the remote Worker is the transport that served the motivating session,
the description tier has to carry the load-bearing minimum — it cannot be the afterthought that
a longer document is expected to cover.

## 3. Design decisions

### D1 — The guidance is a TypeScript module, not a file read at runtime

Ship the text as `src/docs/cloudflowGuidance.ts` exporting string constants. Do **not** read
`docs/cloudflow-authoring.md` from disk at runtime. Three independent reasons:

- `package.json` has `files: ["dist"]` — `docs/` is not published, so an `npx`-installed server
  has no such file.
- The build copies exactly one non-TS asset (`shx cp src/tools/generated/openapi.json …`); any
  new asset needs its own copy step, and silently ships broken if that step is forgotten.
- The remote consumer is a Cloudflare Worker: bundled, no filesystem. A runtime `readFile` is
  not merely awkward there, it cannot work.

A plain exported `const` works identically in every consumer and cannot drift out of the bundle.

### D2 — The module is the source of truth; the markdown doc points at it

Two hand-maintained copies of a runtime contract will drift, and this contract is precisely the
one that must not. Make `src/docs/cloudflowGuidance.ts` authoritative and reduce
`docs/cloudflow-authoring.md` to a short pointer, **or** keep the doc as the human-facing copy
and add a test asserting the module contains it verbatim. Prefer the pointer: one copy, no test
needed to keep it honest.

(This also resolves, for this repo, the open question about duplicated contracts. The `dci` CLI
skill reference remains a separate copy for a separate distribution channel; unifying that is
out of scope here.)

### D3 — Three tiers, because the channels have different budgets

| Export | Length | Goes to |
|---|---|---|
| `CLOUDFLOW_TOOL_HINT` | 1–2 sentences | Appended to specific tool descriptions |
| `CLOUDFLOW_INSTRUCTIONS` | ~12 lines | Server `instructions` |
| `CLOUDFLOW_AUTHORING_GUIDE` | full document | The MCP resource |

Tool descriptions ride in every `tools/list` response, so the per-tool tier must stay to a
couple of sentences. Server instructions are global and shared with every other tool family in
this server — see the risk in §6.

## 4. The changes

### C1 — `src/docs/cloudflowGuidance.ts` (new)

The module exports `CLOUDFLOW_CODENODE_HINT`, `CLOUDFLOW_BUILDER_HINT`,
`CLOUDFLOW_INSTRUCTIONS`, and `CLOUDFLOW_AUTHORING_GUIDE`. Their current text lives in the
module, so this design record does not duplicate the runtime contract.

### C2 — `src/core.ts`

Re-export all four constants, so the Worker repo can adopt the instructions and resource tiers
without duplicating the text.

### C3 — `src/server.ts` — server instructions

> **Superseded (SDK v2).** This section describes the SDK v1 implementation and is kept as the
> record of that decision. The custom `initialize` handler it describes has since been removed.
> The SDK's own `initialize` now returns `instructions` for 2025-era clients, and its
> `server/discover` returns them for 2026-07-28 clients, both from the `instructions` option on
> the `Server` constructor. See [protocol-compatibility.md](protocol-compatibility.md).

The pinned SDK resolves to `1.29.0` (`yarn.lock`), whose `ServerOptions` accepts `instructions`
(`src/server/index.ts:67-69`), stores it, and returns it in the `initialize` result. This closes
the open question raised when this work was first proposed: **supported, no SDK bump needed.**

```ts
const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, prompts: {}, resources: {} }, instructions: SERVER_INSTRUCTIONS }
);
```

**The constructor option alone is a no-op here, and this is the one thing to get right.**
`src/server.ts` registers its own `InitializeRequestSchema` handler, which *replaces* the SDK's —
so the SDK never builds the `initialize` result and the stored `instructions` is never sent. The
first end-to-end probe of the built server returned no instructions at all. The option must be
echoed in that handler's return value as well:

```ts
return {
    protocolVersion: request?.params?.protocolVersion || "2024-11-05",
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    capabilities: server["_capabilities"] || {},
    instructions: SERVER_INSTRUCTIONS,
};
```

Anything else in this repo that overrides an SDK-provided handler inherits the same hazard: the
SDK's own behaviour for that method is gone, not extended.

### C4 — `src/server.ts` — serve the guide as a resource

`ListResourcesRequestSchema` currently returns `{ resources: [] }` while the `resources`
capability is declared. Return one entry and add the matching read handler:

```ts
const CLOUDFLOW_GUIDE_URI = "doit://docs/cloudflow-authoring";

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
        {
            uri: CLOUDFLOW_GUIDE_URI,
            name: "CloudFlow authoring guide",
            description: "Runtime contracts for authoring, repairing and verifying CloudFlow flows.",
            mimeType: "text/markdown",
        },
    ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== CLOUDFLOW_GUIDE_URI) {
        throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${request.params.uri}`);
    }
    return {
        contents: [{ uri: CLOUDFLOW_GUIDE_URI, mimeType: "text/markdown", text: CLOUDFLOW_AUTHORING_GUIDE }],
    };
});
```

`ReadResourceResultSchema` requires `contents[].uri` and `text` for text resources.

### C5 — `src/tools/generated/overrides.ts` (new) + hook

The generated path composes descriptions at `src/tools/generated/generateTools.ts:172-180` from
the spec's tag description, the operation description, and a pagination note. There is **no
override hook** — unlike the sibling external-API MCP repo, which has exactly this file and has
never used it. Add one here, because the spec is the API's contract and not the place to write
prompts:

`toolOverrides` adds the codeNode hint to import/export. Import and test-run also explain
idempotency and dry-run semantics. Test-run has its own validation/execution warning, rather
than the builder hint about a saved draft. See `src/tools/generated/overrides.ts`.

Hook it into the existing composition (keyed by the snake_cased tool name from `toolNameFor`):

```ts
const override = toolOverrides[name];
const description = `${tagDescription ? `${tagDescription} ` : ""}${baseDescription}${paginationNote}${
    override?.descriptionSuffix ? ` ${override.descriptionSuffix}` : ""
}`;
```

A suffix rather than a replacement: the spec's own description stays authoritative about what
the endpoint does, and the override only adds what the spec has no business carrying.

### C6 — hand-written CloudFlow tool descriptions

Append `CLOUDFLOW_BUILDER_HINT` to `buildCloudflowTool` and `refineCloudflowTool` in
`src/tools/cloudflow.ts`. These are the two tools whose output is most often wrong, and the
tools an agent reaches for first.

### C7 — tests

Following the repo's `__tests__` convention:

- `src/__tests__/server.test.ts` — extend the existing `ListResourcesRequestSchema` test to
  assert the guide is listed; add a `ReadResourceRequestSchema` test for a hit and for an
  unknown URI; assert `instructions` is passed to the `Server` constructor **and** that the
  `InitializeRequestSchema` handler returns it — the constructor assertion alone passes against
  the no-op described in C3.
- `src/tools/generated/__tests__/` — assert the suffix appears on an overridden tool, that a
  non-overridden tool is unchanged, and that **every key in `toolOverrides` matches a real
  generated tool name** (the same guard `excludedOperations.test.ts` applies, so a renamed
  operation fails the build instead of silently dropping the guidance).
- `src/tools/__tests__/cloudflow.test.ts` — assert the builder tools carry the hint.

## 5. Proposed `CLOUDFLOW_INSTRUCTIONS` text

Kept to what changes behavior; everything else lives in the resource. All three tiers focus on
platform behavior, relevant usage conditions and result limits. The Claude Connectors
[review criteria](https://claude.com/docs/connectors/building/review-criteria#avoid-prompt-injection-patterns)
reject unrelated behavioral instructions and coerced tool calls, while tool-specific preconditions
and caveats remain useful. See the repo's [tool-description guidance](../AGENTS.md#tool-descriptions-and-parameter-help).

The historical instruction text is retained as the deprecated `CLOUDFLOW_INSTRUCTIONS` export in
[`src/docs/cloudflowGuidance.ts`](../src/docs/cloudflowGuidance.ts). It distinguishes both
codeNode languages, validation from real draft execution, and build/refine results.

## 6. Risks and limits

- **Instructions are a shared budget.** CloudFlow is one domain among many in this server. Twelve
  lines for one domain sets a precedent that does not scale — if every family claims the same,
  the instructions stop being read. Domain workflows now belong in skills; essential codeNode
  and execution contracts remain in tool metadata for clients that do not load a skill.
- **Resources are pull, not push.** Most clients never read a resource unprompted. The resource
  tier is for depth on request; it must not be where a load-bearing rule lives alone.
- **Delivery is implemented; client context needs separate evidence.** Driving the built server
  over stdio with a real MCP client confirms all three tiers: `instructions` arrives in the
  `initialize` result, the guide lists and reads at `doit://docs/cloudflow-authoring`, and the
  description suffixes appear in `tools/list`. The remote Worker in a separate private repo also
  passes `SERVER_INSTRUCTIONS` from `/core` to the legacy `initialize` and modern
  `server/discover` paths and serves the guide; consumer tests cover that delivery. Whether
  individual clients surface those instructions into model context still requires client-specific
  evidence. The original guidance-enabled versus
  guidance-disabled behavioural comparison in §7 remains unverified.
- **Skill delivery is separate from hosted migration.** The Worker integrates the shared
  skill registry, serving its resources and exposing native `skills/list` and `skills/get` to
  clients with protocol `2026-07-28` and Skills extension support. The package now includes
  CloudFlow authoring in that registry; hosted connections require the release and dependency
  update in §9 before they receive it.
- **This does not fix the builder.** It tells the model to expect broken code and verify. The
  generated code is still wrong as often as before, and repairing it still means
  export → edit → import as a new flow, because the API has no flow-update endpoint.

## 7. Verification

Beyond the unit tests, the change is only worth shipping if it moves the observed failure. The
stdio delivery is verified (see §6); the behavioural check below needs a live tenant and has
**not** been run:

1. Re-run the motivating task through a client that surfaces server instructions: a manual
   trigger, a saved-report fetch, and a Python node returning `rowCount`/`firstRow`.
2. Assert the generated or repaired `codeNode` reads via `nodes[...]` and ends in a top-level
   `return`, and that the reported result is the real row count rather than "the flow ran".
3. Compare against the same task run with the guidance disabled. The metric is whether the model
   verifies before claiming success — not whether the builder's first draft is correct.

## 8. Sequencing

1. ~~**C1, C2, C5, C6** — the description tier plus the shared constants. Reaches both transports
   with no change outside this repo. Ship first.~~ **Done.**
2. ~~**C3, C4** — instructions and the resource, for the stdio server.~~ **Done**, with the
   historical `InitializeRequestSchema` correction noted in C3, since superseded by SDK v2.
3. **Worker adoption — done.** The remote Worker in a separate private repo imports the shared
   `/core` exports, passes `SERVER_INSTRUCTIONS` through both protocol paths, serves the guide,
   and integrates the shared skill registry, including native discovery for supported clients.
4. **Remaining validation.** Establish client-specific model-context behaviour and complete the
   original guidance-enabled versus guidance-disabled behavioural comparison in §7. Implemented
   Worker delivery alone does not establish either result.
5. **On-demand CloudFlow skill — implemented in this package.** See §9 for delivery and rollout.

## 9. On-demand CloudFlow guidance

The original instructions channel made the codeNode contract visible during every connection
because validation can accept code that produces the wrong result. That delivery addressed a
real failure, but it also imposed a domain-specific workflow on cost, report, ticket and other
unrelated sessions. Global instructions are a shared context budget, so CloudFlow now uses:

- **Skill:** `doit-cloudflow-authoring` provides the authoring loop and a reference containing
  the full guide. The build embeds both files through the existing shared registry.
- **Tool metadata:** build/refine, import/export and test-run descriptions retain the runtime
  and execution caveats at the point of use, including codeNode inputs/return/schema and real
  actions during draft test runs. Native Skills support is not required to read these facts.
- **Guide resource:** `doit://docs/cloudflow-authoring` continues to serve the unchanged guide,
  using exactly the same bytes as the skill reference. Older clients can read both resources.
- **Global instructions:** `SERVER_INSTRUCTIONS` contains only a generic skill-discovery
  pointer. The deprecated `CLOUDFLOW_INSTRUCTIONS` export remains for API compatibility and
  is not sent by the server.

Fixture tests cover legacy `initialize`, modern `server/discover`, tool metadata, native
skill discovery, manifests/file reads and the existing guide. They establish delivery, not
client activation or live CloudFlow behavior; the original behavioral comparison remains open.

Release this package before updating the separate Worker's dependency and lockfile. Both of
its protocol paths already consume `SERVER_INSTRUCTIONS` and the shared registry from `/core`;
the companion change must verify the released contents and update its old instruction tests.
Publishing this package does not update or deploy the hosted Worker.
