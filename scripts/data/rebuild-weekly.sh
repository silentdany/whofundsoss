#!/usr/bin/env bash
# Full data rebuild for a weekly PR, all script-generated (no hand edits):
#   catalog from dumps -> denylist ranking -> weekly rules (renames, site
#   overrides, sharp-drop rule) -> denylist/hold/exclusion key migration ->
#   ranking again with migrated keys.
#   scripts/data/rebuild-weekly.sh data/weekly/2026-10-12.json data/weekly/2026-10-06.json
set -euo pipefail
cd "$(dirname "$0")/../.."
WEEKLY="$1"; BASE="$2"
python3 scripts/data/rebuild-from-dumps.py
python3 scripts/data/apply-denylist.py
python3 -m scripts.weekly.reapply_rules "$WEEKLY" "$BASE"
python3 scripts/data/migrate-slug-keys.py "$WEEKLY" --write
python3 scripts/data/apply-denylist.py
python3 -m scripts.weekly.reapply_rules "$WEEKLY" "$BASE"
