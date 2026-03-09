#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly CHANGELOG_FILE="CHANGELOG.md"
readonly CHANGELOG_HEADER="# Changelog"

readonly USAGE="Generate a changelog entry and prepend it to ${CHANGELOG_FILE}.

Commits are collected from the previous tag up to HEAD of main (or specified
ref). The --tag flag sets the version label for the entry, not the git ref.

Usage:
  ${SCRIPT_NAME} [options]

Options:
  -t, --tag TAG        Version label for the entry (required)
  -p, --previous TAG   Previous tag to compare from (default: latest tag)
  -r, --ref REF        Git ref to collect commits up to (default: main)
  --dry-run            Show what would be generated without writing
  -h, --help           Show this help message

Examples:
  ${SCRIPT_NAME} --tag v0.5.0 --dry-run
  ${SCRIPT_NAME} --tag v0.5.0
  ${SCRIPT_NAME} --tag v0.5.0 --previous v0.3.0
  ${SCRIPT_NAME} --tag v0.5.0 --ref HEAD"

# --- helpers ---

usage() {
  echo "$USAGE"
}

die() {
  echo "${SCRIPT_NAME}: error: $*" >&2
  exit 1
}

info() {
  echo ":: $*" >&2
}

# --- git helpers ---

get_latest_tag() {
  git tag --list 'v*' --sort=-v:refname | head -n 1
}

get_commits_between() {
  local from="$1"
  local to="$2"

  if [[ -z "$from" ]]; then
    git log "$to" --oneline --no-merges
  else
    git log "${from}..${to}" --oneline --no-merges
  fi
}

# --- changelog formatting ---

categorize_commits() {
  local commits="$1"
  local feats="" fixes="" chores="" others=""

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local hash msg
    hash="$(echo "$line" | cut -d' ' -f1)"
    msg="$(echo "$line" | cut -d' ' -f2-)"

    if [[ "$msg" =~ ^feat ]]; then
      feats+="- ${msg} (\`${hash}\`)"$'\n'
    elif [[ "$msg" =~ ^fix ]]; then
      fixes+="- ${msg} (\`${hash}\`)"$'\n'
    elif [[ "$msg" =~ ^chore ]]; then
      chores+="- ${msg} (\`${hash}\`)"$'\n'
    else
      others+="- ${msg} (\`${hash}\`)"$'\n'
    fi
  done <<< "$commits"

  local output=""

  if [[ -n "$feats" ]]; then
    output+=$'\n'"### Features"$'\n\n'"${feats}"
  fi
  if [[ -n "$fixes" ]]; then
    output+=$'\n'"### Bug Fixes"$'\n\n'"${fixes}"
  fi
  if [[ -n "$chores" ]]; then
    output+=$'\n'"### Chores"$'\n\n'"${chores}"
  fi
  if [[ -n "$others" ]]; then
    output+=$'\n'"### Other Changes"$'\n\n'"${others}"
  fi

  echo "$output"
}

format_entry() {
  local commits="$1"
  local tag="$2"
  local prev="$3"
  local date
  date="$(date +%Y-%m-%d)"

  local range_label
  if [[ -n "$prev" ]]; then
    range_label="${prev}...${tag}"
  else
    range_label="${tag}"
  fi

  echo "## ${tag} (${date})"
  echo ""
  echo "**Full diff:** [\`${range_label}\`](../../compare/${range_label})"
  categorize_commits "$commits"
}

# --- changelog file operations ---

prepend_to_changelog() {
  local entry="$1"
  local changelog="$CHANGELOG_FILE"

  if [[ -f "$changelog" ]]; then
    local existing
    existing="$(tail -n +3 "$changelog")"
    printf '%s\n\n%s\n%s\n' "$CHANGELOG_HEADER" "$entry" "$existing" > "$changelog"
  else
    printf '%s\n\n%s\n' "$CHANGELOG_HEADER" "$entry" > "$changelog"
  fi
}

# --- main ---

main() {
  local tag="" previous="" ref="main" dry_run=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -t|--tag)      tag="$2"; shift 2 ;;
      -p|--previous) previous="$2"; shift 2 ;;
      -r|--ref)      ref="$2"; shift 2 ;;
      --dry-run)     dry_run=true; shift ;;
      -h|--help)     usage; exit 0 ;;
      *)             die "unknown option: $1" ;;
    esac
  done

  [[ -n "$tag" ]] || die "--tag is required (e.g. --tag v0.5.0)"

  # Resolve previous tag
  if [[ -z "$previous" ]]; then
    previous="$(get_latest_tag)"
  fi

  info "tag:      ${tag} (version label)"
  info "ref:      ${ref} (commit range target)"
  info "previous: ${previous:-"(none — first release)"}"

  # Get commits between previous tag and ref
  local commits
  commits="$(get_commits_between "$previous" "$ref")"

  if [[ -z "$commits" ]]; then
    info "no commits found between ${previous:-start} and ${ref}"
    exit 0
  fi

  local commit_count
  commit_count="$(echo "$commits" | wc -l | tr -d ' ')"
  info "commits:  ${commit_count}"

  # Format entry
  local entry
  entry="$(format_entry "$commits" "$tag" "$previous")"

  # Output
  if $dry_run; then
    info "[dry-run] would prepend to ${CHANGELOG_FILE}:"
    echo ""
    echo "$entry"
  else
    prepend_to_changelog "$entry"
    info "updated ${CHANGELOG_FILE}"
  fi
}

main "$@"
