# Weekly holds

`weekly-holds.csv` lists companies whose **disappearance** in a weekly scrape must not
be published on a single reading.

While a hold is active (`run date < review_on`), if the held company is reported as a
verified disappearance, the weekly scraper (`scripts/weekly/run.py`):

- moves it from `disappeared_sponsors` to `held` in the diff (with the hold reason), and
- carries the last known company record forward into `companies`, tagged with
  `hold: {reason, since, review_on, carriedFrom}`, so the next run still has it in its
  baseline.

On or after `review_on` the hold no longer applies: if the company is still missing,
it shows up as a normal verified disappearance and can be published. Remove the row once
the decision is made.

Columns: `slug, source, reason, decided_by, since, review_on` (`source` is informational;
the hold applies to the whole company).
