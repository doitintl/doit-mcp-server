# Release Procedure

Project uses semantic versioning, and the CHANGELOG.md is used as a source of truth for release notes.

1. **Write the changelog** — generate a changelog entry from commits since the latest tag (pass the new tag as argument)

```bash
# Preview what will be generated, --tag is the NEW tag not created yet
./scripts/release/write-changelog.sh --tag v0.6.0 --dry-run

# Write the entry to CHANGELOG.md
./scripts/release/write-changelog.sh --tag v0.6.0
```

2. **Review and modify the generated changelog entry** if needed. The script
   generates a draft based on commit messages, but you may want to edit it for
   clarity, formatting, or to add additional context.

3. **Commit the changelog update**

4. **Ensure the server version** to match the release (e.g., `0.5.0` for tag `v0.5.0`), if not, update and commit, then make a release PR to `main` branch.

```bash
# find where version is defined and update it, then commit the change
find . -name "package.json" -not -path "*/node_modules/*" -exec grep '"version"' {} +
git grep "SERVER_VERSION" src/
```

5. **Create and push a version tag** from the latest `main` branch (use the same version passed as new tag to the changelog script)

```bash
git tag v0.6.0
git push origin v0.6.0
```

6. Pushing the tag triggers the [Release workflow](../.github/workflows/release.yml), which extracts the notes from `CHANGELOG.md` and creates a GitHub Release automatically.
