# CloudFlow authoring over MCP

The canonical guide is the [CloudFlow authoring skill reference](../skills/doit-cloudflow-authoring/references/authoring-guide.md).
Start with the [authoring skill](../skills/doit-cloudflow-authoring/SKILL.md) for the workflow.

The build embeds the skill files in `dist` for discovery and resource reads without runtime
filesystem access. [`src/docs/cloudflowGuidance.ts`](../src/docs/cloudflowGuidance.ts) serves
the same reference bytes through the existing `doit://docs/cloudflow-authoring` resource and
keeps essential runtime facts in tool-description suffixes. Global server instructions no
longer include CloudFlow workflow or runtime rules.

Read the skill reference for the full contract: the authoring loop, idempotency-key retry semantics, the
language-specific `codeNode` runtime contract, what an exported bundle cannot carry,
and the tenant-scoping caveat.

See [`docs/cloudflow-guidance-delivery.md`](./cloudflow-guidance-delivery.md) for why the
delivery is shaped this way.
