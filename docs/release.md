# Release Procedure

Project uses semantic versioning, and the CHANGELOG.md is used as a source of truth for release notes.

Use the prepare-release script to prepare the release, which updates all version strings and drafts the changelog. Follow the steps suggested by the script, and make sure to review the generated changelog entry before committing it.

```bash
# Preview the release preparation steps without making any changes
./scripts/release/prepare-release.sh --tag v0.10.0 --dry-run

# Run the release preparation steps, --tag is the NEW tag not created yet
./scripts/release/prepare-release.sh --tag v0.10.0
```

## Detailed Steps

1. **Write the changelog** — generate a changelog entry from commits since the latest tag (pass the new tag as argument)

```bash
# Preview what will be generated, --tag is the NEW tag not created yet
./scripts/release/write-changelog.sh --tag v0.10.0 --dry-run

# Write the entry to CHANGELOG.md
./scripts/release/write-changelog.sh --tag v0.10.0
```

2. **Review and modify the generated changelog entry** if needed. The script
   generates a draft based on commit messages, but you may want to edit it for
   clarity, formatting, or to add additional context.

3. **Commit the changelog update**

4. **Ensure the server version** to match the release (e.g., `0.10.0` for tag `v0.10.0`), if not, update and commit, then make a release PR to `main` branch.

```bash
# find where version is defined and update it, then commit the change
find . -name "package.json" -not -path "*/node_modules/*" -exec grep '"version"' {} +
git grep "SERVER_VERSION" src/
```

5. **Create and push a version tag** from the latest `main` branch (use the same version passed as new tag to the changelog script)

```bash
git tag v0.10.0
git push origin v0.10.0
```

6. Pushing the tag triggers the [Release workflow](../.github/workflows/release.yml), which extracts the notes from `CHANGELOG.md`, creates a GitHub Release, and then publishes the package to npm automatically (the `publish-npm` job re-runs tests and the build, verifies the tag matches `package.json`, and publishes). `yarn deploy` from a laptop is no longer part of the release flow.

## npm publishing (Trusted Publishing / OIDC)

The `publish-npm` job authenticates via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) — GitHub Actions proves its identity to npm with an OIDC token, so **no `NPM_TOKEN` secret exists or needs rotating**. Publishes made this way also carry provenance attestations.

One-time setup (any `@doitintl/doit-mcp-server` maintainer):

1. On npmjs.com → package **Settings** → **Trusted Publisher**, select GitHub Actions.
2. Set organization `doitintl`, repository `doit-mcp-server`, workflow filename `release.yml` (leave environment empty).
3. Save. From then on, tag pushes publish without any credentials.

Until that setup is done, the `publish-npm` job fails at the `npm publish` step with an auth error — everything before it (release creation) still works.

## Cloudflare Worker (mcp.doit.com)

Publishing to npm does **not** update the hosted Worker — it consumes this package's `/core` export from its own (private) repo and must bump the dependency and redeploy there. Automating that half is tracked in [CMP-47733](https://doitintl.atlassian.net/browse/CMP-47733).
