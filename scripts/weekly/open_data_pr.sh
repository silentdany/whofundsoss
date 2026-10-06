#!/usr/bin/env bash
# Create a data PR whose branch is based on origin/main and contains ONLY
# data/weekly/**. Never prints secrets. Requires GH_TOKEN / gh auth.
set -euo pipefail

if [ -z "${GH_TOKEN:-${WFO_WEEKLY_PAT:-}}" ]; then
  echo "ERROR: GH_TOKEN/WFO_WEEKLY_PAT missing" >&2
  exit 1
fi
export GH_TOKEN="${GH_TOKEN:-$WFO_WEEKLY_PAT}"

DATE="${DATE:-$(date -u +%F)}"
RUN_ID="${RUN_ID:-local}"
BRANCH="data/weekly-run-${RUN_ID}"
JSON="data/weekly/${DATE}.json"
MD="data/weekly/${DATE}.md"

if [ ! -f "$JSON" ] || [ ! -f "$MD" ]; then
  echo "ERROR: missing scrape outputs $JSON / $MD" >&2
  exit 1
fi

TMP=$(mktemp -d)
cp "$JSON" "$MD" "$TMP/"

git config user.name "whofundsoss-weekly-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git fetch origin main
git checkout -B "$BRANCH" origin/main

mkdir -p data/weekly
cp "$TMP/${DATE}.json" "$TMP/${DATE}.md" data/weekly/
git add -- data/weekly/

# Guard: staged paths must all live under data/weekly/
while IFS= read -r path; do
  case "$path" in
    data/weekly/*) ;;
    *)
      echo "ERROR: staged path outside data/weekly/: $path" >&2
      exit 1
      ;;
  esac
done < <(git diff --cached --name-only)

if git diff --cached --quiet; then
  echo "No data changes to commit (idempotent scrape)."
  # Still open/update PR if branch exists with prior commit
else
  git commit -m "data(weekly): scrape ${RUN_ID} (${DATE})"
fi

# Guard after commit: branch vs origin/main must only touch data/weekly/
while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$path" in
    data/weekly/*) ;;
    *)
      echo "ERROR: branch diff vs main contains non-data path: $path" >&2
      exit 1
      ;;
  esac
done < <(git diff --name-only origin/main...HEAD)

git push -u origin "HEAD:refs/heads/${BRANCH}"

# Open PR if missing (base main). No auto-merge.
if gh pr view "$BRANCH" --json number >/dev/null 2>&1; then
  echo "PR for $BRANCH already exists"
  gh pr view "$BRANCH" --json url,baseRefName,headRefName
else
  gh pr create \
    --base main \
    --head "$BRANCH" \
    --title "data(weekly): sponsorship scrape ${RUN_ID}" \
    --body "$(cat <<BODY
Automated weekly scrape (cron \`17 4 * * 1\` UTC / workflow_dispatch).

- Artifact: \`weekly-${RUN_ID}\`
- Branch built from \`origin/main\`; contains **only** \`data/weekly/**\`
- Denylist source of truth: \`src/lib/spam-denylist.ts\` (parsed, not copied)
- Exclusions: \`data/exclusions/raw-exclusions.csv\`
- Suspects are **flag-only** (never excluded by keyword)
- Disappearances require full source coverage; otherwise see \`unverified_partial\`
- No auto-merge. Consumer: WFOSS Data bot.
BODY
)"
fi
