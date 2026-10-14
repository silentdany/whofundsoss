"""Off-cycle guard for the weekly scraper.

The weekly cadence is Monday, Europe/Paris. A manual (workflow_dispatch) run on
any other Paris day is refused unless allow_off_cycle=true is passed. An
allowed off-cycle run is marked `offCycle` so it never counts as a reading for
the two-consecutive-readings rules (zero readings, sharp drops): it cannot
release a pending hold early (context: PR #41, a mid-week run).

The run date is the Europe/Paris calendar date, computed here once and used by
every later step (a Monday 00:30 Paris dispatch is dated Monday, so the 04:17
UTC cron the same day is caught by the duplicate guard).

Only the events in ALLOWED_EVENTS may run the scraper.

CLI (used by .github/workflows/weekly-scraper.yml):
    python3 -m scripts.weekly.off_cycle --event "$GITHUB_EVENT_NAME" --allow "$INPUT_ALLOW_OFF_CYCLE"
Prints `off_cycle=true|false` and `date=YYYY-MM-DD` (Paris) and exits 0, or
exits 3 when the run is refused (2 on bad arguments).
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

PARIS = ZoneInfo("Europe/Paris")
MONDAY = 0
ALLOWED_EVENTS = frozenset({"schedule", "workflow_dispatch"})
EXIT_REFUSED = 3


def is_off_cycle(value: object) -> bool:
    """The `offCycle` marker: boolean True or the string "true" (nothing else)."""
    return value is True or value == "true"


class OffCycleRefused(Exception):
    pass


def parse_flag(raw: str | None) -> bool:
    # GitHub boolean inputs render as exactly "true"/"false"; empty = not passed.
    v = (raw or "").strip()
    if v in ("", "false"):
        return False
    if v == "true":
        return True
    raise ValueError(f"allow_off_cycle must be true or false, got {raw!r}")


def run_date_paris(now: datetime) -> str:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(PARIS).date().isoformat()


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
    if event not in ALLOWED_EVENTS:
        raise OffCycleRefused(f"event {event!r} may not run the weekly scraper (allowed: {sorted(ALLOWED_EVENTS)})")
    if is_cycle_day(now):
        return False
    if event != "schedule" and not allow_off_cycle:
        day = now.astimezone(PARIS).strftime("%A %Y-%m-%d")
        raise OffCycleRefused(
            f"manual run refused: today is {day} in Europe/Paris, the weekly cycle is Monday. "
            "Re-run with allow_off_cycle=true to scrape anyway (it will not count toward the "
            "two-readings rule)."
        )
    return True


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--is-off-cycle-file", default=None, help="Exit 0 if this weekly JSON is off-cycle, 1 otherwise")
    p.add_argument("--event", default=None)
    p.add_argument("--allow", default="false")
    p.add_argument("--now", default=None, help="ISO timestamp with offset (tests only)")
    a = p.parse_args(argv)
    if a.is_off_cycle_file:
        import json

        try:
            with open(a.is_off_cycle_file, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError) as e:
            print(f"::error::cannot read {a.is_off_cycle_file}: {e}", file=sys.stderr)
            return 2
        return 0 if isinstance(data, dict) and is_off_cycle(data.get("offCycle")) else 1
    try:
        if not a.event:
            raise ValueError("--event is required")
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
    print(f"date={run_date_paris(now)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
