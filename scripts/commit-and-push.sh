#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/commit-and-push.sh ["commit message"]
# Interactive confirmation is shown unless SKIP_CONFIRM=true (useful for CI)
branch=$(git rev-parse --abbrev-ref HEAD)
msg=${1:-"chore: workspace changes"}

git add -A

# If there are no staged changes, exit cleanly
if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

if [ "${SKIP_CONFIRM:-""}" != "true" ] && [ "${CI:-""}" != "true" ]; then
  echo "About to commit and push to branch: $branch"
  echo "Commit message: $msg"
  read -r -p "Proceed? [y/N] " answer
  case "$answer" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted by user."; exit 1 ;;
  esac
fi

git commit -m "$msg"
git push origin "$branch"

echo "Committed and pushed to $branch"
