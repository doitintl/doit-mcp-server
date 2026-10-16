# Cloud Connect delivery

The package includes ten hand-written tools covering nine `/onboarding/v2` operations. The extra tool is the read-only registration/update/removal dry run. The API requires customer authentication and settings authorization. No separate catalog route or setup-run API is exposed.

`skills/doit-cloud-connect` is the canonical installable Agent Skills directory. The shared `yarn generate:skills` command auto-discovers this directory and bundles its files; the generic registry provides the complete SHA-256 manifest for filesystem-free hosts. Stdio serves the same files through resources, the Skills extension and the `connect_cloud` prompt. Hosts can instead install a copy of this directory into their agent's skill directory. Changes to the manifest are releases; there is no per-customer dynamic skill content.

The offline `references/catalog.md` and the two deployment recipes are release outputs of the same catalog projection used by the backend requirements endpoint. Generate them using the backend `cloudconnect-catalog` command against an approved catalog export, then run the MCP skill generator. Never hand-edit them or copy customer runtime responses into the public package. The bundled seed projection is an offline planning aid; a fresh response always wins on version mismatch. Release qualification must replace it with the effective production projection.

## Hosted consumer integration

Publishing this package does not update the separately deployed hosted Worker. Its companion change must:

1. Import `CLOUD_CONNECT_TOOLS`, `CLOUD_CONNECT_SCHEMAS` and `executeToolHandler` from `@doitintl/doit-mcp-server/core`. Register every definition using its matching schema. Include `COVERED_ENDPOINTS` when generating the remaining OpenAPI tools, so each operation appears once.
2. Route calls through `executeToolHandler` with the authenticated token and resolved customer context. Cloud Connect results bypass widget conversion; the shared response-size guard never silently truncates a list. Preserve errors, pagination, check coverage, named follow-ups, request IDs and etags.
3. Append `CLOUD_CONNECT_INSTRUCTIONS` to server instructions, use the shared `SKILL_REGISTRY` resources and handlers described in [Skills over MCP](skills.md). The hosted Skills framework discovers Cloud Connect from the same bundle automatically; do not add domain-specific discovery or resource handlers. Native loading requires protocol `2026-07-28` and client Skills support; older clients use the resource/prompt bridge.
4. Include the exported `prompts` (which contains `connect_cloud`). These contain the same generated skill content; do not duplicate it in Worker source.
5. Use the shared hosted-safe event schema. It deliberately accepts classified errors rather than free-text logs. Do not widen it in the transport adapter.

The package tests exercise core dispatch, hosted formatter bypass, manifest content and the built stdio lifecycle. They do not establish that the hosted Worker has adopted the package or that cloud deployment is qualified. Verify registration, scope filters, conditional writes, dry runs, delayed diagnostics and event failure behavior on that deployment before rollout.

Skills transport follows the [stable MCP Skills extension](https://modelcontextprotocol.io/extensions/skills/overview): `skills/list`, `skills/get`, complete file digests and `resources/read`. Directory reads are not advertised. Clients without extension support can use ordinary resources or the prompt bridge.
