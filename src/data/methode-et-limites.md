# WhoFundsOSS — Méthode et limites

**Date de fraîcheur :** 2026-10-05 (Europe/Paris)  
**Périmètre :** entreprises qui financent de l'open source via GitHub Sponsors, Open Collective, Open Source Pledge ou un programme propre documenté.  
**Script :** `build_publishable.py` (reproductible).

## Comment sont construits les classements

1. **Base brute** : `/workspace/recherche/sponsor-apps-base-github-entreprises.csv` (963 entreprises) et `sponsor-apps-base-github.csv` (6566 sponsorings), collectés le 2026-10-05 (voir `/workspace/recherche/sponsor-apps-base-github.md`).
2. **Total public connu (USD)** = somme, pour chaque entreprise, des montants **déjà publics** dans la base :
   - Open Collective : `totalAmountDonated` (cumul historique, souvent multi-années) ;
   - Open Source Pledge : paiement annuel du dernier rapport public (`devs × $/dev`) ;
   - GitHub Sponsors : montant mensuel **uniquement** si le tier est exposé publiquement (cas rare) ;
   - programmes propres : montants annoncés sur des pages publiques.
3. **Top 50 par dollars** : entreprises **non exclues**, tri `total_public_connu_usd` décroissant.
4. **Top 50 par bénéficiaires GitHub** : mêmes entreprises, tri `nb_beneficiaires_github` décroissant.
5. **Marques intermédiaires (audits)** : Priorité 1 Business — `(10 000 ≤ $ publics < 100 000) OU (3 ≤ bénéficiaires GH ≤ 12)`, **hors** baleines (`$ ≥ 100 000`), hors spam, hors Supabase self-fund.

## Ce qui a été filtré (exclusions)

| Raison | Entreprises | $ publics concernés |
|---|---|---|
| `supabase_self_fund` | 1 | 1,097,800 |
| `spam_casino` | 85 | (inclus spam ci-dessous) |
| `spam_vpn` | 4 | |
| `spam_followers` | 28 | |
| `spam_seo` | 2 | |
| **Spam total** | **119** (12.4 %) | **643,728** |
| **Total exclus des tops** | **120** | — |

Les entreprises exclues restent dans `dump-public-entreprises.csv` / `dump-public-sponsorings.csv` avec la colonne `exclusion_raison`, et dans `raw-exclusions.csv`. Elles sont **absentes** des top 50 et de `marques-intermediaires-audit.*`.

### Cas Supabase

L'org `supabase` apparaît comme BACKER actif du collective [opencollective.com/supabase](https://opencollective.com/supabase) avec `totalAmountDonated = 1 097 800` (dernière tx 150 000 $, janv. 2026). Lecture Recherche : fonds transitant par le programme OC du projet, **pas** du sponsoring sortant classique. Flag `supabase_self_fund` ; exclu des classements publics jusqu'à vérification manuelle.

### Regex spam (règles)

Appliquées sur `entreprise + login_github + site + secteur` (pas sur le champ `source`) :

- **spam_casino** : `casino|gambling|betting|poker|roulette|slots?|jackpot|stake|gambl|bingo|bookmaker|…`
- **spam_vpn** : `\bvpn\b|proxy.?service|nordvpn|expressvpn|surfshark|veepn|…`
- **spam_followers** : `buy.?followers|buy.?likes|buy.?views|twicsy|buzzoid|goread\.io|…`
- **spam_seo** : `seo.?service|link.?building|buy.?backlinks|buy.?youtube.?views|…`

Liste d'allowlist (jamais flaggés) : getsentry, stripe, vercel, github, microsoft, shopify, cloudflare, automattic, laravel, posthog, supabase, coderabbitai, sanity-io, muxinc, railway, get-convex.

Repérage Business d'origine : ≈ 130–140 entrées, ≈ 0,64 M$ (**hypothèse / calcul grossier**). Ici : **119** entreprises, **643,728 $** — écart dû à l'affinage des regex le 2026-10-05 ; documenté, pas inventé.

## Limites des montants (à afficher sur la page)

- **GitHub Sponsors** : les montants mensuels sont très souvent **non publics**. La base montre *qui* est financé, rarement *combien*. **Aucun montant mensuel GH n'est inventé ni annualisé.**
- **Open Collective** : `totalAmountDonated` = **cumul historique**, pas un run-rate mensuel. Des backers one-shot anciens (`isActive=false`) restent dans le dump détail.
- **Open Source Pledge** : montant **annuel** du dernier rapport public (ex. Sentry 132 × 5 682 = 750 000 $).
- Un même dollar OSP n'est pas recompté via « programme propre ».
- Les sponsoring GitHub **privés** n'apparaissent pas du tout.
- Secteur non classé pour la majorité des entreprises ; page contact connue pour une minorité seulement (voir base brute).

## Comptage marques intermédiaires

- Critères bruts sans filtre : **189** (cible Business ≈ 189).
- Après exclusion spam + Supabase + baleines (`$ ≥ 100 k`) : **172**.
- Répartition `segment_critere` : {'dollars': 133, 'both': 6, 'beneficiaires': 33}.

Écart vs 189 = filtrage spam / self-fund / baleines, **pas** un changement de définition.

## Régénération

```bash
# 1) (optionnel) recolleter
cd /workspace/recherche/github_sponsors && python3 -u collect.py   # long
python3 -u rebuild.py

# 2) reconstruire les fichiers publiables
cd /workspace/recherche/whofundsoss && python3 -u build_publishable.py
```

La collecte mensuelle (cron 1er du mois) doit enchaîner `rebuild` puis `build_publishable.py`.
