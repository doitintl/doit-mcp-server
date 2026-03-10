#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <base-ref> <head-ref>"
  echo "Example: $0 origin/main HEAD"
  exit 1
fi

BASE_REF="$1"
HEAD_REF="$2"

# Conventional commit pattern: type(optional-scope): description
PATTERN='^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(.+\))?: .{1,120}$'

echo "Checking commits from ${BASE_REF} to ${HEAD_REF}..."

FAILED=0
while IFS= read -r LINE; do
  HASH="${LINE%% *}"
  MESSAGE="${LINE#* }"

  if ! echo "$MESSAGE" | grep -qE "$PATTERN"; then
    echo "FAIL: $HASH $MESSAGE"
    FAILED=$((FAILED + 1))
  fi
done < <(git log --no-merges --format="%h %s" "${BASE_REF}..${HEAD_REF}")

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "${FAILED} commit(s) do not follow the Conventional Commits format."
  echo "Expected: type(optional-scope): description"
  echo "Allowed types: feat, fix, chore, docs, style, refactor, perf, test, build, ci, revert"
  echo ""
  echo "Commit messages are used in changelogs and release notes. Some tools depend on properly formatted commit messages."
  echo "Please consider updating your commit messages, or squash them into a single commit with a proper message before merging."
  echo "Please consider using pre-commit hooks to enforce commit message formatting in the future."
  exit 1
fi

echo "All commits follow the Conventional Commits format."
