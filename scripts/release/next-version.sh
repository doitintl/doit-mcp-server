#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"

readonly USAGE="Print the next release tag, derived from Conventional Commit subjects.

Commits are read from the latest v* tag up to the given ref. The bump level is:

  breaking (\`!:\` or \`BREAKING CHANGE\`)  major (minor while the version is 0.x)
  feat                                   minor
  anything else                          patch

Prints nothing and exits 0 when there is nothing to release, which also covers
the case where package.json is already ahead of the latest tag — a release is
prepared but not tagged yet, so proposing another one would duplicate it.

Usage:
  ${SCRIPT_NAME} [ref]

Examples:
  ${SCRIPT_NAME}
  ${SCRIPT_NAME} HEAD"

case "${1:-}" in
  -h|--help) echo "$USAGE"; exit 0 ;;
esac

ref="${1:-HEAD}"

latest_tag="$(git tag --list 'v*' --sort=-v:refname | head -n 1)"
[[ -n "$latest_tag" ]] || { echo "${SCRIPT_NAME}: error: no v* tag found" >&2; exit 1; }

# A release that is prepared but not yet tagged leaves package.json ahead of
# the latest tag. Stay quiet until the Release workflow catches up.
pkg_version="$(git show "${ref}:package.json" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version")"
[[ "v${pkg_version}" == "$latest_tag" ]] || exit 0

# Merge commits repeat their branch's subjects, so they are excluded.
commits="$(git log "${latest_tag}..${ref}" --no-merges --format=%B)"
[[ -n "${commits//[[:space:]]/}" ]] || exit 0

IFS='.' read -r major minor patch <<< "${latest_tag#v}"

if grep -qE '^[a-z]+(\([^)]*\))?!:|^BREAKING CHANGE' <<< "$commits"; then
  # A 0.x line is not stable yet, so a breaking change bumps the minor instead
  # of declaring 1.0.0 — that call stays with a human.
  if [[ "$major" == "0" ]]; then
    minor=$((minor + 1)); patch=0
  else
    major=$((major + 1)); minor=0; patch=0
  fi
elif grep -qE '^feat(\([^)]*\))?:' <<< "$commits"; then
  minor=$((minor + 1)); patch=0
else
  patch=$((patch + 1))
fi

echo "v${major}.${minor}.${patch}"
