# Variantes navigateur

`extension/` contient les sources communes et le manifeste MV3 de base.
Il reste chargeable directement dans Chromium pour préserver les installations locales.
`browsers/<cible>/manifest.json` contient seulement les différences de manifeste.
Les objets sont fusionnés récursivement ; les tableaux sont remplacés entièrement.
Une modification du tableau des scripts doit donc conserver explicitement leur ordre.

Les adaptations futures vont dans `browsers/<cible>/files/`, sous des chemins propres
(ex. `platform/firefox.js`). Un fichier spécifique ne peut pas écraser un fichier commun.
Le manifeste de la cible doit référencer explicitement les scripts supplémentaires.
Ne pas copier les modules métier dans chaque variante ni multiplier les tests de navigateur
dispersés dans le code commun. Introduire un petit adaptateur si nécessaire.

Génération : `python3 tools/build.py --target all`.
Archives : `python3 tools/package.py --target all`.
Cibles disponibles : `chromium`, `firefox`, `all` (défaut).
Sorties séparées dans `dist/chromium/`, `dist/firefox/` et deux ZIP nommés par cible/version.
Ces sorties sont ignorées, remplaçables, et ne doivent jamais être éditées à la main.
Le script de construction utilise une liste explicite de ressources autorisées.
Les archives Firefox sont des candidats de test, pas des extensions signées.

## Statut

- Chromium / Chrome / Edge : comportement existant conservé ; tests synthétiques Chromium.
- Firefox : structure et manifeste de développement préparés, compatibilité fonctionnelle
  non validée. Minimum provisoire Firefox 140 ; à réévaluer avec les tests du pont de session.
  L'identifiant Gecko est réservé dans ce dépôt ; le conserver après première distribution.
- Avant publication Mozilla : traiter `browser` natif vs adaptateur Watchroll,
  le passage des événements entre mondes, la session et les appels API ; vérifier aussi les
  déclarations de données Mozilla. Aucune déclaration « aucune donnée » n'est présumée ici.

## Vérifications avant validation

1. `python3 -m unittest discover -s tests -p 'test_*.py'` : isolation et ZIP reproductibles.
2. `python3 tools/check.py` : les deux manifestes et les scénarios communs sous Chromium.
3. `git diff --check`.
4. Suivre `docs/browser-validation.md` pour les essais réels ; les tests Chromium ne
   prouvent pas la compatibilité Firefox.
