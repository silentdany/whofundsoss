# WhoFundsOSS: launch kit

Textes à copier-coller (en anglais), liens avec UTM, checklist, et réponses aux objections probables.
Chiffres au **6 oct 2026** : 9,3 M$ de financement public trouvé sur le top 200, 200 entreprises classées, 844 suivies. À remettre à jour si vous publiez après le prochain relevé mensuel.

---

## 1. Liens à utiliser (un par canal)

Un lien différent par canal change l'URL (donc X et les autres vont rechercher l'aperçu OG à neuf) et PostHog sait d'où vient chaque visite.

| Canal | Lien |
|---|---|
| X | `https://whofundsoss.com/?utm_source=x&utm_medium=social&utm_campaign=launch` |
| Hacker News | `https://whofundsoss.com/?utm_source=hackernews&utm_medium=social&utm_campaign=launch` |
| Reddit | `https://whofundsoss.com/?utm_source=reddit&utm_medium=social&utm_campaign=launch` |
| LinkedIn | `https://whofundsoss.com/?utm_source=linkedin&utm_medium=social&utm_campaign=launch` |
| Mastodon | `https://whofundsoss.com/?utm_source=mastodon&utm_medium=social&utm_campaign=launch` |
| Newsletter / DM | `https://whofundsoss.com/?utm_source=direct&utm_medium=dm&utm_campaign=launch` |

Variantes utiles :
- `utm_content=video` ou `utm_content=thread` pour comparer deux publications sur le même canal.
- `utm_campaign=monthly-nov` pour le prochain relevé.

Hacker News : certains préfèrent un lien propre. Si vous le préférez, postez `https://whofundsoss.com` et mesurez HN par le référent (`news.ycombinator.com`).

---

## 2. PostHog : ce qu'il faut pour que les UTM servent

- `posthog-js` capture seul `$pageview` et enregistre les paramètres UTM de la première visite (`$initial_utm_source`, `$initial_utm_medium`, `$initial_utm_campaign`) ainsi que ceux de chaque page vue (`utm_source`, etc.).
- Dans PostHog, une fois quelques visites reçues :
  - **Insight** « Trends » sur `$pageview`, découpé par `utm_source` (ou `$initial_utm_source` pour la source d'origine de la personne).
  - **Funnel** : `/` puis `/ranking` puis une page `/company/*`. Il montre qui cherche vraiment une entreprise.
  - **Web analytics** : l'onglet Sources donne aussi le référent brut quand il n'y a pas d'UTM.
- Pensez à tester l'installation en ouvrant le lien X avec UTM dans une fenêtre privée, puis en vérifiant que la visite apparaît dans « Live events » avec `utm_source=x`.
- Les visites avec un bloqueur de pub ne seront pas comptées. Prenez les chiffres comme un ordre de grandeur.

---

## 3. X

**Tweet (vidéo jointe)**

> I was curious who actually funds open source, and found nobody had put it in one place.
>
> So I built WhoFundsOSS: a public ranking, from dollars companies have published. If an amount is hidden, it stays at zero.
>
> $9.3M across the top 200 so far. Some of the gaps are interesting.
>
> [lien X]

Variante plus courte :

> I got curious who really funds open source, so I built a small public record of it.
>
> Only dollars companies actually published. Nothing estimated.
>
> [lien X]

**Réponse à épingler**

> How it works: once a month I collect public funding figures from four sources and rank companies by what they published. If a figure is private, the row stays at zero. Details: whofundsoss.com/method

Avant de poster : collez le lien dans le composer et vérifiez que la carte affiche bien la nouvelle image.

---

## 4. Hacker News

**Titre** (80 caractères max, sans promo)

`Show HN: WhoFundsOSS, a public ranking of who funds open source`

**URL** : lien Hacker News ci-dessus.

**Premier commentaire** (à poster tout de suite après)

> Hi HN. I got curious about which companies actually put money into open source, and couldn't find it in one place. So I built this.
>
> It reads public figures once a month from four sources: Open Collective, the Open Source Pledge, GitHub Sponsors (only when the tier amount is public) and companies' own programs. It ranks companies by what they have published.
>
> A few choices worth knowing:
> - Amounts are a floor, not a total. A company can fund a lot privately and still rank low.
> - Nothing is annualized. Open Collective totals are cumulative and labeled as such. A monthly GitHub tier is never multiplied by twelve.
> - If a tier is hidden, the row stays at zero rather than becoming a guess.
> - Obvious spam (119 companies at the last count) was removed before publishing. A further set of pages is flagged, kept out of search indexing, and listed in public with the reason: whofundsoss.com/denylist
>
> The "Mysteries" page lists companies that sponsor many maintainers on GitHub without publishing any amount. I find that part the most interesting.
>
> Method and limits: whofundsoss.com/method. Corrections welcome, here or on GitHub: https://github.com/silentdany/whofundsoss

Conseils :
- Postez en semaine, de préférence en début de journée côté États-Unis.
- Restez disponible pour répondre dans les deux premières heures.
- Ne demandez pas de votes à vos proches, HN le détecte et pénalise.

---

## 5. Reddit (`r/opensource` en premier)

Lisez d'abord les règles du subreddit (auto-promotion, jour de la semaine, format).

**Titre**

`I built a public ranking of who funds open source, using only dollars companies have published`

**Texte**

> I got curious which companies really fund open source and found no single place that shows it, so I made one.
>
> It uses four public sources (Open Collective, the Open Source Pledge, public GitHub Sponsors tiers, company programs) and updates monthly. If a company hasn't published an amount, its row stays at zero. Nothing is estimated or annualized.
>
> Right now it finds $9.3M across the top 200 companies, and it's a floor, not a total. The page I find most interesting is "Mysteries": companies that sponsor dozens of maintainers on GitHub but never show a price.
>
> Link: [lien Reddit]
>
> I'd like to know what's wrong or missing. Method: whofundsoss.com/method

---

## 6. LinkedIn

> I got curious about who really funds open source, and couldn't find a clear answer in one place.
>
> So I built WhoFundsOSS, a public ranking built only from amounts companies have published: Open Collective, the Open Source Pledge, public GitHub Sponsors tiers and their own programs. Updated monthly.
>
> Two rules I kept: nothing is annualized, and a hidden amount stays at zero instead of becoming a guess. So the numbers are a floor, not a total. $9.3M across the top 200 so far.
>
> [lien LinkedIn]

---

## 7. Mastodon

> Out of curiosity about who funds open source, I built WhoFundsOSS: a public ranking using only dollars companies have published (Open Collective, Open Source Pledge, public GitHub Sponsors tiers, company programs). Hidden amounts stay at zero. Updated monthly. [lien Mastodon]
>
> #opensource #foss

---

## 8. Objections probables et réponses courtes

**« Les chiffres sont faux ou trop bas. »**
> They're a floor: only amounts a company has published. Plenty of funding is private and isn't counted by design. If a figure is wrong, send me the source and I'll fix it.

**« Pourquoi cette entreprise est si bas ? »**
> The rank only reflects published dollars. A low rank can mean a small budget or a private one. The page for each company shows which lines have a public amount and which don't.

**« Pourquoi pas les montants GitHub Sponsors ? »**
> Most tiers aren't public, and I don't guess. They're counted only when the amount is visible. The "Mysteries" page lists companies that name many maintainers without a public amount.

**« Pourquoi du spam dans le classement ? »**
> Spam pages aren't removed from the data, but they are flagged, excluded from search indexing and listed with the reason at /denylist. If something is on that list by mistake, tell me.

**« Quelle est votre source exacte ? »**
> Four public ones, with the line-by-line detail on each company page and the method at /method. Anyone can verify a number from its source.

**« Et Supabase / d'autres cas particuliers ? »**
> Supabase appears as a backer of its own collective. I read that as money moving through its own project rather than outbound sponsoring, and kept it out until a manual review says otherwise. The reasoning is on /method.

**« Pourquoi pas telle autre source ? »**
> Happy to add public ones. Open an issue on GitHub with the source.

---

## 9. Checklist avant de poster

- [ ] Le déploiement est vert et `https://whofundsoss.com` répond.
- [ ] `SITE_URL=https://whofundsoss.com` est réglée dans Vercel (Production), sinon le sitemap et les canonicals pointent encore vers `.vercel.app`.
- [ ] `https://whofundsoss.com/robots.txt` contient `Allow: /` et le sitemap.
- [ ] `https://whofundsoss.com/og/home.jpg` s'affiche avec la nouvelle carte.
- [ ] PostHog est installé et une visite test avec `utm_source=x` apparaît dans « Live events ».
- [ ] Vous avez testé le site sur votre téléphone (classement, recherche, menu).
- [ ] La vidéo (`whofundsoss-launch-v3.mp4`) est prête.
- [ ] Vous avez le temps de répondre aux commentaires pendant 2 heures après le post.

## 10. Ordre conseillé

1. **Jour J, matin :** X (tweet + vidéo + réponse épinglée).
2. **Dans l'heure :** Hacker News (Show HN + premier commentaire).
3. **Quelques heures plus tard :** Reddit, LinkedIn, Mastodon.
4. **Le lendemain :** DM ciblés aux personnes et comptes concernés (Open Source Pledge, Open Collective, mainteneurs qui parlent de financement).

## 11. À regarder dans PostHog après 48 h

- Visites par `utm_source` : quel canal a vraiment ramené du monde.
- Pages les plus vues : si `/mysteries` ou `/graph` dépassent `/ranking`, c'est ce que les gens trouvent intéressant. À mettre en avant dans le prochain post.
- Recherches d'entreprise : combien de visiteurs arrivent sur une page `/company/*`.
- Entreprises les plus consultées : bonnes candidates pour la mise en avant du mois suivant.
- Taux de retour à J+7 : indique si le relevé mensuel suffit à les ramener.

## 12. Si ça démarre fort

- Gardez de la place pour le prochain relevé mensuel : « what changed since last month » est un deuxième post naturel.
- Les entreprises citées peuvent écrire. Répondez par la méthode et la source, jamais par un jugement.
