# AI START HERE — IN-SECT

Point d’entrée obligatoire pour tout agent IA reprenant IN-SECT — L’Échiquier des Colonies.

## 1. Comprendre avant de modifier

Avant toute intervention :
1. vérifier l’état réel de `main` et les changements/issues/PR pertinents ;
2. lire `README.md` ;
3. **si la tâche concerne le multijoueur, lire intégralement `MULTIPLAYER_HANDOFF.md` avant toute modification ou tout déploiement** ;
4. lire `index.html` pour l’ordre réel de chargement ;
5. inspecter les fichiers `js/` concernés et les styles/tutoriel concernés ;
6. rechercher si la règle, le pouvoir, l’écran, l’effet ou le comportement demandé existe déjà.

Le jeu est une PWA statique sans bundler. Les scripts `js/` sont classiques, chargés dans un ordre défini et partagent un scope global. Ne pas introduire silencieusement une architecture de modules ou une chaîne de build pour une modification locale.

## 2. Identité du produit

IN-SECT est un jeu de stratégie sur plateau 9×9 opposant jusqu'à quatre colonies, chacune menée par une Reine et des pièces aux capacités distinctes. Les conditions de victoire et les règles de mouvement constituent des invariants métier : toute évolution doit vérifier ses effets sur règles, IA, tutoriel, rendu et options de jeu.

## 3. Carte du code

- `index.html` — structure UI, écrans, modals, règles et ordre des scripts.
- `style.css` / `tuto.css` — présentation principale et tutoriel.
- `tuto.js` — tutoriel animé.
- `js/01-core.js` — constantes, état global, helpers, statistiques.
- `js/02-audio-fx.js` — audio, ambiance, effets.
- `js/03-nav-menu.js` — navigation et sélection du mode.
- `js/04-board.js` — partie, plateau, rendu des pièces.
- `js/05-rules.js` — mouvements, captures, Nid Sacré, encerclement, victoire.
- `js/06-ai.js` — IA Basique/Tactique/Expert.
- `js/07-powers.js` — options et Super Pouvoirs.
- `js/08-boot.js` — démarrage, musique, analytics et chargement du client multijoueur.
- `js/09-multiplayer-config.js` — endpoint public de l'Edge Function multijoueur.
- `js/09-multiplayer.js` — client multijoueur 1v1, matchmaking, vote SP, polling et synchronisation d'état.
- `supabase/functions/insect-match/index.ts` — Edge Function multijoueur.
- `supabase/insect_multiplayer_schema.sql` — schéma SQL versionné du backend multijoueur.
- `MULTIPLAYER_HANDOFF.md` — état de passation, invariants backend et scénario de validation multijoueur.

Cette carte doit être mise à jour si la structure réelle change.

## 4. Protection de l’existant

- Ajouter/étendre avant de supprimer ou réécrire.
- Avant toute suppression, vérifier si l’objectif exige réellement un retrait.
- Ne pas modifier une règle pour résoudre un problème purement visuel.
- Ne pas affaiblir l’IA ou les règles existantes pour faciliter une nouvelle fonctionnalité.
- Lorsqu’une règle change, vérifier les trois niveaux d’IA et le tutoriel lorsque concernés.
- Préserver le fonctionnement statique/PWA sauf décision architecturale explicitement justifiée.
- Éviter les refactorings sans rapport avec la tâche.
- Le multijoueur doit rester aussi isolé que possible du fonctionnement historique solo/IA.

## 5. Validation

Selon la modification, vérifier au minimum : démarrage, nouvelle partie, déplacements/captures concernés, victoire/encerclement, modes/options, IA concernée, navigation/modals, tutoriel, mobile/PWA et absence d’erreur console. Pour une régression de règle, créer un moyen reproductible de la vérifier dès que l’architecture le permet.

Pour le multijoueur V1, le critère de validation prioritaire reste : **Jaune joue → version serveur augmente → Rouge voit le coup → Rouge joue → version augmente → Jaune voit le coup.** Voir `MULTIPLAYER_HANDOFF.md`.

## 6. Indexation

Aucune décision importante ne doit rester uniquement dans la conversation. Une règle durable doit être documentée au bon endroit ; une dette ou fonctionnalité future doit être traçable ; le README et cette carte doivent rester cohérents avec la structure réelle.

## 7. Protocole obligatoire avant passation

1. vérifier `main` et l’état réel des changements ;
2. inventorier fichiers et comportements touchés ;
3. documenter toute nouvelle règle/invariant durable ;
4. vérifier les impacts croisés règles ↔ IA ↔ tutoriel ↔ UI ;
5. rechercher références obsolètes ou contradictions ;
6. consigner clairement FAIT ET VÉRIFIÉ / EN COURS / OUVERT / PROCHAINE ÉTAPE / À NE PAS REFAIRE ;
7. préciser les scénarios de test réellement exécutés et ceux restant à faire ;
8. relire comme si le prochain agent n’avait aucune conversation précédente.

## 8. Instruction courte

> Consulte `AI_START_HERE.md`, puis `MULTIPLAYER_HANDOFF.md` si la tâche touche au multijoueur. Vérifie l’état réel du dépôt et respecte l’architecture statique et les invariants du jeu. Avant toute passation, indexe les décisions et vérifie les impacts règles, IA, tutoriel et interface afin que la reprise ne dépende pas de la conversation précédente.
