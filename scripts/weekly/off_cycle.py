"""Off-cycle guard for the weekly scraper.

The weekly cadence is Monday, Europe/Paris. A manual (workflow_dispatch) run on
any other Paris day is refused unless allow_off_cycle=true is passed. An
allowed off-cycle run is marked `offCycle` so it never counts as a reading for
the two-consecutive-readings rules (zero readings, sharp drops): it cannot
release a pending hold early (context: PR #41, a mid-week run).

CLI (used by .github/workflows/weekly-scraper.yml):
    python3 -m scripts.weekly.off_cycle --event "$GITHUB_EVENT_NAME" --allow "$INPUT_ALLOW_OFF_CYCLE"
Prints `off_cycle=true|false` and exits 0, or exits 3 when the run is refused
(2 on bad arguments).
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

PARIS = ZoneInfo("Europe/Paris")
MONDAY = 0
EXIT_REFUSED = 3


class OffCycleRefused(Exception):
    pass


def parse_flag(raw: str | None) -> bool:
    v = (raw or "").strip().lower()
    if v in ("", "false", "0", "no"):
        return False
    if v in ("true", "1", "yes"):
        return True
    raise ValueError(f"allow_off_cycle must be true or false, got {raw!r}")


def is_cycle_day(now: datetime) -> bool:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(PARIS).weekday() == MONDAY


def decide(event: str, now: datetime, allow_off_cycle: bool) -> bool:
    """Return True when the run is off-cycle (allowed), False when on-cycle.

    Raises OffCycleRefused for a manual run off the Paris Monday without the flag.
    Scheduled runs are never refused (a late cron still runs), but are marked
    off-cycle if they land outside Monday Paris.
    """
    if is_cycle_day(now):
        return False
    if event == "workflow_dispatch" and not allow_off_cycle:
        day = now.astimezone(PARIS).strftime("%A %Y-%m-%d")
        raise OffCycleRefused(
            f"manual run refused: today is {day} in Europe/Paris, the weekly cycle is Monday. "
            "Re-run with allow_off_cycle=true to scrape anyway (it will not count toward the "
            "two-readings rule)."
        )
    return True


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--event", required=True)
    p.add_argument("--allow", default="false")
    p.add_argument("--now", default=None, help="ISO timestamp with offset (tests only)")
    a = p.parse_args(argv)
    try:
        allow = parse_flag(a.allow)
        now = datetime.fromisoformat(a.now) if a.now else datetime.now(timezone.utc)
        off = decide(a.event, now, allow)
    except OffCycleRefused as e:
        print(f"::error::{e}", file=sys.stderr)
        return EXIT_REFUSED
    except ValueError as e:
        print(f"::error::{e}", file=sys.stderr)
        return 2
    print(f"off_cycle={'true' if off else 'false'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
