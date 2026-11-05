# Crunchyroll Best Watchlist

Extension Manifest V3 pour Chromium, Chrome et Edge. La version de développement
**0.5.9** organise la watchlist directement dans Crunchyroll, sous les onglets
Watchlist / Crunchylists / Historique. La liste native reste accessible dessous.

Extension non officielle, sans affiliation à Crunchyroll. La publication sur le
Chrome Web Store reste à préparer.

## Installation locale sur Chromium / CachyOS

1. Ouvrir `chrome://extensions` et activer **Mode développeur**.
2. Cliquer sur **Charger l’extension non empaquetée**.
3. Sélectionner le dossier `extension/` de ce dépôt, contenant `manifest.json`.
4. Se connecter à Crunchyroll et ouvrir `https://www.crunchyroll.com/fr/watchlist`.
5. Recharger la page pour démarrer l’observation de session avant les requêtes du site.

Aucune compilation, installation npm ou clé d’empaquetage nécessaire. Après une
modification, actualiser la carte de l’extension puis recharger Crunchyroll.
Sur Edge, utiliser `edge://extensions`.

L’interface est en anglais par défaut. **Settings → Extension language** propose
English, Français et 日本語 ; ce choix est indépendant de l’audio et des sous-titres.

## Utilisation

- **À regarder**, **À commencer**, **À jour** organisent les séries par progression.
  « À jour » ne signifie pas que la série est terminée.
- **Doublage en attente**, **Sous-titres en attente**, **Cette semaine**, **Masqués**
  et **Erreurs** apparaissent automatiquement lorsqu’ils contiennent des séries.
- **Visionnées récemment** couvre les 30 derniers jours. Les cartes indiquent le
  dernier visionnage connu, avec sa date exacte au survol.
- Chaque liste propose **Tous / Favoris uniquement**, **Favoris en premier** et
  un tri décroissant par dernière sortie, note ou dernier visionnage. Les valeurs
  inconnues restent en bas de leur groupe. Les choix sont conservés par liste/profil.
- Le filtre de visionnage propose tous, 24 heures, 7 jours et 30 jours. Ce filtre
  et le tri de visionnage sont absents de **À commencer**.
- La recherche à droite des filtres porte sur la liste ouverte ; l’onglet Recherche
  porte sur la watchlist entière. Les recherches ignorent casse et accents.
- L’image et le lien **Commencer EP1 / Continuer EP 187** lancent l’épisode identifié.
  Le titre ouvre la série. Sans cible fiable, l’image ouvre aussi la série.
- La note **★ 4.7** apparaît dans l’image. Le cœur en haut à droite modifie les
  favoris Crunchyroll ; le retrait demande confirmation.
- L’œil en bas à droite masque la série uniquement dans notre panneau, après
  confirmation. Dans **Masqués**, l’œil barré ou **Tout restaurer** annule ce choix.
- La roue ouvre les préférences audio par série. Les menus restent dans les cartes.
- **Replier les vignettes** réduit le panneau pour accéder à la liste native.
- Le résumé général de la série est chargé au survol/focus dans une infobulle.
  Les descriptions d’épisodes ne sont jamais utilisées en repli.

## Préférences audio

Les paramètres proposent deux langues ordonnées : **Langue audio préférée**, puis
**Langue audio secondaire**. Les deux listes contiennent les langues usuelles du
catalogue et les langues supplémentaires détectées dans la watchlist.

L’analyse choisit la première langue disponible pour chaque épisode, sinon la
seconde. Si aucune n’est disponible, l’épisode sorti reste en attente de doublage.
Il n’existe aucun repli automatique vers une troisième langue. La version originale
est retenue seulement si sa langue fait partie des préférences ; les sous-titres
choisis sont alors vérifiés. Une piste audio identique à la langue des sous-titres
ne nécessite pas une piste de sous-titres supplémentaire.

La roue de chaque carte permet des exceptions aux préférences globales. Changer
les préférences audio invalide le cache d’analyse correspondant.

## Analyse, cache et session

La première analyse affiche des cartes de chargement puis des résultats progressifs.
Deux séries sont traitées simultanément, avec une limite de 60 secondes par série.
La lecture initiale de la watchlist et de l’historique partage un budget de 45 secondes.
L’historique est limité à 1 000 entrées ; les démarrages de moins de 60 secondes
non terminés sont ignorés. Une réponse partielle ou indisponible est signalée.
Une date manquante ne signifie pas qu’une série n’a jamais été regardée.

Les résultats sont sauvegardés au premier résultat, puis tous les dix résultats
et à la fin. Le cache local est isolé par compte/profil et préférences audio.
Les séries analysées depuis moins de cinq minutes sont réutilisées ; les autres
sont recalculées. Les instantanés de plus de sept jours sont ignorés.

Avec un cache, les cartes restent affichées pendant l’analyse et sont actualisées
à la fin. Une vérification automatique a lieu toutes les cinq minutes tant que la
watchlist est ouverte. Fermer ou quitter la watchlist interrompt le travail ; les
points de sauvegarde permettent de reprendre à la prochaine ouverture.

**Actualiser** force une analyse complète. Le bouton est masqué pendant l’analyse,
puis désactivé avec un décompte de 30 secondes avant une nouvelle demande manuelle.
Le renouvellement d’une session expirée est tenté automatiquement ; en cas d’échec,
les cartes sont conservées et l’analyse se met en pause. Un changement de profil
invalide l’affichage des données du profil précédent. Après déconnexion, recharger
l’onglet pour effacer immédiatement les données affichées.

## Développement et vérifications

```text
extension/                 Sources communes et manifeste MV3 de base
  src/                     Interface, règles, langues, session, stockage
  vendor/                  Moteur Watchroll et licence MIT
browsers/chromium/         Différences propres à Chromium / Chrome / Edge
browsers/firefox/          Différences Firefox (portage à valider)
dist/chromium/             Extension Chromium générée (ignorée)
dist/firefox/              Extension Firefox générée (ignorée)
tests/                     Scénarios communs et contrôles d'empaquetage
tools/build.py             Construction isolée des deux cibles
tools/package.py           ZIP reproductibles par cible/version
docs/browser-validation.md Matrice des essais réels
```

Les frontières et règles de contribution sont dans [browsers/README.md](browsers/README.md).
L'installation Chromium existante depuis `extension/` reste possible. Firefox est
une cible de développement non encore validée, pas une version publiée.

Depuis la racine du dépôt, avec Python 3 et Chromium installés :

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
python3 tools/check.py
python3 tools/build.py --target all
python3 tools/package.py --target all
git diff --check
```

Les tests utilisent un serveur local et un profil Chromium temporaire, sans
accéder au profil habituel ni modifier un compte réel. Ils vérifient notamment
classement, langues audio, cache, expiration de session, favoris, traductions,
focus des contrôles, disposition responsive et cycle de montage du panneau.
Les essais sur compte réel et sur Chrome/Edge restent nécessaires avant publication.

## Diagnostic et limites

Épingler l’extension depuis le menu puzzle puis ouvrir son icône. Le volet
**Diagnostic de position** fournit dimensions/styles du panneau, état du cache et
progression, sans jeton ni contenu du compte. Les erreurs sont aussi accessibles
sur la carte de l’extension dans `chrome://extensions` et dans **F12 → Console**.

L’API Crunchyroll est non documentée. La disponibilité des langues dépend des titres
et régions. Le moteur examine un nombre borné de saisons ; les métadonnées absentes,
séries atypiques et évolutions du site peuvent nécessiter une adaptation. Le
calendrier couvre les sept prochains jours et marque les estimations par `~`.

Seuls `crunchyroll.com` et ses sous-domaines sont déclarés. Les chemins localisés
sur `.com` sont pris en charge. Il n’y a pas de notifications, de recherche dans
le catalogue entier ni de synchronisation entre appareils.

## Confidentialité et attribution

La permission `storage` conserve localement les préférences, séries masquées,
instantanés de progression et résumés. Les jetons restent en mémoire dans l’onglet.
Les requêtes utilisent la session existante ; seules les actions explicites sur
les cœurs écrivent dans les favoris du compte. Aucun service tiers ni télémétrie
n’est ajouté. Les images HTTPS du catalogue et les services propres au site
Crunchyroll restent chargés par leur fonctionnement habituel.

Le moteur Watchroll est redistribué avec sa licence MIT et ses modifications
locales documentées dans `extension/THIRD_PARTY.md`.

## Signaler un problème

Dans **Paramètres** ou la popup, ouvrir **Signaler un problème**. Le rapport est
préparé localement, lisible et modifiable avant partage. Les options sont désactivées
par défaut : exemple structurel anonymisé, ou watchlist (titres, identifiants publics,
favoris, masquage, langues et progression disponible). Les options sélectionnées
apparaissent dans l’aperçu. Les jetons, cookies, login, e-mail, identifiants de compte,
recherches, URL privées et erreurs/API brutes ne sont pas exportés automatiquement.
Aucun journal de navigation n’est collecté.

**Copier le rapport chiffré** compresse puis chiffre exactement l’aperçu modifié.
Chaque rapport utilise une nouvelle clé AES-256-GCM, protégée par la clé publique
RSA-OAEP SHA-256 du mainteneur. Le format `BWL2:` contient un identifiant de clé
et le contenu chiffré/authentifié. La clé privée reste dans le dépôt privé local,
jamais dans l’extension ou les ZIP. Un rapport altéré est rejeté au déchiffrement.
L’extension ne contacte aucun serveur pour chiffrer ; aucun envoi n’est automatique.

La copie lisible reste un choix explicite distinct. En cas d’échec de copie, le rapport
chiffré est affiché et sélectionné pour copie manuelle ; un échec de chiffrement ne
provoque jamais de copie automatique en clair. Maximum : 2 Mo avant compression.
Le déchiffreur et son mode d’emploi sont conservés uniquement dans le dépôt privé
sous `private-reports/`. Garder les anciennes clés pour les rapports des anciennes versions.
Le décodeur public `tools/decode_report.py` reste réservé aux anciens rapports
`BWL1:GZIP:` non chiffrés, et ne peut pas lire un rapport `BWL2:`.

Le lien GitHub ouvre le formulaire sans joindre de rapport. Coller celui-ci manuellement
et compléter les étapes et le résultat attendu. La watchlist exportée contient les résultats
déjà analysés, potentiellement partiels ; elle n’inclut pas les réponses API complètes
et ne garantit donc pas la reproduction exacte d’un bug.
