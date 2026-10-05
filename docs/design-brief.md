# WhoFundsOSS — Design Brief

> Direction validée avec Dany le 2026-10-05. Référence principale : **Attio** (attio.com). À coller dans Grok Build en complément du giga prompt `/goal`.

## Direction générale

- **Thème clair par défaut** : fond blanc cassé / crème, jamais de dark-first. Le dark mode est optionnel et secondaire.
- **Aérien et soft** : beaucoup d'espace blanc, hiérarchie par le poids de la typo et l'espacement, pas par les bordures, ombres lourdes ou couleurs criardes.
- **Pas de terminal de geek** : aucun monospace, aucun fond noir, aucune grille de cards colorées type Bootstrap.
- **Pas de scroll-jacking** : le scroll reste natif, la page avance au rythme de l'utilisateur. Aucun effet qui retient le scroll.
- **Pas de générique SaaS** : pas de grille de widgets, pas de mur de charts. L'accueil raconte le mois.

## Tokens

```css
:root {
  /* Fonds */
  --bg: #faf9f7;            /* crème très léger, pas blanc pur */
  --bg-elevated: #ffffff;   /* surfaces (cartes, tableaux) */
  --bg-subtle: #f3f1ee;     /* hover, zones secondaires */

  /* Texte */
  --text: #1a1a1a;          /* quasi-noir, contraste net */
  --text-secondary: #6b6b6b;/* gris moyen pour le secondaire */
  --text-muted: #9a9a9a;    /* labels, dates, métadonnées */

  /* Accent (UNE seule couleur, réservée au sens) */
  --accent: #3d7a6a;        /* vert sauge doux */
  --accent-soft: #e8f2ef;   /* fond léger pour badges positifs */
  --rise: #2f7d4f;          /* hausses de rang / montants ↑ */
  --fall: #b85c38;          /* baisses de rang / montants ↓ */
  --warning: #c4922a;       /* alertes, incohérences (page mystères) */

  /* Bordures et ombres (minimales) */
  --border: #e8e6e3;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --radius: 8px;
}
```

Règles :
- L'accent ne sert QUE pour les éléments interactifs importants (CTA, liens actifs) et les badges de sens (hausse/baisse). Jamais en décoration.
- Les couleurs rouge/vert ne servent qu'à communiquer un mouvement (rang, montant), jamais à décorer.
- Une seule famille de police pour les titres, une autre pour le corps. Pas de mélange de 4 polices.

## Typographie

- **Titres** : une serif élégante (ex. `Fraunces`, `Newsreader`, ou `Source Serif 4` via next/font). Poids 500-600, tracking légèrement négatif sur les gros titres.
- **Corps** : sans-serif géométrique (ex. `Geist` déjà présent, ou `Satoshi` / `Manrope`). Poids 400, line-height 1.6.
- **Échelle** : 14 / 16 / 20 / 28 / 40 / 56 px. Espacement vertical généreux entre sections (80-120px).
- **Chiffres** : tabular-nums partout (montants, rangs) pour l'alignement.

## Structure des pages

### Accueil — le brief du mois (pattern Attio)

L'accueil n'est PAS un tableau. C'est une page éditoriale :

1. **Hero minimal** : titre serif + une phrase. Pas de stats wall, pas de hero image.
2. **Le brief** : 3-5 lignes courtes et classées de ce qui a changé ce mois-ci, tirées des deltas. Exemple :
   > Sentry a doublé ses projets sponsorisés. Microsoft reste à 10 k$ publics. Trois boîtes ont quitté le top 50.
   Chaque ligne est cliquable vers le détail.
3. **Le top 10** : tableau léger (pas de cards), rang + nom + montant + delta. Le reste du top 50 accessible via un lien « voir tout ».
4. **Sources** : petits badges discrets (OC, OSP, GH Sponsors, programme propre) avec compteurs.

### Page entreprise

- Header : nom, site, secteur, score de transparence (avec le total à côté, jamais seul).
- Répartition par source en barres horizontales douces (pas de camemberts 3D).
- Liste des sponsorships en tableau léger avec filtres par source.
- Historique des mouvements (deltas) si disponible.

### Page mouvements (/mouvements)

- Timeline éditoriale des deltas : qui monte, qui descend, qui entre, qui sort.
- Chaque entrée : rang avant → rang après, montant, projets, avec couleurs rise/fall.
- Filtre par période.

### Page graphe (/graphe)

- Réseau de co-sponsorships en force-directed layout (D3 ou équivalent léger).
- Nœuds = entreprises, arêtes = projets partagés. Hover = highlight du cluster.
- C'est la page la plus visuelle du site : elle doit être screenshotable.

### Page mystères (/mysteres)

- Incohérences : boîtes avec argent déclaré mais 0 projet sponsorisé (Zerodha, HeroDevs), montants qui bougent bizarrement.
- Ton factuel, pas accusateur. Chaque entrée propose une explication possible.

## Anti-patterns (strictement interdits)

- Scroll-jacking, parallax agressif, animations qui bloquent le scroll.
- Dark mode par défaut, fonds noirs, texte blanc sur noir.
- Grille de cards colorées, icônes géantes au-dessus de chaque titre.
- Polices Inter / Roboto / Arial / Open Sans (trop vues).
- Monospace utilisé comme décoration « tech ».
- Charts 3D, camemberts, gauges.
- Mots-clés IA génériques dans le copy ("unlock", "supercharge", "seamless").
- Bordures épaisses, ombres portées lourdes, gradients arc-en-ciel.

## Références à matcher (screenshots dans /docs/references/)

- **Attio** (attio.com) : référence principale. Espacement, typo, hiérarchie, le pattern "brief" à la place des dashboards.
- **Plausible** (plausible.io) : le one-page propre, six chiffres + un chart, rien en tabs. (Attention : pas trop générique, garder l'aspect éditorial.)
- **Mercury** (mercury.com) : la confiance soft, mais SANS le scroll-jacking.

## Implémentation

1. Mettre à jour `src/app/globals.css` avec les tokens ci-dessus.
2. Changer la font dans `layout.tsx` : serif pour titres (next/font/google), garder Geist ou passer à Manrope pour le corps.
3. Refondre `src/app/page.tsx` selon la structure "brief du mois" ci-dessus.
4. Les nouveaux tokens doivent être utilisés partout (composants dans `src/components/`), pas de hex en dur dans les composants.
5. Vérifier le responsive : mobile = brief condensé + tableau scrollable, pas de réorganisation complète.
6. Pas de nouvelles dépendances lourdes. Si un chart est nécessaire (graphe), privilégier une lib légère type `d3-force` ou un SVG custom.
