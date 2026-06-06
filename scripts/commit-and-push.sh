#!/usr/bin/env bash
set -euo pipefail

# Usage: sh scripts/commit-and-push.sh "commit message"
branch=$(git rev-parse --abbrev-ref HEAD)
msg=${1:-"chore: workspace changes"}

git add -A

# If there are no staged changes, exit cleanly
if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

git commit -m "$msg"
git push origin "$branch"

echo "Committed and pushed to $branch"
