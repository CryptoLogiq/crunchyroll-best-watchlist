# Validation des navigateurs

Version candidate : 0.5.7. Aucun identifiant de compte ou jeton dans les relevés.

| Contrôle | Chromium | Chrome | Edge | Firefox |
| --- | --- | --- | --- | --- |
| Manifeste et ressources (automatique) | Réussi | Même paquet | Même paquet | Réussi |
| Scénarios communs synthétiques | 22 scénarios réussis | Non exécuté | Non exécuté | Non exécuté |
| Installation / panneau sur compte réel | Retours utilisateur positifs | À consigner | Non exécuté | Non exécuté |
| Session expirée / reconnexion / profil | À consigner | À consigner | Non exécuté | Non exécuté |
| Audio, sous-titres, progression, lecture | À consigner | À consigner | Non exécuté | Non exécuté |
| Cache après fermeture / réouverture | À consigner | À consigner | Non exécuté | Non exécuté |
| Favori, confirmation retrait, masquage | À consigner | À consigner | Non exécuté | Non exécuté |
| Clavier, recherche, filtres, responsive | À consigner | À consigner | Non exécuté | Non exécuté |

Pour chaque essai, relever version du navigateur, système, version de l'extension,
résultat et limite éventuelle. Ne pas cocher un navigateur sur la seule base d'un autre.

## Installation de test

- Chromium / Chrome : dossier `extension/` actuel ou dossier généré `dist/chromium/`
  via `chrome://extensions`. Garder un seul exemplaire actif ; changer de chemin peut
  changer l'identifiant et donc les données locales de développement.
- Edge : `edge://extensions`, sélectionner `dist/chromium/`.
- Firefox : après `python3 tools/build.py --target firefox`, ouvrir
  `about:debugging#/runtime/this-firefox`, charger un module temporaire et choisir
  `dist/firefox/manifest.json`. Installation de développement temporaire ; ne pas
  confondre avec la distribution signée sur Firefox Add-ons.
