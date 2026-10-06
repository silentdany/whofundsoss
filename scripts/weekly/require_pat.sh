#!/usr/bin/env bash
# Fail cleanly when WFO_WEEKLY_PAT is unset/empty. Never prints the secret value.
set -euo pipefail
if [ -z "${WFO_WEEKLY_PAT:-}" ]; then
  echo "ERROR: repository secret WFO_WEEKLY_PAT is missing or empty." >&2
  echo "Create a fine-grained PAT (Contents: R/W, Pull requests: R/W on silentdany/whofundsoss)" >&2
  echo "and store it as Actions secret WFO_WEEKLY_PAT. Do not enable broader scopes." >&2
  exit 1
fi
# Presence-only check — do not echo, mask, or write the value anywhere.
echo "WFO_WEEKLY_PAT: present (value not logged)"
