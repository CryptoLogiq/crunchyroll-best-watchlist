# Tâches du projet

Ce fichier dirige le plan de l'agent : P0 avant P1 avant P2, puis ordre de la liste.
Une demande explicite de l'utilisateur prime. Ne cocher qu'après vérification adaptée.

## État actuel

Version 0.5.6 : interface intégrée, audio préféré/secondaire, sous-titres, cache,
favoris Crunchyroll, historique, recherche, tri et traductions EN/FR/JA implémentés.
Les onglets optionnels apparaissent lorsqu'ils contiennent des résultats.
Les anciennes demandes de repli VO automatique, cases de visibilité et blocs dépliants
Masqués/Erreurs ont été remplacées par les décisions utilisateur consignées ci-dessous.
Chrome/Chromium/Edge partagent une cible ; Firefox dispose d'une cible de préparation.
La présence d'un paquet Firefox ne valide pas sa compatibilité.

## Tâches ouvertes

### P0 — Fiabilité avant diffusion

- [ ] Consigner les essais réels de la version candidate dans `docs/browser-validation.md` :
  routes localisées sur `.com`, watchlist vide/longue, pagination, navigation interne,
  session expirée, reconnexion et changement de profil ; vérifier absence de mélange de comptes.
- [ ] Vérifier les classifications sur des séries réelles : jamais commencée, reprise,
  à jour puis nouvel épisode, audio préféré/secondaire selon saison, VO non japonaise,
  sous-titres manquants, métadonnées absentes. Ajouter seulement les fixtures anonymisées utiles.
- [ ] Vérifier les dates du calendrier et le marquage des estimations, les limites de saisons
  analysées et les avertissements d'historique partiel ; documenter les limites constatées.
- [ ] Auditer avant publication les permissions, le pont de session, l'absence de jetons
  persistés et les seules écritures de compte autorisées : favoris après action explicite.

### P1 — Valider les deux familles de navigateurs

- [ ] Adapter et valider Firefox sans modifier le comportement Chromium : traiter l'objet
  `browser` natif actuellement remplacé dans `api.js`, vérifier événements entre mondes,
  observation et renouvellement de session, API, stockage et popup. Utiliser un adaptateur
  ciblé si nécessaire ; aucun fork du métier. Vérifier le minimum Firefox retenu.
- [ ] Exécuter les tests de non-régression communs et les contrôles des deux paquets ;
  compléter les essais manuels Chrome / Chromium / Edge / Firefox dans la matrice.
- [ ] Valider sur les deux cibles installation, cache, lecture directe, cœur avec confirmation,
  masquage/restauration, focus pendant analyse, navigation clavier et responsive.

### P2 — Préparer les publications

- [ ] Préparer icônes, captures réelles, descriptions FR/EN, assistance et mention non officielle.
- [ ] Rédiger une politique de confidentialité fidèle au code et vérifier les déclarations
  Chrome Web Store / Mozilla au moment de la soumission, notamment les permissions de données
  Firefox. Préserver licence et attribution Watchroll.
- [ ] Vérifier les archives finales par cible : mêmes sources communes, version cohérente,
  ressources embarquées, aucune clé privée ni donnée de compte ; signer/distribuer Firefox
  selon les exigences Mozilla. Dépendance : validation P0/P1.
- [ ] Soumettre au Chrome Web Store après accord explicite, compte développeur disponible
  et dossier relu ; commencer par une diffusion de test selon visibilité retenue.
- [ ] Soumettre sur Firefox Add-ons après accord explicite et validation Firefox ;
  l'acceptation des deux boutiques reste leur décision.

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

- [x] Structurer les cibles Chromium/Firefox sans déplacer l’installation existante : manifestes différentiels, constructions isolées, ZIP reproductibles, consignes agent et matrice de validation. Trois tests de construction et 21 scénarios Chromium réussis ; compatibilité fonctionnelle Firefox encore à valider.
