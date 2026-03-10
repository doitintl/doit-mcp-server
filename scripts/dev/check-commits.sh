#!/usr/bin/env bash
set -euo pipefail

SAFE=0
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --safe) SAFE=1 ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done

if [ "${#POSITIONAL[@]}" -lt 2 ]; then
  echo "Usage: $0 [--safe] <base-ref> <head-ref>"
  echo "Example: $0 origin/main HEAD"
  echo "  --safe  Only print commit hashes in output, not messages (avoids shell injection from untrusted commit messages)"
  exit 1
fi

BASE_REF="${POSITIONAL[0]}"
HEAD_REF="${POSITIONAL[1]}"

# Conventional commit pattern: type(optional-scope): description
PATTERN='^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(.+\))?!?: .{1,120}$'

echo "Checking commits from ${BASE_REF} to ${HEAD_REF}..."

FAILED=0
while IFS= read -r LINE; do
  HASH="${LINE%% *}"
  MESSAGE="${LINE#* }"

  if ! echo "$MESSAGE" | grep -qE "$PATTERN"; then
    if [ "$SAFE" -eq 1 ]; then
      echo "FAIL: $HASH"
    else
      echo "FAIL: $HASH $MESSAGE"
    fi
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
