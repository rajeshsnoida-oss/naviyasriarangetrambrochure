#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Recovery on WORK PC after github.com history has been rewritten
# (e.g. filter-branch + force-push performed on personal PC).
#
# When to run:
#   - sync-work.sh aborts with "history was rewritten", OR
#   - you know a public-side force-push happened and want to adopt it.
#
# What it does:
#   1. Verifies preconditions (clean tree, all local commits pushed to company).
#   2. Fetches origin and uses `git cherry` patch-id matching to confirm a
#      rewrite happened and to identify work-only commits.
#   3. Rebases local <branch> onto the new origin/<branch>. The rebase
#      drops old-public commits (patches match new origin) and replays
#      work-only commits on top.
#   4. Force-pushes to company.
#   5. Updates .git/last-synced-origin-<branch> so sync-work.sh resumes
#      cleanly afterward.
#
# Coordination:
#   This force-pushes to company. After it runs, every teammate with a clone
#   of company must do their own one-time recovery on their work clone.
#   COMMUNICATE WITH THE TEAM BEFORE RUNNING THIS.
#
# Usage:
#   adopt-github-rewrite.sh <path-to-config.sh>
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

cd "$WORK_REPO_DIR"

# Pre-condition: clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: working tree is not clean. Commit or stash before recovery." >&2
    git status --short >&2
    exit 1
fi

git checkout "$DEFAULT_BRANCH"

# Pre-condition: every local commit (including work-only) is already on company
echo "==> Fetching $COMPANY_REMOTE to verify local commits are pushed"
git fetch "$COMPANY_REMOTE"
UNPUSHED=$(git rev-list --count "${COMPANY_REMOTE}/${DEFAULT_BRANCH}..${DEFAULT_BRANCH}")
if [[ "$UNPUSHED" -gt 0 ]]; then
    echo "ERROR: $UNPUSHED local commit(s) not yet pushed to ${COMPANY_REMOTE}/${DEFAULT_BRANCH}." >&2
    echo "       Push them first, then re-run this script." >&2
    git log --oneline "${COMPANY_REMOTE}/${DEFAULT_BRANCH}..${DEFAULT_BRANCH}" >&2
    exit 1
fi

echo "==> Fetching $GITHUB_REMOTE"
git fetch "$GITHUB_REMOTE"

# Classify commits in local <branch> vs origin/<branch> using patch-id.
#   `+ <sha>` → patch NOT in origin (genuine local / work-only commit)
#   `- <sha>` → patch IS in origin (duplicate from rewrite — these will be dropped)
CHERRY=$(git cherry "${GITHUB_REMOTE}/${DEFAULT_BRANCH}" "${DEFAULT_BRANCH}" 2>/dev/null || true)
WORK_COMMITS=$(echo "$CHERRY" | awk '$1=="+" {print $2}')
DUP_COMMITS=$(echo "$CHERRY"  | awk '$1=="-" {print $2}')
WORK_COUNT=$(echo -n "$WORK_COMMITS" | grep -c '^' || true)
DUP_COUNT=$(echo -n "$DUP_COMMITS"   | grep -c '^' || true)

if [[ "$DUP_COUNT" -eq 0 ]]; then
    echo "==> No duplicate-patch commits detected — no rewrite to adopt."
    echo "    Use sync-work.sh for the normal daily flow."
    # Still useful to refresh the state file so the daily guard has a baseline.
    git rev-parse "${GITHUB_REMOTE}/${DEFAULT_BRANCH}" > "$WORK_REPO_DIR/.git/last-synced-origin-${DEFAULT_BRANCH}"
    exit 0
fi

echo ""
echo "==> Rewrite detected on ${GITHUB_REMOTE}/${DEFAULT_BRANCH}."
echo "    $DUP_COUNT commit(s) in local ${DEFAULT_BRANCH} have patches already on origin — will be dropped."
echo "    $WORK_COUNT work-only commit(s) to preserve:"
if [[ -n "$WORK_COMMITS" ]]; then
    echo "$WORK_COMMITS" | xargs -r git log --no-walk --oneline | sed 's/^/        /'
else
    echo "        (none)"
fi
echo ""
echo "==> Plan:"
echo "    1. git rebase ${GITHUB_REMOTE}/${DEFAULT_BRANCH} ${DEFAULT_BRANCH}"
echo "    2. git push --force ${COMPANY_REMOTE} ${DEFAULT_BRANCH}"
echo ""
echo "    AFTER THIS RUNS, every teammate with a clone of ${COMPANY_REMOTE} must"
echo "    do their own one-time recovery on their work clone:"
echo "        git fetch ${COMPANY_REMOTE}"
echo "        # if they have unpushed work-only commits, rebase those onto the"
echo "        # new ${COMPANY_REMOTE}/${DEFAULT_BRANCH}; otherwise:"
echo "        git checkout ${DEFAULT_BRANCH} && git reset --hard ${COMPANY_REMOTE}/${DEFAULT_BRANCH}"
echo ""
read -r -p "Proceed? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 1
fi

echo "==> Rebasing onto ${GITHUB_REMOTE}/${DEFAULT_BRANCH}"
if ! git rebase "${GITHUB_REMOTE}/${DEFAULT_BRANCH}" "${DEFAULT_BRANCH}"; then
    echo "" >&2
    echo "ERROR: rebase encountered conflicts." >&2
    echo "       Resolve them and run 'git rebase --continue', OR 'git rebase --abort'." >&2
    echo "       Do NOT push to company until the rebase completes cleanly." >&2
    exit 1
fi

echo "==> Force-pushing to ${COMPANY_REMOTE}/${DEFAULT_BRANCH}"
git push --force "$COMPANY_REMOTE" "$DEFAULT_BRANCH"

# Record the synced origin tip so sync-work.sh's guard has a current baseline.
git rev-parse "${GITHUB_REMOTE}/${DEFAULT_BRANCH}" > "$WORK_REPO_DIR/.git/last-synced-origin-${DEFAULT_BRANCH}"

echo ""
echo "==> Recovery complete. Recent history:"
git log --oneline --decorate -n 8

echo ""
echo "Next steps:"
echo "  - Notify teammates: ${COMPANY_REMOTE}/${DEFAULT_BRANCH} has been rewritten."
echo "  - Each teammate does their own one-time recovery on their work clone."
echo "  - From now on, sync-work.sh runs proceed normally."
