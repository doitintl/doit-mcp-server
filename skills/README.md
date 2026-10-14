# Packaged skills

Add a reviewed skill at `skills/<name>/SKILL.md`, with YAML frontmatter containing
the matching `name` and a nonempty `description`. Supporting files can live beneath
that directory. Run `yarn generate:skills`, commit the generated bundle, and rebuild
with `yarn build`. No registration code is needed when adding a skill directory.

This foundation ships with an empty registry. Test fixtures demonstrate multiple
skills; product workflows can be added independently. See
[Skills over MCP](../docs/skills.md) for the protocol and package limits.
