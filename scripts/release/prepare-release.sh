#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

readonly USAGE="Prepare a release: update versions and draft the changelog.

Usage:
  ${SCRIPT_NAME} -t <version> [-n] [-h]
  ${SCRIPT_NAME} --tag <version> [--dry-run] [--help]

Options:
  -t, --tag TAG   New version tag (e.g. v0.9.0, required)
  -n, --dry-run   Run preflight checks and preview versions + changelog (no writes)
  -h, --help      Show this help message

Examples:
  ${SCRIPT_NAME} --tag v0.9.0
  ${SCRIPT_NAME} --tag v0.9.0 --dry-run
  ${SCRIPT_NAME} -t v0.9.0 -n"

# --- helpers ---

usage() { echo "$USAGE"; }

die() {
  echo "${SCRIPT_NAME}: error: $*" >&2
  exit 1
}

info() { echo "  $*"; }

section() {
  echo ""
  echo "==> $*"
}

warn() {
  echo "${SCRIPT_NAME}: warning: $*" >&2
}

# Prompt user to confirm after a warning. Exits unless user answers 'y' (case-insensitive).
confirm_or_exit() {
  local prompt="${1:-Continue anyway?}"
  local answer
  # Read directly from /dev/tty so it works even when stdin is piped
  read -r -p "${prompt} [y/N] " answer </dev/tty
  if [[ ! "$(echo "$answer" | tr '[:upper:]' '[:lower:]')" == "y" ]]; then
    echo "Aborting." >&2
    exit 1
  fi
}

# Strip leading 'v' from a tag (v0.9.0 -> 0.9.0)
strip_v() { echo "${1#v}"; }

# --- preflight checks ---

check_branch() {
  local current_branch
  current_branch="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
  if [[ "$current_branch" != "main" ]]; then
    warn "you are on branch '${current_branch}', not 'main'."
    warn "releases should be cut from 'main'."
    confirm_or_exit "Continue with branch '${current_branch}'?"
  else
    info "branch: ${current_branch}"
  fi
}

check_clean_working_tree() {
  local status
  status="$(git -C "$REPO_ROOT" status --porcelain)"
  if [[ -n "$status" ]]; then
    warn "there are uncommitted changes:"
    echo "$status" | sed 's/^/    /' >&2
    confirm_or_exit "Continue with uncommitted changes?"
  else
    info "working tree: clean"
  fi
}

check_tag() {
  local new_tag="$1"

  # Ensure the new tag does not already exist
  if git -C "$REPO_ROOT" tag --list | grep -qx "$new_tag"; then
    die "tag '${new_tag}' already exists. Delete it first with: git tag -d ${new_tag}"
  fi
  info "tag '${new_tag}': available"

  # Find the latest existing tag and ask user to confirm the range
  local latest_tag
  latest_tag="$(git -C "$REPO_ROOT" tag --list 'v*' --sort=-v:refname | head -n 1)"
  if [[ -z "$latest_tag" ]]; then
    info "previous tag: none (first release)"
    confirm_or_exit "No previous tag found. Release ${new_tag} as first release?"
  else
    info "previous tag: ${latest_tag}"
    confirm_or_exit "Changelog will cover '${latest_tag}..${new_tag}'. Continue?"
  fi
}

# --- version update helpers ---

update_package_json_version() {
  local file="$1"
  local version="$2"
  # Use node to update the version field — portable and JSON-safe
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('${file}', 'utf8'));
    pkg.version = '${version}';
    fs.writeFileSync('${file}', JSON.stringify(pkg, null, 2) + '\n');
  "
  info "updated ${file} -> ${version}"
}

update_consts_version() {
  local file="$1"
  local version="$2"
  # Replace the SERVER_VERSION constant value
  sed -i.bak "s/SERVER_VERSION = \"[^\"]*\"/SERVER_VERSION = \"${version}\"/" "$file"
  rm -f "${file}.bak"
  info "updated ${file} -> ${version}"
}

# --- main ---

main() {
  local tag="" dry_run=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -t|--tag)      tag="$2"; shift 2 ;;
      -n|--dry-run)  dry_run=true; shift ;;
      -h|--help)     usage; exit 0 ;;
      *)             die "unknown option: $1" ;;
    esac
  done

  [[ -n "$tag" ]] || die "--tag is required (e.g. --tag v0.9.0)"

  # Validate tag format
  [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "tag must be in the format vX.Y.Z (got: ${tag})"

  local version
  version="$(strip_v "$tag")"

  section "Preflight checks"
  check_branch
  check_clean_working_tree
  check_tag "$tag"

  if $dry_run; then
    section "[dry-run] Current versions (would be updated to ${version})"
    echo ""
    echo "  package.json files:"
    find "$REPO_ROOT" -name "package.json" -not -path "*/node_modules/*" | sort | \
      while IFS= read -r f; do
        local rel_path="${f#${REPO_ROOT}/}"
        local cur_version
        cur_version="$(node -p "require('${f}').version")"
        info "${rel_path}: ${cur_version}"
      done
    echo ""
    echo "  src/utils/consts.ts:"
    grep "SERVER_VERSION" "${REPO_ROOT}/src/utils/consts.ts" | sed 's/^/    /'
    echo ""
    section "[dry-run] Changelog preview for ${tag}"
    bash "${SCRIPT_DIR}/write-changelog.sh" --tag "$tag" --dry-run
    echo ""
    info "dry-run complete — no files were modified."
    return
  fi

  section "Updating versions to ${version}"

  update_package_json_version "${REPO_ROOT}/package.json" "$version"
  update_package_json_version "${REPO_ROOT}/doit-mcp-server/package.json" "$version"
  update_package_json_version "${REPO_ROOT}/test/integration/package.json" "$version"
  update_consts_version "${REPO_ROOT}/src/utils/consts.ts" "$version"

  section "Drafting changelog for ${tag}"

  bash "${SCRIPT_DIR}/write-changelog.sh" --tag "$tag"

  # --- instructions ---

  echo ""
  echo "============================================================"
  echo " Release ${tag} is ready for review"
  echo "============================================================"
  echo ""
  echo "Files changed:"
  git -C "$REPO_ROOT" diff --name-only | sed 's/^/  /'
  echo ""
  echo "Next steps:"
  echo ""
  echo "  1. Review and edit the changelog entry in CHANGELOG.md if needed."
  echo ""
  echo "  2. Commit the release preparation:"
  echo "       git add package.json doit-mcp-server/package.json test/integration/package.json src/utils/consts.ts CHANGELOG.md"
  echo "       git commit -m \"chore: prepare release ${tag}\""
  echo ""
  echo "  3. Tag the release:"
  echo "       git tag ${tag}"
  echo ""
  echo "  4. Push the tag to trigger the Release workflow:"
  echo "       git push origin ${tag}"
  echo ""
  echo "  The CI release workflow will extract the changelog entry and"
  echo "  create a GitHub Release automatically."
  echo ""
}

main "$@"
