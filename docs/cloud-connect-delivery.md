# Cloud Connect delivery

The package includes eight hand-written tools covering seven AWS-only `/onboarding/v2` operations. The extra tool is the read-only registration/update/removal dry run (`dryRun=true`). The API requires customer authentication and settings authorization. There is no catalog route, diagnostics or event endpoint, or setup-run API; GCP and Azure are not covered by this version.

`skills/doit-cloud-connect` is the canonical installable Agent Skills directory. The shared `yarn generate:skills` command auto-discovers this directory and bundles its files; the generic registry provides the complete SHA-256 manifest for filesystem-free hosts. Stdio serves the same files through resources, the Skills extension and the `connect_cloud` prompt. Hosts can instead install a copy of this directory into their agent's skill directory. Changes to the manifest are releases; there is no per-customer dynamic skill content.

Skill content is static and public; never copy customer runtime responses into the package. The fresh requirements response is the only source of permissions, identity trust and artifacts.

## Hosted consumer integration

Publishing this package does not update the separately deployed hosted Worker. Its companion change must:

1. Import `CLOUD_CONNECT_TOOLS`, `CLOUD_CONNECT_SCHEMAS` and `executeToolHandler` from `@doitintl/doit-mcp-server/core`. Register every definition using its matching schema. Include `COVERED_ENDPOINTS` when generating the remaining OpenAPI tools, so each operation appears once.
2. Route calls through `executeToolHandler` with the authenticated token and resolved customer context. Cloud Connect results bypass widget conversion; the shared response-size guard never silently truncates a list. Preserve errors, pagination, check coverage, named follow-ups, request IDs, etags and the returned idempotency key.
3. Append `CLOUD_CONNECT_INSTRUCTIONS` to server instructions, use the shared `SKILL_REGISTRY` resources and handlers described in [Skills over MCP](skills.md). The hosted Skills framework discovers Cloud Connect from the same bundle automatically; do not add domain-specific discovery or resource handlers. Native loading requires protocol `2026-07-28` and client Skills support; older clients use the resource/prompt bridge.
4. Include the exported `prompts` (which contains `connect_cloud`). These contain the same generated skill content; do not duplicate it in Worker source.

The package tests exercise core dispatch, hosted formatter bypass, manifest content and the built stdio lifecycle. They do not establish that the hosted Worker has adopted the package or that cloud deployment is qualified. Verify registration, list filters, conditional writes, idempotent retries, dry runs and the verify action on that deployment before rollout.

Skills transport follows the [stable MCP Skills extension](https://modelcontextprotocol.io/extensions/skills/overview): `skills/list`, `skills/get`, complete file digests and `resources/read`. Directory reads are not advertised. Clients without extension support can use ordinary resources or the prompt bridge.
