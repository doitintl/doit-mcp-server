---
name: doit-cloudflow-authoring
description: Build, clone, inspect, repair, validate and test DoiT CloudFlow automations, including codeNode JavaScript/Python runtime contracts, draft versus published flows, imports, connections and run outputs.
license: MIT
metadata:
  doit/skill-version: "1"
---

# DoiT CloudFlow authoring

Use the DoiT MCP CloudFlow tools with access to the intended customer tenant.
Read the [authoring guide](references/authoring-guide.md) before authoring or changing a flow.
It covers the runtime contracts, tool results, import semantics, connection updates and retry limits.

Follow the stages relevant to the requested work:

1. Build a new draft, refine an existing flow, or clone from a real export. A build returns a
   flow ID even when planning stops early; refinement may answer without saving anything.
2. Export and inspect the saved flow. Check node shapes, references, connections and code
   against the guide; compare exports to establish whether refinement saved a change.
3. Dry-run an import before creating new drafts. An import creates new IDs rather than
   updating the source flow. Validation establishes structure, not correct runtime behavior.
4. Validate with a dry-run test. A test without dryRun executes real cloud actions even on
   drafts, using bound credentials; run it only when those actions are authorized.
5. Read completed run and per-node outputs before claiming the flow works. Distinguish
   successful draft creation, valid structure and observed execution in the result.

Publishing activates schedules. An exported bundle does not carry credentials, tenant IDs,
activation or execution state; inspect unresolved references when moving between tenants.
