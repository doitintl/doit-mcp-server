# Skills over MCP

The server supports the official [Skills extension](https://modelcontextprotocol.io/extensions/skills/overview).
Clients use `skills/list` or `skills/get` for metadata and `resources/read` for files.
Native loading requires protocol `2026-07-28` and client Skills support; the host
handles activation and content verification. The default registry includes the
[Cloud Connect workflow](../skills/doit-cloud-connect/SKILL.md) and
[CloudFlow authoring](../skills/doit-cloudflow-authoring/SKILL.md).

CloudFlow workflows are loaded on demand rather than sent in global server instructions.
Clients without native Skills support retain the tool descriptions and the existing
`doit://docs/cloudflow-authoring` guide resource. Skill files also remain readable through
core Resources. The guide resource and the skill reference serve the same bundled text.
For those clients, `tools/list` appends the guide URI to the CloudFlow and Cloud Connect
tools listed in `SKILL_GUIDE_POINTERS` (`src/docs/skillGuidePointers.ts`); clients with native
Skills support receive the descriptions unchanged.

## Add a skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter containing a matching
   `name` and a nonempty `description`. Add supporting files in the same directory.
2. Run `yarn generate:skills` and commit the generated bundle with the source files.
3. Run `yarn check:dev`, `yarn test`, and `yarn build`.

Skill files are public: do not include secrets. Each skill is limited to 512 files
and 16 MiB; symlinks and paths outside the skill directory are rejected.

The build parses frontmatter and embeds files for both local and hosted servers;
runtime needs neither YAML parsing nor filesystem access. The `/core` export provides
`createSkillRegistry`, `SKILL_REGISTRY`, and `supportsSkills`; each server registers its own handlers.
