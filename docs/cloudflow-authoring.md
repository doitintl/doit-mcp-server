# CloudFlow authoring over MCP

This guidance now lives in code, at [`src/docs/cloudflowGuidance.ts`](../src/docs/cloudflowGuidance.ts),
which is its single source of truth.

It moved because it is guidance *for models*, and a markdown file in this repo reaches none of
them: `package.json` publishes only `dist`, and the remote Cloudflare Worker transport is a
bundle with no filesystem. As a TypeScript constant it is delivered three ways — as a suffix on
the CloudFlow tool descriptions, as the server's `instructions`, and as the
`doit://docs/cloudflow-authoring` MCP resource.

Read the module for the full contract: the authoring loop, idempotency-key retry semantics, the
`codeNode` runtime contract (the one that fails silently), what an exported bundle cannot carry,
and the tenant-scoping caveat.

See [`docs/cloudflow-guidance-delivery.md`](./cloudflow-guidance-delivery.md) for why the
delivery is shaped this way.
