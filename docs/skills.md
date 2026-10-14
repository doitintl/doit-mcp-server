# Skills over MCP

The server implements the official [`io.modelcontextprotocol/skills`
extension](https://modelcontextprotocol.io/extensions/skills/overview) on the
existing SDK v2 and modern stdio transport. `server/discover` advertises Resources
and the extension. `skills/list` returns complete, paginated entries;
`skills/get` supports direct lookup independently of listing. `resources/read`
returns the requested text or base64 blob. Unknown skill/file URIs and invalid
cursors return JSON-RPC `-32602`. Directory reading is not advertised.

The registry is empty initially. This change provides reusable delivery support;
it does not add a product workflow or a runtime upload endpoint.

## Add a skill

1. Create `skills/<name>/SKILL.md`. Its YAML frontmatter must contain `name`
   matching the directory and a nonempty `description`. All other frontmatter
   fields are preserved. Optional `license` and `allowed-tools` are strings,
   `compatibility` is 1–500 characters, and `metadata` maps strings to strings,
   following the Agent Skills specification.
2. Add references, assets, or other supporting files beneath that directory.
3. Run `yarn generate:skills` and review the generated
   `src/skills/bundle.generated.ts` alongside the source files.
4. Run `yarn check:dev`, `yarn test`, and `yarn build`.

Every immediate subdirectory containing `SKILL.md` is discovered automatically.
Directories without it are ignored. Symlinks, nonregular files, invalid names,
duplicate paths/names, traversal paths, more than 512 files, and more than 16 MiB
per skill are rejected. Do not put secrets in a skill: all packaged skill files
are public resources, included in the npm package and served on request.

The immutable bundle has no runtime filesystem dependency. Every entry includes
all supporting file URIs, SHA-256 digests, and raw byte sizes. UTF-8 files are
served as text; other files use base64 blobs. Cache hints are public with a
five-minute TTL. Pagination cursors bind to the current manifest snapshot and
cannot be reused after a bundle changes. A skill entry is never split across pages.

## Local development

After `yarn install` and `yarn build`, configure an MCP host to launch
`node /absolute/path/to/doit-mcp-server/dist/index.js`. A DoiT API token is needed
for API tools; discovering and reading public skills does not call the DoiT API.
Use a client supporting protocol `2026-07-28` and the Skills extension to load
skills natively. Existing clients retain their tools, prompts, and resource
behavior; merely reading a `SKILL.md` resource does not activate it as a skill.

The host owns activation, approval, origin tracking, and digest/size/frontmatter
verification. Client support varies; a compatible server does not establish that
every host will automatically load its skills.

## Transport-independent exports

The `/core` export provides `SKILL_EXTENSION_CAPABILITY`, `SKILL_RESOURCES`,
`listSkills(cursor?)`, `getSkill(uri)`, `readSkillResource(uri)`,
`createSkillRegistry(sources, options?)`, and `registerSkillHandlers(server, registry?)`.
Hosted transports merge the extension declaration into their capabilities and
the registry's resource metadata into `resources/list`, delegate matching
`resources/read` requests, and register list/get on each server instance.

`createSkillRegistry` takes an array of `{name, files}` sources. Each file has a
relative `path`, optional `mimeType`, and exactly one of UTF-8 `text` or canonical
base64 `blob`. It validates the input and builds a frozen snapshot with complete
manifests. The optional `pageSize` is 1–500 (default 50), and `ttlMs` defaults to
300000. The registry contains no client/session state and performs no filesystem
or network reads.
