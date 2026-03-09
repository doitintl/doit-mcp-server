#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly CHANGELOG_FILE="CHANGELOG.md"

readonly USAGE="Extract release notes for a specific version from ${CHANGELOG_FILE}.

Usage:
  ${SCRIPT_NAME} [options]

Options:
  -t, --tag TAG   Version tag to extract (e.g. v0.5.0, required)
  -h, --help      Show this help message"

# --- helpers ---

usage() {
  echo "$USAGE"
}

die() {
  echo "${SCRIPT_NAME}: error: $*" >&2
  exit 1
}

# --- extraction ---

extract_version_notes() {
  local tag="$1"
  local changelog="$CHANGELOG_FILE"
  local in_section=false
  local result=""

  [[ -f "$changelog" ]] || die "${changelog} not found"

  while IFS= read -r line; do
    if [[ "$line" =~ ^##\  ]]; then
      if $in_section; then
        # Hit the next version heading — stop
        break
      fi
      if [[ "$line" == "## ${tag} "* ]]; then
        in_section=true
        result+="${line}"$'\n'
      fi
    elif $in_section; then
      result+="${line}"$'\n'
    fi
  done < "$changelog"

  if [[ -z "$result" ]]; then
    die "no entry found for ${tag} in ${changelog}"
  fi

  # Print result (variable already has trailing newline from construction)
  printf '%s' "$result"
}

# --- main ---

main() {
  local tag=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -t|--tag) tag="$2"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *)         die "unknown option: $1" ;;
    esac
  done

  [[ -n "$tag" ]] || die "--tag is required"

  extract_version_notes "$tag"
}

main "$@"
