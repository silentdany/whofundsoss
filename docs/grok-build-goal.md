# WhoFundsOSS — Grok Build `/goal`

> Prompt à coller dans Grok Build en mode `/goal`, en partant du repo existant `silentdany/whofundsoss` (Next.js, site déjà déployé sur Vercel, données dans `src/data/*.json`).

---

## Contexte

WhoFundsOSS est un site qui classe les entreprises qui financent l'open source : qui paie vraiment, combien, et via quelles sources. Le site actuel affiche un top 50 par dollars et par bénéficiaires GitHub, des fiches entreprises, une page méthodo, et des featured slots sponsorisés.

**Données actuelles (collecte 2026-10-05) :**
- 963 entreprises, 6 566 sponsorships
- 9,3 M$ publics déclarés
- Sources : Open Collective (`totalAmountDonated`, cumulé multi-années), Open Source Pledge (annuel, `devs × $/dev`), GitHub Sponsors (montant mensuel seulement si tier public — rare), programmes propres (annonces publiques)
- Exclusions : 119 spam (casino/VPN/followers/SEO, 643 728 $), 1 self-fund (Supabase, 1 097 800 $)
- Pipeline : `collect.py` → `rebuild.py` → `build_publishable.py` (cron le 1er du mois), scripts dans `/workspace/recherche/`, pas dans le repo
- Les CSV bruts vivent dans `/workspace/recherche/`, le repo ne contient que le site et les JSON publishables

**Limites assumées (à garder visibles partout) :**
- Montants OC = cumulés historiques, pas un run-rate
- Tiers GitHub Sponsors souvent non publics → pas d'invention, pas d'annualisation
- Sponsorships privés invisibles
- Le total public est un **plancher**, pas la vérité

**Concurrence :** ecosyste.ms (15 M packages, 190 k sponsors GH, API CC BY-SA 4.0, rate limit gratuit 300 req/h) — base de données brute sans produit. BackYourStack → devenu Ecosystem Funds. Personne ne fait de classement public des financeurs avec montants.

---

## Objectif

Transformer WhoFundsOSS d'un classement figé en un **produit de suivi** : une API interne machine-readable, des snapshots mensuels, des deltas, un score de transparence, une watchlist, et des pages nouvelles. Monétisation future via audits (490-990 $) vendus aux fondations et mid-market, featured slots pour les gagnants. Trafic via naming and shaming sur X (compte MajorBaguette) et citations par fondations/journalistes.

---

## Phase 1 — Snapshots (fondation de tout)

1. Modifier `build_publishable.py` pour écrire un snapshot horodaté à chaque run : dossier `snapshots/YYYY-MM-DD/` contenant les CSV + un `index.json` (date, hash SHA-256 des CSV, compteurs : entreprises, sponsorships, total $).
2. Le cron mensuel (1er du mois) chaîne `rebuild` puis `build_publishable.py` comme aujourd'hui — rien ne change côté collecte.
3. Ajouter `GET /api/health` : dernière date de collecte, hash du snapshot, compteurs, statut du cron.
4. **Règle d'or** : chaque collecte doit être reproductible — mêmes inputs, mêmes outputs, hash vérifiable. Si quelqu'un relance et obtient les mêmes chiffres, c'est une preuve, pas une affirmation.

## Phase 2 — API interne

API privée, lecture seule, auth par clé (`X-API-Key`), base `/api/v1`. Pas d'exposition publique.

- `GET /companies/{slug}` : profil complet (nom, site, secteur, flags, totaux par source, score de transparence, liste des sponsorships, date de collecte). Les montants OC sont marqués `cumulative: true`.
- `GET /leaderboard?sort=public_usd|projects&limit=50&offset=0&include_whales=false` : top N non exclus.
- `GET /companies/{slug}/sponsorships?source=&page=&per_page=50` : liste paginée.
- `GET /export/companies.csv`, `/export/sponsorships.csv`, `/export/snapshots.csv`.
- `GET /deltas?from=&to=` : comparaison entre deux snapshots (voir Phase 3).
- `GET /graph/co-sponsorships?min_shared=2&limit=50` : paires d'entreprises partageant des projets (voir Phase 5).
- `GET /watchlist`, `GET /watchlist/alerts?since=` (voir Phase 4).

Implémentation : FastAPI ou routes Next.js API lisant les CSV/JSON. ~4-5 jours de taf répartis, rien d'urgent.

## Phase 3 — Deltas mensuels

- Chaque collecte produit un snapshot ; l'API compare deux snapshots consécutifs.
- Réponse : rang avant/après, montant avant/après, projets avant/après, nouveaux sponsorships, sponsorships retirés, changements de montant, résumé (risers, fallers, entrants, sortants).
- Un rang qui bouge de plus de 5 positions = « mouvement notable » (contenu X tout fait).
- **Jamais de prédictions** — les deltas sont de l'observation, défendables. Une prédiction ratée tue la crédibilité.
- Stockage : `snapshots/` + index JSON. 200 entreprises × 12 mois = négligeable.

## Phase 4 — Score de transparence + watchlist

**Score de transparence** (par entreprise, ∈ [0, 1]) :
```
score = 0.6 × (montant_public / max(montant_public_max, 1)) + 0.4 × (projets_avec_montant / projets_total)
```
- 60% montant relatif, 40% couverture (combien de sponsorships ont un montant public).
- Microsoft à 10 k$ sur 2 projets : score élevé sur la couverture mais « faible volume » — le score doit toujours s'afficher avec le total à côté, sinon les gens le lisent mal.
- Page méthodo : expliquer le calcul en une phrase.

**Watchlist** :
- Fichier YAML `watchlist.yml` versionné (slug + raison + date d'ajout).
- `GET /watchlist` : rang, montant, projets, dernière variation par entreprise suivie.
- `GET /watchlist/alerts?since=` : mouvements notables (rang > 5, nouveau sponsorship, montant modifié, sortie du top 50).
- v1 = polling, pas de webhooks.

## Phase 5 — Co-sponsorships (graphe)

- Index inversé projet → [entreprises], puis paires.
- `GET /graph/co-sponsorships?min_shared=2` : paires + projets partagés.
- Révèle les alliances et les « suiveurs ». Complexité acceptable à l'échelle actuelle.

## Phase 6 — Pages site

- **/mouvements** : deltas du mois — qui monte, qui descend, qui entre, qui sort. Page la plus vivante, raison de revenir chaque mois.
- **/watchlist** : état des entreprises suivies + alertes.
- **/graphe** : réseau de co-sponsorships, visualisé. Le truc le plus screenshotable du site.
- Filtres par source (OC / OSP / GH Sponsors / programme propre) sur les classements.
- Toggle « public only » assumé avec disclaimer existant.
- Score de transparence sur chaque fiche entreprise, avec le total à côté.
- Page **/mysteres** : incohérences (boîtes avec argent déclaré mais 0 projet sponsorisé — ex. Zerodha, HeroDevs). Les boîtes viennent corriger gratuitement = contenu + crédibilité.

## Phase 7 — Crawl quotidien léger (optionnel)

- Crawl quotidien sur le top 50 + watchlist seulement ; crawl complet mensuel pour tout le monde.
- Les sources bougent pas tous les jours (OC cumulé, OSP annuel) → le quotidien sert à détecter les bugs de collecte, pas à avoir des chiffres frais.
- **Test de régression** : snapshot de référence versionné, chaque nouvelle collecte comparée. Si sentry passe de 30 à 3 projets d'un coup → bug, pas désengagement. Détecter avant de publier.

## Phase 8 — Serveur MCP (paresse assumée)

- Serveur MCP exposant les endpoints de l'API interne (leaderboard, deltas, watchlist, profils).
- Usage : demander à Grok/Claude « donne-moi les 3 mouvements notables du mois » → thread X en 30 secondes.
- **Règle critique** : le MCP doit renvoyer les chiffres avec leur date de collecte. Sinon l'IA invente des montants → diffamation au lieu de naming and shaming.
- Le bot X autonome qui poste tout seul = gadget + risque de suspension. Le MCP + humain qui choisit = le move.

## Hors scope (volontairement)

- API publique avec rate limiting commercial.
- Prédictions de financement, scores de « fiabilité » inventés.
- Intégration ecosyste.ms temps réel (rester sur le cron mensuel).
- Dashboards graphiques avancés (le site fait ça).
- Migration base de données : **les CSV suffisent pour le MVP**. Migrer seulement quand les deltas prendront 10 secondes à calculer ou que les snapshots quotidiens feront mal. Migrer trop tôt = 3 semaines perdues pour 200 lignes.

## Contraintes légales / licences

- **CC BY-SA 4.0** : données ecosyste.ms en sharealike. Le code est déjà public → couvert. Si le code devient privé un jour : licence commerciale ecosyste.ms ou retrait de la source.
- **Pas de secrets** dans les CSV ni les réponses API. Tokens de collecte = variables d'environnement.
- **Process de correction documenté** : qui a demandé quoi, quand, ce qui a changé. Une boîte qui conteste un montant doit avoir une trace. Sinon un procès tue le site.
- Scope 100% OSS public. Jamais de données du régiment.

## Monétisation (futur, pas maintenant)

- **Audits 490-990 $** : vendus aux fondations et mid-market. C'est le produit, pas l'API.
- **Featured slots 199-399 $** : badge de fierté pour les gagnants (sentry veut être vue), pas de la pub.
- Les perdants paient pour disparaître, les gagnants paient pour être vus — les deux sont des clients.
- Contacte les boîtes AVANT de publier : « vous êtes en tête, voulez-vous vérifier vos chiffres ? » → procès évité, corrections gratuites, crédibilité renforcée.

## Marketing

- **Naming and shaming sur X** : un thread par mois avec les deltas. « Microsoft finance l'OSS à la petite semaine » = post tout fait. Les boîtes réagissent toutes seules = viralité inversée.
- **Journalistes** : un classement public avec chiffres vérifiables = article gratuit sur le greenwashing OSS. Un seul article > 6 mois de posts.
- **Fondations** : si Linux Foundation / Open Source Collective citent le site dans leurs rapports = crédibilité institutionnelle.
- Trafic = condition sine qua non. Sans trafic, le naming and shaming ne marche pas.

## Ordre d'implémentation suggéré

1. Snapshots (1h) — sans ça, rien d'autre ne marche
2. API profil + leaderboard (1 jour)
3. Deltas (½ jour)
4. Score de transparence (1h)
5. Co-sponsorships (½ jour)
6. Watchlist (½ jour)
7. Auth par clé (1h)
8. Pages site (mouvements, graphe, mystères)
9. MCP
10. Crawl quotidien léger + tests de régression

Total : ~4-5 jours de taf répartis sur le repo existant. Le site actuel tourne déjà — c'est de l'ajout, pas une refonte.
