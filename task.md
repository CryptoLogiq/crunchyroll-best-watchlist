# Tâches du projet

Ce fichier dirige le plan de travail de l'agent. Traiter les tâches ouvertes par priorité : **P0**, puis **P1**, puis **P2**. À priorité égale, suivre l'ordre de la liste, en respectant les dépendances indiquées.

- **P0** : urgent ou bloquant.
- **P1** : prochaine étape importante.
- **P2** : amélioration secondaire.

## État de la version 0.1.0

Première version implémentée dans `extension/`, chargeable sans compilation.
Hôte confirmé utilisé : `*.crunchyroll.com` avec routes localisées. Les tests
synthétiques ne valident pas encore la watchlist connectée ni l'installation réelle
sur Chrome/Edge ; les tâches correspondantes restent ouvertes.

Choix de départ : mode VO sous-titrée, langues proposées selon l'interface mais
modifiables indépendamment, vues Doublage/Sous-titres/Calendrier désactivées,
repli VO activé pour le mode doublé, recherche limitée à la watchlist. Une attente
dont la vue est désactivée reste dans À regarder avec son état. Priorité d'affichage :
erreur, jamais commencé, épisodes lisibles, attente doublage, attente sous-titres,
puis à jour ; le calendrier est une vue transversale. Masqués est indépendant.

À vérifier ensuite : installation via `chrome://extensions`, panneau et progression
sur une vraie watchlist, disponibilité audio par saison et changement de profil.
Les instructions sont dans `README.md`.

## Tâches ouvertes

### P0 — Cadrer une base fiable

- [ ] P0 — Vérifier les URL Crunchyroll réellement utilisées et les données disponibles sur une watchlist connectée.
  - Distinguer domaines (`.com`, `.fr`, `.it` si réellement utilisés), sous-domaines et chemins de langue (`/fr/`, `/it/`, etc.). Ne pas présumer que chaque suffixe existe ou héberge la watchlist.
  - Recenser les routes watchlist, les navigations sans rechargement, la pagination et les identifiants stables des séries.
  - Comparer le DOM et les données déjà chargées par le site avec les besoins de classification ; ne prévoir des lectures API supplémentaires que si nécessaires.
  - Validation : fixtures anonymisées et relevé des routes/hôtes confirmés. L'analyse statique actuelle ne valide pas une session connectée.
- [ ] P0 — Définir les règles des catégories sélectionnées et leurs interactions.
  - Catégories retenues : « À regarder » (épisodes disponibles non vus), « Doublage en attente », « Sous-titres en attente », « À commencer » (séries jamais regardées), « À jour » (aucun épisode en attente), « Cette semaine » (calendrier des sorties), « Erreurs » (échec d'analyse), « Masqués » (choix utilisateur).
  - Prévoir aussi les onglets « Recherche » et « Paramètres » ; ils ne sont pas des états de visionnage.
  - « À jour » concerne les séries commencées sans épisode en attente selon les préférences de visionnage ; ne pas assimiler cet état à une série terminée. Un nouvel épisode pertinent entraîne un reclassement.
  - « Doublage en attente », « Sous-titres en attente » et « Cette semaine » ont chacun un réglage indépendant de visibilité ; leurs valeurs initiales restent à définir. Désactiver une vue ne doit pas modifier les préférences audio ni faire disparaître silencieusement des séries.
  - « Erreurs » et « Masqués » utilisent des listes dépliantes accessibles au clavier, avec compteur et actions de nouvelle tentative/restauration adaptées.
  - Définir les priorités entre états et les recoupements : une série peut apparaître au calendrier tout en relevant d'une catégorie de visionnage.
  - Décider si le classement automatique permet une correction manuelle ; ne pas ajouter cette dernière implicitement.
  - Validation : exemples de série jamais vue, épisode partiel, attente audio/sous-titres, sortie prochaine, série sans épisode en attente, erreur et masquage.

- [ ] P0 — Définir les préférences de visionnage et les règles de repli audio.
  - Séparer langue d'interface FR/EN, langue audio souhaitée et langue des sous-titres ; ne pas déduire automatiquement l'audio du domaine.
  - Prévoir une préférence globale et une exception par série pour les utilisateurs alternant doublage et version originale. Proposer la préférence du site si elle est lisible, tout en laissant l'utilisateur la corriger.
  - Distinguer doublage existant mais en retard, doublage absent pour la saison et disponibilité inconnue. Ne pas promettre un doublage futur sur la seule absence d'une piste.
  - Permettre le choix entre attendre le doublage souhaité et regarder en version originale lorsque ce doublage n'existe pas ; rendre le repli explicite et configurable.
  - Identifier la langue originale depuis les métadonnées fiables, sans supposer le japonais : elle peut être japonaise, coréenne, chinoise, anglaise ou autre. Si elle est inconnue, proposer les pistes disponibles sans en inventer une.
  - Évaluer la disponibilité par saison/épisode et selon l'accès réel de l'utilisateur ; appliquer séparément la préférence de sous-titres, sans bascule silencieuse vers une langue non choisie.
  - Validation : doublage préféré complet, en retard, absent, absent seulement sur une saison, métadonnées inconnues, VO non japonaise, exception par série et sous-titres manquants.

### P1 — Construire la première version intégrée

- [ ] P1 — Créer une base Manifest V3 pour Chrome, Chromium et Edge, avec permissions minimales.
  - Modules JavaScript séparés : intégration Crunchyroll, normalisation des données, classification, interface, traductions et stockage si nécessaire.
  - Déclarer les hôtes confirmés explicitement, avec leurs sous-domaines utiles ; aucun motif `crunchyroll.*` ni accès à tous les sites.
  - Conserver la licence MIT et l'attribution des portions reprises de Watchroll ; choisir une identité propre.
  - Validation : manifeste et ressources cohérents, chargement en mode développeur dans Chrome et Edge.
  - Dépendance : vérification des hôtes et routes P0.
- [ ] P1 — Implémenter la lecture des données et la classification indépendamment de l'affichage.
  - S'inspirer de `common/src/api.js` et `analyzer.js` : progression réelle, saisons/épisodes, pagination, cache et concurrence bornée.
  - Réduire le périmètre à la watchlist ; gérer chargement partiel, absence de session, erreurs et expiration de session.
  - Ne pas modifier les données du compte. Si une passerelle de session est nécessaire, limiter ses messages et destinations et ne pas persister les jetons.
  - Validation : tests unitaires ciblés de classification et normalisation avec fixtures anonymisées, sans réseau ni compte réel.
  - Dépendance : règles P0 et base Manifest V3.
- [ ] P1 — Intégrer les catégories directement dans la page watchlist Crunchyroll.
  - Afficher les groupes et leurs cartes dans le site ; conserver les liens et actions utiles de la watchlist.
  - Gérer arrivée directe, navigation interne, retour arrière, chargement différé et nouvelles cartes sans doublons.
  - Isoler les styles, limiter les observations du DOM et nettoyer les effets en quittant la watchlist.
  - Préserver l'affichage natif si l'intégration ne reconnaît pas la page ou échoue ; ne pas masquer les séries sans classement fiable.
  - Validation : tests DOM ciblés (montage répété, nouvelles cartes, démontage) et essai manuel responsive/clavier sur session connectée.
  - Dépendance : données normalisées et classification.
- [ ] P1 — Ajouter les attentes de langue, le calendrier, le masquage, la recherche et les paramètres dans l'interface intégrée.
  - Distinguer les épisodes effectivement disponibles dans la langue audio/sous-titres choisie ; gérer les métadonnées absentes sans inventer une disponibilité.
  - Calendrier « Cette semaine » : distinguer dates connues et estimations, gérer fuseau horaire et absence de date.
  - Masquage réversible et persistant localement, isolé par compte/profil si les données le permettent ; aucune suppression de la watchlist Crunchyroll.
  - Définir le périmètre de Recherche (watchlist ou catalogue) avant implémentation ; ne pas reprendre automatiquement les services externes de Watchroll.
  - Paramètres : audio et sous-titres globaux, exceptions par série, attente/repli VO, et interrupteurs indépendants pour Doublage en attente, Sous-titres en attente et Cette semaine.
  - Présenter Erreurs et Masqués en listes dépliantes avec compteurs ; fournir une nouvelle tentative et une restauration sans rechargement global.
  - Validation : tests ciblés des attentes de langue et replis VO, interrupteurs de visibilité, listes dépliantes au clavier, limites de semaine, masquage/restauration et recherche ; essai des paramètres persistants.
  - Dépendance : règles P0, lecture des données et interface intégrée.
- [ ] P1 — Fournir l'interface française et anglaise.
  - Dictionnaires séparés ; traduire catégories, boutons, états vides, chargements et erreurs.
  - Proposition : langue explicite du chemin en premier, puis domaine régional confirmé (`.fr` → français), puis langue déclarée de la page ; anglais par défaut, notamment `.com` sans indication de langue.
  - Les langues non prises en charge reviennent à l'anglais ; permettre l'ajout ultérieur de traductions sans modifier la logique métier.
  - Validation : cas `.com`, `/fr/watchlist`, `.fr` si confirmé, langue non prise en charge et parité des clés FR/EN.
  - Dépendance : cartographie des URL P0.
- [ ] P1 — Valider une version utilisable sur Chrome, Chromium et Edge.
  - Utiliser un lanceur léger tel que `node --test` pour les règles pures ; ajouter uniquement l'outillage DOM nécessaire.
  - Vérifier watchlist vide/longue, pagination, déconnexion, changement de langue/profil et nouvel épisode sur une série précédemment à jour.
  - Documenter installation locale, commande de tests et limites connues ; exécuter les contrôles ciblés et `git diff --check` avant validation.
  - Validation : tests automatisés réussis et résultats des essais manuels consignés par navigateur ; distinguer clairement les essais non exécutés.
  - Dépendance : intégration et traductions.

### P2 — Préparer le Chrome Web Store

- [ ] P2 — Préparer le dossier de publication et une archive reproductible.
  - Archive contenant uniquement les fichiers nécessaires, sans `ignored/`, contexte agent, secrets ou fixtures privées ; code exécutable embarqué localement.
  - Icônes propres, captures de l'intégration réelle, descriptions FR/EN, version, assistance et mention du caractère non officiel.
  - Documenter permissions, données consultées/stockées et politique de confidentialité ; vérifier les exigences du Store au moment de la soumission.
  - Validation : archive installable, ressources présentes et déclarations conformes au comportement effectivement livré.
  - Dépendance : version P1 validée.
- [ ] P2 — Soumettre la version au Chrome Web Store après accord explicite de publication.
  - Validation : dossier prêt à relire puis soumission ; l'acceptation reste une décision du Store.
  - Dépendance : archive et fiche finalisées, compte développeur disponible.

## Tâches terminées

- [x] Créer les consignes locales de l'agent et le contexte du projet.
- [x] Ignorer les fichiers locaux de l'agent et le dossier `ignored/` dans Git.
- [x] Créer ce fichier et définir ses priorités comme base du plan de travail.
- [x] Analyser les sources locales Watchroll et définir le plan initial de l’extension intégrée.
- [x] Implémenter une version 0.1.0 intégrée avec API de même origine, préférences locales par profil, catégories FR/EN et recherche watchlist.
- [x] Ajouter les listes dépliantes, réglages de visibilité et choix du mode audio par série.
- [x] Exécuter 8 scénarios Chromium avec données synthétiques (progression, attentes de langue, interface et navigation) via `python3 tools/check.py`.
- [x] Générer l'archive locale via `python3 tools/package.py` et documenter le test sur Chromium/CachyOS.
- [x] Corriger le montage sans balise `main`, ajouter le diagnostic depuis l’icône et tester le repli vers le corps de page (0.1.1).
- [x] Positionner le panneau devant la collection de cartes natives et le déplacer après chargement différé, sans le mettre au-dessus du bandeau (0.1.2 ; régression Chromium réussie).
- [x] Corriger la détection avec plusieurs liens illustrés par carte et isoler le positionnement du panneau des styles du site ; test géométrique de non-chevauchement réussi (0.1.3).
- [x] Ajuster le placement demandé : immédiatement après le bandeau Crunchyroll, avant « Mes listes » ; test Chromium réussi (0.1.4).
- [x] Réserver dynamiquement l’espace du panneau en décalant le bloc de contenu natif en cas de chevauchement ; tester agrandissement, réduction, absence d’accumulation et restauration des marges (0.1.5).
- [x] Suivre le repère annoté : panneau sous Watchlist / Crunchylists / Historique, avant Activité récente ; déplacement et absence de chevauchement testés (0.1.6).
- [x] Éviter les conteneurs d’onglets à hauteur fixe/overflow masqué, privilégier l’ancrage avant Activité récente et ajouter un diagnostic géométrique sans données de compte (0.1.7 ; tests Chromium réussis).
- [x] Remplacer l’analyse séquentielle sans retour par deux analyses simultanées, résultats progressifs, compteur, annulation et délais bornés ; 11 scénarios Chromium réussis (0.1.8).
- [x] Limiter les menus à la largeur des cartes, ouvrir les options audio via un bouton roue accessible et afficher « Reste X épisode(s) à voir » avec traductions FR/EN (0.1.9 ; tests Chromium réussis).
- [x] Ajouter le cache local persistant par compte/profil et préférences : affichage immédiat, fraîcheur 5 minutes, actualisation progressive, forçage manuel et tests d’isolation/expiration/erreur de stockage (0.2.0).
- [x] Rendre Masqués accessible en haut du panneau, ouvrir la liste après masquage et permettre restauration individuelle/globale même sans résultat analysé pour une série (0.2.1 ; tests Chromium réussis).
- [x] Remplacer les blocs dépliants Masqués/Erreurs par des onglets avec compteurs dans la barre des catégories ; conserver les actions de restauration (0.2.2, tests réussis).
- [x] Conserver le champ de recherche pendant les mises à jour d’analyse : focus, valeur et sélection inchangés ; test Chromium de régression réussi (0.2.3).
- [x] Rendre les images des cartes cliquables vers le prochain épisode disponible (priorité à la reprise en cours), conserver le titre vers la série et enregistrer les identifiants de lecture dans le cache (0.2.4 ; 13 scénarios Chromium réussis).
- [x] Remplacer Masquer/Restaurer par des yeux SVG inversés au survol/focus, ajouter les infobulles FR/EN et une confirmation avant masquage ; tests annulation/confirmation/restauration réussis (0.2.5).
- [x] Ajouter le choix de langue de l’extension English / Français / 日本語, anglais par défaut, application immédiate et stockage global indépendant de l’audio et des sous-titres ; traduire aussi la popup et tester les trois langues (0.3.0).
- [x] Ajouter aux listes filtre Tous/Favoris Crunchyroll uniquement, favoris prioritaires par défaut et tri décroissant par dernière sortie (défaut) ou note ; réglages persistants par liste, métadonnées en cache (0.3.1 ; 14 scénarios Chromium réussis).
- [x] Ajouter/retrait des favoris Crunchyroll depuis les cartes via bouton cœur : requête PATCH explicite, blocage double clic, erreur sans faux succès, tri/cache actualisés ; 15 scénarios Chromium simulés réussis (0.3.2).
- [x] Stabiliser les sélecteurs de filtres/tri, paramètres et audio par carte pendant l’analyse : conserver les contrôles et différer le remplacement des cartes lorsque leur menu est actif ; tests de focus réussis (0.3.3).
- [x] Auditer le cache et corriger les reprises : sauvegarde au premier résultat puis tous les 10, fraîcheur par série, réutilisation des succès même avec erreurs, écritures sérialisées ; test de réouverture sans lecture API réussi (0.3.4).
- [x] Rafraîchir discrètement les listes en cache en gardant les cartes stables jusqu’à la fin ; progression visible seulement sans cache ou sur demande manuelle, vérification automatique toutes les 5 minutes tant que la watchlist est ouverte (0.3.5 ; test Chromium réussi).
- [x] Replacer cœur en haut à droite et réglages/visibilité en bas à droite ; afficher titre de vue, cartes squelettes à la première analyse et état vide explicite ; tests de géométrie/changement de vue réussis (0.3.6).
- [x] Ajouter la recherche locale à droite des filtres de chaque catégorie, en conservant Recherche globale, requêtes distinctes par vue, état sans correspondance et focus stable ; 16 tests Chromium réussis (0.3.7).
- [x] Ajouter le dernier visionnage par série depuis l’historique, badge relatif/date au survol, onglet récent 30 jours et filtre toutes/24h/7j/30j combinable aux autres critères ; cache profil v4 et avertissements historique partiel ; 17 scénarios Chromium réussis (0.3.8).
- [x] Ajouter le repli/dépli des vignettes avec état conservé par profil, onglets accessibles et ajustement de l’espace réservé ; tests hauteur/rendu/actualisation réussis (0.3.9).
- [x] Compacter le panneau et la barre des filtres : contrôles 32px, marges réduites, recherche alignée sur la même ligne en largeur normale et repli responsive ; extraire les styles ; tests large/360px réussis (0.4.0).
- [x] Hériter de la police du site dans le panneau, boutons et sélecteurs, en gardant les tailles compactes ; vérification Chromium réussie (0.4.1).
- [x] Retirer Dernier visionnage dans À commencer et ignorer son ancien réglage pour éviter de masquer les séries jamais vues ; conserver favoris/tri/recherche (0.4.2, tests réussis).
- [x] Ajouter Vu récemment au tri des listes pertinentes, dernier visionnage décroissant et dates inconnues en bas du groupe ; préférence persistée, exception À commencer (0.4.3 ; tests réussis).
- [x] Confirmer le retrait des favoris avant toute requête, avec nom de série et traductions ; ajout direct inchangé ; tests annulation/erreur/succès réussis (0.4.4).
- [x] Renommer le choix français Filtrer en « Tous / Favoris uniquement » (0.4.5).
- [x] Auditer EN/FR/JA : mêmes clés et variables, aucun texte vide ; aligner le filtre Tous en All / すべて ; 17 scénarios Chromium réussis (0.4.6).
- [x] Fusionner Actualiser/Annuler en un seul bouton selon l’état de l’analyse ; annulation, conservation des cartes et relance testées dans Chromium (0.4.7).
- [x] Afficher le résumé général au survol/focus des vignettes et titres, chargé à la demande avec cache profil/langue ; refuser descriptions d’épisodes et séries non correspondantes ; 18 scénarios Chromium réussis (0.4.8).
- [x] Masquer Actualiser durant l’analyse, retirer Annuler de la navigation et appliquer un délai de 30s après analyse avant actualisation/réessai manuel, compteur traduit et reprise du délai depuis le cache ; 19 tests réussis (0.4.9).
- [x] Remplacer les modes audio par deux langues ordonnées, communes aux paramètres et exceptions par série ; sélection disponible par épisode, attente si aucune ne correspond, cache invalidé par préférence et migration des anciens réglages ; 20 scénarios Chromium réussis (0.5.0).
- [x] Corriger l’expiration de session : conserver les cartes/cache, renouveler le jeton via session existante avec requête partagée, observer les renouvellements natifs, reprendre après réauthentification et interrompre les analyses sans cache erroné ; 21 scénarios Chromium réussis (0.5.1).
- [x] Masquer les onglets Masqués/Erreurs quand ils sont vides ; compteurs/visibilité dynamiques, retour à À regarder si le dernier élément disparaît (0.5.2 ; tests Chromium réussis).
- [x] Retirer les cases d’affichage des paramètres ; onglets Doublage/Sous-titres/Calendrier/Masqués/Erreurs visibles automatiquement si non vides, anciens réglages ignorés (0.5.3 ; tests réussis).
- [x] Afficher EPx en bas des cartes, lié au même épisode que l’image ; identifier le premier épisode de la première saison pour À commencer, conserver numéros et cible dans cache v5 ; tests EP1/EP187 réussis (0.5.4).
- [x] Libeller le lien d’épisode « Commencer EPx » / « Continuer EP x », avec traductions EN/JA (0.5.5, tests réussis).
- [x] Afficher la note « ★ 4.7 » dans l’image à droite, sur fond contrasté, sans déplacer le cœur ; retirer la ligne de note en doublon (0.5.6 ; tests réussis).
- [x] Préparer le commit initial de l’extension 0.5.6 : README réconcilié, 21 tests Chromium réussis, manifeste/popup/archive/licence vérifiés et fichiers locaux exclus.
