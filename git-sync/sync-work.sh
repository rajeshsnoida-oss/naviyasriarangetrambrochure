#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Daily flow on WORK PC. One-way bridge: github.com --> company git.
# (github.com is read-only from this machine; only company git is writable.)
#
# Order:
#   1. Pull colleague changes from company git
#   2. Pull Teacher LLM changes from github.com (read-only)
#   3. Merge if both changed (usually clean: different files)
#   4. Push merged state to company git
#
# Safe to run even when only one side has new commits.
#
# Usage:
#   sync-work.sh <path-to-config.sh>
# Example:
#   sync-work.sh ~/scripts/config-utils.sh
# ----------------------------------------------------------------------------
set -euo pipefail

CONFIG_PATH="${1:-}"
if [[ -z "$CONFIG_PATH" ]]; then
    echo "Usage: $0 <path-to-config.sh>" >&2
    exit 1
fi
if [[ ! -f "$CONFIG_PATH" ]]; then
    echo "ERROR: config file not found: $CONFIG_PATH" >&2
    exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_PATH"
shift

cd "$WORK_REPO_DIR"

# ── Pre-push hook: block any push to github.com on this work PC ─────────────
# Installed (and refreshed) on every sync so a missing/altered hook
# self-heals. Only matters on the work PC where proprietary mappings
# may be present — sync to public github.com is one-way (pull only).
# Override exists for the rare case of a verified-clean force-push
# (e.g., history rewrite): set NORA_ALLOW_PUBLIC_PUSH=1.
HOOK_PATH="$WORK_REPO_DIR/.git/hooks/pre-push"
HOOK_SIGNATURE='# nora-sync-work block-public-push v1'
if [[ ! -f "$HOOK_PATH" ]] || ! grep -q "$HOOK_SIGNATURE" "$HOOK_PATH"; then
    echo "==> Installing pre-push hook (block public github)"
    mkdir -p "$(dirname "$HOOK_PATH")"
    cat > "$HOOK_PATH" <<'HOOK_EOF'
#!/usr/bin/env bash
# nora-sync-work block-public-push v1
# Installed by sync-work.sh. Refuses any git push whose remote URL
# points at github.com — proprietary content (mappings/, env_dir
# state, etc.) must never reach the public mirror from this host.
# Override (rare, audited): NORA_ALLOW_PUBLIC_PUSH=1 git push ...
remote="$1"
remote_url="$2"
if [[ "${NORA_ALLOW_PUBLIC_PUSH:-0}" == "1" ]]; then
    echo "[pre-push] NORA_ALLOW_PUBLIC_PUSH=1 set; allowing push to $remote_url" >&2
    exit 0
fi
case "$remote_url" in
    *github.com*|*github.com:*)
        echo "ERROR: push to github.com is BLOCKED on this machine." >&2
        echo "       Use sync-work.sh (push to company) or push from personal PC." >&2
        echo "       Remote: $remote ($remote_url)" >&2
        echo "       Override (rare): NORA_ALLOW_PUBLIC_PUSH=1 git push ..." >&2
        exit 1
        ;;
esac
exit 0
HOOK_EOF
    chmod +x "$HOOK_PATH"
fi

# Refuse to run with an unclean working tree. Committed local commits are fine
# — they'll be pushed to company. Only uncommitted diffs block sync, to avoid
# silently entangling unrelated in-progress edits with a merge.
if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: working tree is not clean. Commit or stash before syncing." >&2
    git status --short >&2
    exit 1
fi

git checkout "$DEFAULT_BRANCH"

echo "==> [1/4] Fetching $COMPANY_REMOTE"
git fetch "$COMPANY_REMOTE"

echo "==> [2/4] Merging $COMPANY_REMOTE/$DEFAULT_BRANCH (colleague changes)"
git merge --no-edit "$COMPANY_REMOTE/$DEFAULT_BRANCH"

echo "==> [3/4] Fetching $GITHUB_REMOTE"
git fetch "$GITHUB_REMOTE"

# Guard against github history rewrites. Daily sync MUST be merge-based so
# work-only commit SHAs stay stable for teammates pulling from company. If
# origin was rewritten, abort and direct the user to adopt-github-rewrite.sh.
# Two complementary checks:
#   1. recorded last-synced origin tip (if present) must still be reachable
#   2. no local commit may share a patch-id with one on origin (`git cherry -`)
LAST_SYNCED_FILE="$WORK_REPO_DIR/.git/last-synced-origin-${DEFAULT_BRANCH}"
if [[ -f "$LAST_SYNCED_FILE" ]]; then
    LAST_SYNCED=$(cat "$LAST_SYNCED_FILE")
    if ! git merge-base --is-ancestor "$LAST_SYNCED" "${GITHUB_REMOTE}/${DEFAULT_BRANCH}" 2>/dev/null; then
        echo "ERROR: ${GITHUB_REMOTE}/${DEFAULT_BRANCH} history was rewritten." >&2
        echo "       Last-synced tip ($LAST_SYNCED) is no longer reachable from origin." >&2
        echo "       Run adopt-github-rewrite.sh to recover, then resume sync." >&2
        exit 1
    fi
fi
DUP_COUNT=$(git cherry "${GITHUB_REMOTE}/${DEFAULT_BRANCH}" "${DEFAULT_BRANCH}" 2>/dev/null | grep -c '^-' || true)
if [[ "$DUP_COUNT" -gt 0 ]]; then
    echo "ERROR: $DUP_COUNT commit(s) in ${DEFAULT_BRANCH} have patches already on ${GITHUB_REMOTE}/${DEFAULT_BRANCH}." >&2
    echo "       This indicates github history was rewritten." >&2
    echo "       Run adopt-github-rewrite.sh to recover, then resume sync." >&2
    exit 1
fi

echo "==> [3/4] Merging $GITHUB_REMOTE/$DEFAULT_BRANCH (your changes)"
git merge --no-edit "$GITHUB_REMOTE/$DEFAULT_BRANCH"

# Step 4: push to company
LOCAL=$(git rev-parse "$DEFAULT_BRANCH")
REMOTE=$(git rev-parse "$COMPANY_REMOTE/$DEFAULT_BRANCH")
if [[ "$LOCAL" == "$REMOTE" ]]; then
    echo "==> [4/4] Company git already up to date — no push needed."
else
    echo "==> [4/4] Pushing to $COMPANY_REMOTE/$DEFAULT_BRANCH"
    git push "$COMPANY_REMOTE" "$DEFAULT_BRANCH"
fi

# Record the synced origin tip so the next run can detect a future rewrite.
git rev-parse "${GITHUB_REMOTE}/${DEFAULT_BRANCH}" > "$LAST_SYNCED_FILE"

echo "---"
git log --oneline --decorate -n 5
echo "Done."
