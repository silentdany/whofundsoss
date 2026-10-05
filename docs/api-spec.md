# WhoFundsOSS — Spec API interne

> API privée, machine-readable, pour le cas d'usage de Dany uniquement. Pas d'exposition publique dans un premier temps. Les données viennent du pipeline existant (`collect.py` → `rebuild.py` → `build_publishable.py`, cron le 1er du mois).

## 1. Vue d'ensemble

Trois couches :

1. **Sources primaires** (montants) : Open Collective (`totalAmountDonated`), Open Source Pledge (rapport annuel), GitHub Sponsors (montant mensuel si tier public), programmes propres (annonces publiques).
2. **Source secondaire** (validation croisée) : ecosyste.ms — couverture des sponsors, pas les montants. Rate limit gratuit 300 req/h ; plan Develop 200 $/mois si besoin.
3. **Couche produit** : cette API, qui transforme les CSV en endpoints.

## 2. Modèle de données

### 2.1 Entités

- **Company** : slug, nom, site, secteur (souvent non classifié), flags (`spam_*`, `supabase_self_fund`, `whale` si $ ≥ 100k).
- **Sponsorship** : company → projet OSS, source, montant USD, date de collecte.
- **Snapshot** : une collecte mensuelle complète (date, hash des CSV, compteurs).
- **Delta** : comparaison entre deux snapshots consécutifs.

### 2.2 Règles de calcul

- Montant public connu = somme par entreprise des montants publics disponibles. Jamais d'invention ni d'annualisation.
- OC : `totalAmountDonated` est cumulé historique multi-années, pas un run-rate. À afficher comme tel.
- OSP : paiement annuel du dernier rapport public (`devs × $/dev`).
- GH Sponsors : montant mensuel seulement si le tier est public (rare).
- Pas de double comptage : un même dollar ne compte pas via « own program » ET via OSP.

## 3. Endpoints

Base : `/api/v1`. Auth : clé interne (header `X-API-Key`), lecture seule.

### 3.1 Profil entreprise

`GET /companies/{slug}`

```json
{
  "slug": "posit-dev",
  "name": "Posit",
  "website": "https://posit.co",
  "sector": null,
  "flags": [],
  "totals": {
    "public_usd": 762400,
    "projects": 4,
    "by_source": {
      "oc_pledge": 762400,
      "gh_sponsors": 0,
      "osp": 0,
      "own_program": 0
    }
  },
  "transparency_score": 0.85,
  "sponsorships": [
    {"project": "...", "source": "oc_pledge", "amount_usd": 190600, "collected_at": "2026-10-05"}
  ],
  "last_collected_at": "2026-10-05"
}
```

Notes :
- `transparency_score` : voir §5.
- Les montants OC sont marqués `cumulative: true` dans la réponse.

### 3.2 Leaderboard

`GET /leaderboard?sort=public_usd|projects&limit=50&offset=0`

Retourne le top N des entreprises non exclues (spam, self-fund, whales selon le paramètre `include_whales`). Chaque entrée : rang, slug, nom, projets, public_usd, sources, delta_rank (voir §4).

### 3.3 Détail des sponsorships

`GET /companies/{slug}/sponsorships?source=oc_pledge&page=1&per_page=50`

Liste paginée des sponsorships d'une entreprise, avec projet, source, montant, date.

### 3.4 Exports

`GET /export/companies.csv` et `GET /export/sponsorships.csv` — les CSV publishables actuels, plus un `GET /export/snapshots.csv` (historique des collectes : date, hash, compteurs).

### 3.5 Santé

`GET /health` : dernière date de collecte, hash du snapshot, nombre d'entreprises, nombre de sponsorships, statut du cron.

## 4. Deltas mensuels

Chaque collecte produit un snapshot horodaté. L'API expose :

`GET /deltas?from=2026-09-01&to=2026-10-05`

```json
{
  "from": "2026-09-01", "to": "2026-10-05",
  "companies": [
    {
      "slug": "getsentry",
      "rank_before": 3, "rank_after": 2,
      "public_usd_before": 400000, "public_usd_after": 750000,
      "projects_before": 20, "projects_after": 30,
      "new_sponsorships": ["..."],
      "removed_sponsorships": [],
      "amount_changes": [{"project": "...", "delta_usd": 50000}]
    }
  ],
  "summary": {"risers": 12, "fallers": 5, "new_entrants": 3, "exits": 1}
}
```

Règles :
- Un rang qui bouge de plus de 5 positions = « mouvement notable » (utile pour le contenu X).
- Jamais de prédiction. Les deltas sont de l'observation, défendables.
- Stockage : un dossier `snapshots/` avec les CSV + un index JSON. ~200 entreprises × 12 mois = négligeable en volume.

## 5. Score de transparence

`transparency_score` ∈ [0, 1], calculé par entreprise :

```
score = 0.6 × (montant_public / max(montant_public_max, 1)) + 0.4 × (projets_avec_montant / projets_total)
```

- 0.6 sur le montant relatif (qui déclare le plus en volume).
- 0.4 sur la couverture (combien de ses sponsorships ont un montant public).
- Microsoft à 10k sur 2 projets : score élevé sur la couverture mais signalé comme « faible volume » — le score seul ne suffit pas, il faut le lire avec le total.
- À afficher sur le site avec une courte explication, sinon les gens vont le mal interpréter.

## 6. Co-sponsorships (graphe)

`GET /graph/co-sponsorships?min_shared=2&limit=50`

Retourne les paires d'entreprises qui financent les mêmes projets OSS :

```json
{
  "pairs": [
    {"a": "getsentry", "b": "coderabbitai", "shared_projects": 8, "projects": ["..."]}
  ]
}
```

Utile pour révéler les alliances et les « suiveurs ». Implémentation : index inversé projet → [entreprises], puis paires. Complexité acceptable à l'échelle actuelle (6 566 sponsorships).

## 7. Watchlist

- Stockage : fichier YAML `watchlist.yml` (slug + raison + date d'ajout), versionné dans le repo.
- `GET /watchlist` : état actuel de chaque entreprise suivie (rang, montant, projets, dernière variation).
- `GET /watchlist/alerts?since=2026-10-01` : mouvements notables depuis une date (changement de rang > 5, nouveau sponsorship, montant modifié, entreprise qui sort du top 50).
- Pas de push/webhook dans v1 : polling par Dany. Webhooks possibles plus tard si un consommateur apparaît.

## 8. Contraintes et limites

- **Pas d'API publique** : clé interne, IP non restreinte pour commencer (poste perso + poste boulot).
- **CC BY-SA 4.0** : les données ecosyste.ms sont en sharealike. Notre code est déjà public (repo `silentdany/whofundsoss`), donc couvert. Si un jour le code devient privé, il faudra une licence commerciale ecosyste.ms ou retirer cette source.
- **Pas de secrets** dans les CSV ni dans les réponses API. Les tokens de collecte vivent dans les variables d'environnement.
- **Pas de données réelles du régiment**, évidemment — le scope est 100% OSS public.
- **Pas de prédictions**, pas de scores de « fiabilité » inventés.

## 9. Plan d'implémentation (ordre suggéré)

1. **Snapshots** : modifier `build_publishable.py` pour écrire un snapshot horodaté à chaque run. ~1h de taf.
2. **Endpoint profil + leaderboard** : FastAPI ou routes Next.js API, lecture des CSV. ~1 journée.
3. **Deltas** : comparaison de deux snapshots, endpoint `/deltas`. ~½ journée.
4. **Score de transparence** : calcul dans le profil. ~1h.
5. **Co-sponsorships** : index inversé + endpoint `/graph`. ~½ journée.
6. **Watchlist** : YAML + endpoints `/watchlist` et `/watchlist/alerts`. ~½ journée.
7. **Auth par clé** : middleware simple. ~1h.

Total estimé : ~4-5 jours de taf répartis. Rien d'urgent, le site actuel tourne déjà.

## 10. Hors scope (volontairement)

- API publique avec rate limiting commercial.
- Prédictions de financement.
- Intégration ecosyste.ms en temps réel (rester sur le cron mensuel).
- Dashboards graphiques (c'est le site qui fait ça).
