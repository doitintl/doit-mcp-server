# Release Procedure

Project uses semantic versioning, and the CHANGELOG.md is used as a source of truth for release notes.

## Releasing (the normal way)

Releases are cut by merging a pull request. Nothing needs to run on a laptop.

1. Whenever unreleased commits land on `main`, the [Release PR workflow](../.github/workflows/release-pr.yml) opens or updates a **`chore: prepare release vX.Y.Z`** pull request on the `chore/release` branch. It holds the same version bumps and drafted changelog entry that `prepare-release.sh` produces locally, and it is regenerated on every push to `main`.
2. The version is derived from the Conventional Commit subjects since the latest tag by [`next-version.sh`](../scripts/release/next-version.sh): a breaking change bumps the minor while the version is `0.x` (major once it is `1.0.0` or later), a `feat` bumps the minor, anything else bumps the patch.
3. **Review the PR** — mainly the changelog entry, since it becomes the GitHub Release notes. Edit it on the branch if needed, but note that new commits landing on `main` regenerate the branch and overwrite hand-edits.
4. **Merge the PR.** The [Release workflow](../.github/workflows/release.yml) sees a `package.json` version that is both untagged and described in `CHANGELOG.md`, tags the merge commit, creates the GitHub Release from the changelog entry, and — once a reviewer approves the `npm` environment deployment in the run — publishes to npm. A version bumped by hand in an unrelated PR meets neither condition, so it tags and publishes nothing.

Because a tag pushed with `GITHUB_TOKEN` does not start another workflow run, the tagging happens inside the same Release run rather than triggering it. Pushing a `vX.Y.Z` tag by hand still works and takes the same path.

No release PR appears when there is nothing to release, or when a prepared release has not been tagged yet (`package.json` ahead of the latest tag). To check what would be proposed:

```bash
./scripts/release/next-version.sh HEAD
```

## Releasing by hand

Still supported, and the fallback if the automation is unavailable.

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

5. **Create and push a version tag** from the latest `main` branch (use the same version passed as new tag to the changelog script). Only principals allowed by the `v*` tag ruleset can do this (see [npm publishing](#npm-publishing-trusted-publishing--oidc)), and the publish still waits for approval of the `npm` environment.

```bash
git tag v0.10.0
git push origin v0.10.0
```

6. Pushing the tag runs the [Release workflow](../.github/workflows/release.yml), which extracts the notes from `CHANGELOG.md`, creates a GitHub Release, and then publishes the package to npm automatically (the `publish-npm` job re-runs tests and the build, verifies the tag matches `package.json`, and publishes). `yarn deploy` from a laptop is no longer part of the release flow.

## npm publishing (Trusted Publishing / OIDC)

The `publish-npm` job authenticates via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) — GitHub Actions proves its identity to npm with an OIDC token, so **no `NPM_TOKEN` secret exists or needs rotating**. Publishes made this way also carry provenance attestations.

### Why the publisher must be bound to an environment

npm matches the OIDC token on repository, workflow filename and — only if one is configured — environment. It does **not** check the git ref. A push runs the copy of `release.yml` that exists at the pushed ref, with that copy's own `on:` triggers, so anyone with write access could push a branch (or a `v*` tag at an unreviewed commit) carrying a rewritten `release.yml` and get a token npm accepts. The `on:` filter, the CHANGELOG/tag checks and the test/build steps all live in the file they would replace, so none of them is a security boundary.

The `publish-npm` job therefore runs in the `npm` GitHub environment, and the npm trusted publisher is bound to that environment. GitHub refuses to start a job in that environment — and so never mints the token — unless the run's ref passes the environment's deployment policy and a required reviewer approves it.

### One-time setup

Repository admin, on GitHub → repo **Settings**:

1. **Environments** → **New environment** named `npm`.
   - **Required reviewers**: add the release maintainers (and enable **Prevent self-review**).
   - **Deployment branches and tags**: choose **Selected branches and tags** and add exactly the branch rule `main` and the tag rule `v[0-9]*`. Do not add any other refs.
   - Do not add any secrets — publishing uses OIDC only.
2. **Rules** → **Rulesets** → **New tag ruleset** targeting `v*` tags: enable **Restrict creations**, **Restrict updates** and **Restrict deletions**, with only repository admins and the identity the Release workflow tags with (the GitHub Actions app) in the bypass list, so the merge-commit tagging in `release.yml` keeps working. Without this, anyone with write access can push a `v*` tag at an unreviewed commit; the environment's required reviewers are then the only thing that stops it.
3. Keep branch protection on `main` (required reviews and status checks), so the only way code reaches `main` is the reviewed merge.

Package maintainer, on npmjs.com → package **Settings** → **Trusted Publisher**:

1. Select GitHub Actions.
2. Set organization `doitintl`, repository `doit-mcp-server`, workflow filename `release.yml`, **environment `npm`**. Never leave the environment empty — a filename-only match accepts a token from any ref.
3. Save. Under **Publishing access**, also select **Require two-factor authentication and disallow tokens** so the trusted publisher is the only way to publish.

Each release now pauses at the `Publish to npm` job until a reviewer approves the `npm` deployment in the Actions run. Approve only runs whose ref is `main` or a `v*` tag on a commit already merged to `main`.

To check the setup, push a throwaway branch whose `release.yml` triggers on that branch and runs `npm publish`: the job must fail to start (the ref is not allowed in the `npm` environment), or, if the copy drops `environment:`, `npm publish` must be rejected by npm.

Order matters. Create and protect the `npm` environment **before** the first run that references it: GitHub auto-creates a missing environment with no protection rules, so a run against a missing `npm` environment publishes ungated. And until the npm trusted publisher names environment `npm`, npm still accepts tokens from any ref — the GitHub side alone does not close the gap.

Until the npm side is set up at all, the `publish-npm` job fails at the `npm publish` step with an auth error — everything before it (release creation) still works.

## Cloudflare Worker (mcp.doit.com)

Publishing to npm does **not** update the hosted Worker — it consumes this package's `/core` export from its own (private) repo and must bump the dependency and redeploy there. Automating that half is tracked in [CMP-47733](https://doitintl.atlassian.net/browse/CMP-47733).
