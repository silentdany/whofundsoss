# WhoFundsOSS

**Who really funds open source, and how much?**

[whofundsoss.com](https://whofundsoss.com) is a public ranking of companies that put money into open source. It counts only the dollars a company has already made public. No estimates, no guesses, no paid placements.

## Why

Plenty of companies say they "support open source". Very few say how much. WhoFundsOSS gathers every published figure in one place, so anyone can see who backs the projects they depend on, and who doesn't show it.

## What it counts

Four public sources, read once a month:

- **Open Source Pledge**: the yearly payment from the company's latest public report.
- **Open Collective**: the total a company has donated to open source collectives. Often cumulative over several years, and labeled as such.
- **GitHub Sponsors**: monthly sponsorships, only when the tier amount is public. That is rare.
- **Own programs**: a figure a company publishes about its own open source fund.

## The rules

- Only published dollars count. A private GitHub tier stays at zero, it is never guessed.
- Nothing is annualized. A monthly amount is never multiplied by twelve.
- Each dollar is counted once. A pledge repeated as an own program is not counted twice.
- Spam is kept out of the ranking. Casinos, follower sellers, link farms and the like are listed on a public, versioned [spam denylist](https://whofundsoss.com/denylist), each with a reason.
- Self-funding is kept out. A company backing its own collective is not outbound sponsoring.

Every total is a floor, not a verdict. A big company can fund a lot privately, through foundation memberships or paid staff, and still show a small number here.

## What's on the site

- [Ranking](https://whofundsoss.com/ranking): the top 200 companies by public dollars, with the sources behind each figure.
- Company pages: every sponsorship line, by source and by project.
- [Movements](https://whofundsoss.com/movements): what changed between two monthly snapshots.
- [Mysteries](https://whofundsoss.com/mysteries): companies that sponsor many maintainers but never publish an amount.
- [Graph](https://whofundsoss.com/graph): companies that fund the same projects.
- [Method](https://whofundsoss.com/method): exactly how a number gets onto the site, plus the API.

## Corrections

A figure is wrong or a company is missing? Open an issue with the company, the amount and a public link to the source. Corrections land in the next snapshot.

## License

- Code: [MIT](LICENSE).
- Data (`src/data/`, `data/`, the exports and the API output): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit "WhoFundsOSS" with a link to whofundsoss.com. The underlying figures come from public pages of Open Collective, the Open Source Pledge, GitHub Sponsors and the companies themselves.

Made by Dany ([@MajorBaguette](https://x.com/MajorBaguette)), a solo developer in France.
