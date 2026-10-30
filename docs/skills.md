# Skills over MCP

The server supports the official [Skills extension](https://modelcontextprotocol.io/extensions/skills/overview).
Clients use `skills/list` or `skills/get` for metadata and `resources/read` for files.
Native loading requires protocol `2026-07-28` and client Skills support; the host
handles activation and content verification. The default registry includes the
[Cloud Connect workflow](../skills/doit-cloud-connect/SKILL.md) and
[CloudFlow authoring](../skills/doit-cloudflow-authoring/SKILL.md).

## Domain guidance delivery

Global server instructions carry only a generic skill-discovery line. CloudFlow and Cloud
Connect workflows used to live there, which put about a dozen lines of domain rules into every
session, including sessions that never touched those tools. CloudFlow needed the guidance
because generated `codeNode` code can pass every validation gate and still return the wrong
result. Each piece of guidance now goes to one of these channels:

- **Skills** (`skills/doit-cloudflow-authoring`, `skills/doit-cloud-connect`) hold the
  workflows and full references, loaded on demand.
- **Tool descriptions** keep the contract facts at the point of use, such as `codeNode`
  inputs and return values, and that test runs execute real actions even on drafts. See
  `src/docs/cloudflowGuidance.ts` and `src/tools/generated/overrides.ts`.
- **Guide pointers.** Clients without native Skills support see only tool metadata, so
  `tools/list` adds the guide URI to the tools in `SKILL_GUIDE_POINTERS`
  (`src/docs/skillGuidePointers.ts`). Clients with native Skills support get the descriptions
  unchanged.
- **Resources.** `doit://docs/cloudflow-authoring` serves the same bundled bytes as the
  CloudFlow skill reference, and every skill file stays readable through core Resources.
  Resources are pull-only, so no rule is delivered through a resource alone.

The deprecated `CLOUDFLOW_INSTRUCTIONS` and `CLOUD_CONNECT_INSTRUCTIONS` exports remain for
`/core` compatibility; neither server sends them.

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
