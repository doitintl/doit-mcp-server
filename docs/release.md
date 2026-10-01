# Release Procedure

Project uses semantic versioning, and the CHANGELOG.md is used as a source of truth for release notes.

## Releasing (the normal way)

Releases are cut by merging a pull request. Nothing needs to run on a laptop.

1. Whenever unreleased commits land on `main`, the [Release PR workflow](../.github/workflows/release-pr.yml) opens or updates a **`chore: prepare release vX.Y.Z`** pull request on the `chore/release` branch. It holds the same version bumps and drafted changelog entry that `prepare-release.sh` produces locally, and it is regenerated on every push to `main`.
2. The version is derived from the Conventional Commit subjects since the latest tag by [`next-version.sh`](../scripts/release/next-version.sh): a breaking change bumps the minor while the version is `0.x` (major once it is `1.0.0` or later), a `feat` bumps the minor, anything else bumps the patch.
3. **Review the PR** — mainly the changelog entry, since it becomes the GitHub Release notes. Edit it on the branch if needed, but note that new commits landing on `main` regenerate the branch and overwrite hand-edits.
4. **Merge the PR.** The [Release workflow](../.github/workflows/release.yml) sees a `package.json` version that is both untagged and described in `CHANGELOG.md`, tags the merge commit, creates the GitHub Release from the changelog entry, and — once a reviewer approves the `npm` environment deployment in the run — publishes to npm. A version bumped by hand in an unrelated PR meets neither condition, so it tags and publishes nothing.

Because a tag pushed with `GITHUB_TOKEN` does not start another workflow run, the tagging happens inside the same Release run rather than triggering it. Pushing a `vX.Y.Z` tag by hand still creates the GitHub Release, but does **not** publish to npm — publishing happens only from `main` (see [npm publishing](#npm-publishing-trusted-publishing--oidc)).

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

4. **Ensure the server version** to match the release (e.g., `0.10.0` for tag `v0.10.0`), if not, update and commit, then make a release PR to `main` branch. Merging it tags, releases and publishes exactly as in the normal flow above.

```bash
# find where version is defined and update it, then commit the change
find . -name "package.json" -not -path "*/node_modules/*" -exec grep '"version"' {} +
git grep "SERVER_VERSION" src/
```

5. **Only if the merge run did not tag** (e.g. it failed before tagging), create and push a version tag from the latest `main` branch (use the same version passed as new tag to the changelog script). Only principals allowed by the `v*` tag ruleset can do this (see [npm publishing](#npm-publishing-trusted-publishing--oidc)).

```bash
git tag v0.10.0
git push origin v0.10.0
```

6. Pushing the tag runs the [Release workflow](../.github/workflows/release.yml), which extracts the notes from `CHANGELOG.md` and creates a GitHub Release. It does **not** publish to npm: tag runs are not admitted to the `npm` environment. If a `main` run created the release but its `Publish to npm` job failed, use **Re-run failed jobs** on that run — it keeps the `refs/heads/main` ref. `yarn deploy` from a laptop is no longer part of the release flow.

## npm publishing (Trusted Publishing / OIDC)

The `publish-npm` job authenticates via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) — GitHub Actions proves its identity to npm with an OIDC token, so **no `NPM_TOKEN` secret exists or needs rotating**. Publishes made this way also carry provenance attestations.

### Why the publisher must be bound to an environment

npm matches the OIDC token on repository, workflow filename and — only if one is configured — environment. It does **not** check the git ref. A push runs the copy of `release.yml` that exists at the pushed ref, with that copy's own `on:` triggers, so anyone with write access could push a branch (or a `v*` tag at an unreviewed commit) carrying a rewritten `release.yml` and get a token npm accepts. The `on:` filter, the CHANGELOG/tag checks and the test/build steps all live in the file they would replace, so none of them is a security boundary.

The `publish-npm` job therefore runs in the `npm` GitHub environment, and the npm trusted publisher is bound to that environment. GitHub refuses to start a job in that environment — and so never mints the token — unless the run's ref passes the environment's deployment policy and a required reviewer approves it.

The environment admits `main` only — not `v*` tags. The Release workflow itself has to push tags with `GITHUB_TOKEN`, so any tag ruleset must let that token through, and then any write-access principal's branch workflow can use the same token to tag an unreviewed commit. A tag therefore cannot prove a commit was reviewed; only `main`, behind branch protection, can.

### One-time setup

Repository admin, on GitHub → repo **Settings**:

1. **Environments** → **New environment** named `npm` (if it already exists — GitHub auto-creates it the first time any run references it — edit it and remove anything not listed here).
   - **Required reviewers**: add the release maintainers, enable **Prevent self-review**, and untick **Allow administrators to bypass configured protection rules**.
   - **Deployment branches and tags**: choose **Selected branches and tags** and add exactly one branch rule, `main`. No tag rules, no other branches.
   - Do not add any secrets — publishing uses OIDC only.
2. **Rules** → **Rulesets** → **New tag ruleset** targeting `v*` tags: enable **Restrict creations**, **Restrict updates** and **Restrict deletions**, with only repository admins and the release automation in the bypass list. This keeps people from hand-pushing release tags (and GitHub Releases) at unreviewed commits; it is not what guards npm, since tags cannot publish. Check the first release after setting it up: if the `Resolve release tag` job's `git push origin "$TAG"` is rejected, the release automation is not covered by the bypass list and the ruleset must be adjusted.
3. Keep branch protection on `main` (required reviews and status checks), so the only way code reaches `main` is the reviewed merge.

Package maintainer, on npmjs.com → package **Settings** → **Trusted Publisher**:

1. Select GitHub Actions.
2. Set organization `doitintl`, repository `doit-mcp-server`, workflow filename `release.yml`, **environment `npm`**. Never leave the environment empty — a filename-only match accepts a token from any ref.
3. Save. Under **Publishing access**, also select **Require two-factor authentication and disallow tokens** so the trusted publisher is the only token-based way to publish. Maintainers can still publish interactively with 2FA (e.g. `yarn deploy`), which skips this gate — don't.

Each release now pauses at the `Publish to npm` job until a reviewer approves the `npm` deployment in the Actions run. Approve only runs on `main` whose commit is the merged release PR.

To check the GitHub side without risking a real publish, push a throwaway branch whose `release.yml` triggers on that branch and has a single job with `environment: npm` that only runs `echo` — no `npm publish`. GitHub must refuse to start it because the branch is not allowed to deploy to `npm`; repeat with a throwaway `v*` tag. On the npm side, confirm the trusted publisher shows environment `npm`; don't test it with a real `npm publish`, because a published version number can never be reused.

Order matters. Create and protect the `npm` environment **before** the first run that references it: GitHub auto-creates a missing environment with no protection rules, so a run against a missing `npm` environment publishes ungated. And until the npm trusted publisher names environment `npm`, npm still accepts tokens from any ref — the GitHub side alone does not close the gap.

Until the npm side is set up at all, the `publish-npm` job fails at the `npm publish` step with an auth error — everything before it (release creation) still works.

## Cloudflare Worker (mcp.doit.com)

Publishing to npm does **not** update the hosted Worker — it consumes this package's `/core` export from its own (private) repo and must bump the dependency and redeploy there. Automating that half is tracked internally.
