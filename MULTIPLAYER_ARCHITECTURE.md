# IN-SECT — Architecture multijoueur autoritaire

Date : 2026-09-08
Statut : fondation de refactor en cours

Ce document décrit la frontière multijoueur cible et l'audit du chemin réel d'un coup. Il complète `MULTIPLAYER_HANDOFF.md` et `MULTIPLAYER_TRANSFORMATION_PLAN.md`. Il ne remplace pas les règles du jeu ni le moteur solo/IA.

## 1. Conclusion de l'audit

Le multijoueur historique est construit autour d'un **snapshot client poussé après mutation locale**. Le navigateur applique d'abord les règles et modifie `G`, puis `finishTurn`/le polling déclenchent un `push` du snapshot. L'Edge Function vérifie le siège et le joueur courant du snapshot serveur précédent, puis remplace l'état par le snapshot client si la mise à jour de version SQL réussit.

Conséquence : le serveur est autoritaire sur **l'ordre des snapshots**, mais pas encore sur **la résolution complète d'une action de jeu**. Une mutation locale peut donc être visible avant confirmation et être ensuite écrasée par un snapshot serveur. Le rembobinage observé sur téléphone est une conséquence structurelle de cette frontière.

Autre fragilité identifiée : `isHuman` est déclaré avec `const` dans le moteur commun, alors que plusieurs couches multijoueur tentaient de le réassigner dynamiquement. Cette stratégie de wrappers est supprimée au profit d'une intégration explicite du runtime online dans le moteur commun.

## 2. Chemin historique réel d'un coup

Chemin principal :

`touch/click plateau`
→ `humanClickCell(r,c)`
→ `isHuman()` / phase / animation / état SP
→ `getActionsWithSP(piece)` et règles spécialisées
→ `doMove` / `doKill` / `doDipl` / `doNecro` / phase secondaire
→ mutations immédiates de `G` (`movePiece`, `removeFromBoard`, `placeOnBoard`, flags de phase, morts, changements d'équipe, SP...)
→ effets DOM/audio/animations
→ `finishTurn()`
→ mutations de tour (`G.turn`, `G.idx`, Nid Sacré, SP, victoire...)
→ ancien bridge multijoueur : `push()` du snapshot client
→ Edge Function `push`
→ contrôle secret/siège + couleur courante + update optimiste SQL sur `version`
→ `version + 1`
→ Broadcast Realtime `state_changed`
→ client adverse fait `get(since=lastVersion)`
→ reçoit un snapshot complet
→ reconstruit `G.board`
→ `buildBoard/renderBoard/updateTurnUI`
→ le plateau final apparaît.

Ce chemin explique pourquoi l'adversaire voit principalement un nouvel état final plutôt qu'une action se dérouler.

## 3. Chemins capables de modifier la partie

La mutation de partie n'est pas limitée à `humanClickCell` :

- `movePiece`, `removeFromBoard`, `placeOnBoard` ;
- `doMove`, `doKill`, `doDipl`, `doNecro` ;
- placement de dépouille / déplacement / résurrection ;
- Reporter et attaques de zone ;
- élimination, encerclement, transfert de pièces ;
- `finishTurn`, Nid Sacré, tours supplémentaires ;
- Super Powers, résurrections automatiques et tirages aléatoires ;
- IA solo, qui utilise le même moteur de mutation ;
- restauration de snapshot (`loadSave` / multijoueur `applyState`).

Donc verrouiller seulement un handler de clic ne suffit pas à définir l'autorité multijoueur.

## 4. Frontières cibles

### Moteur commun

À CONSERVER : règles, pièces, plateau logique 9×9, IA solo, victoire, Nid Sacré, Super Powers et logique tactique existante.

À REFACTORER progressivement : séparer les transitions déterministes de règles des effets DOM/audio/animation. Le but est un noyau de résolution testable sans navigateur.

### Runtime online

Le multijoueur possède un runtime explicite, avec un seul état d'expérience et une seule décision d'interactivité.

États V1 :

- `idle`
- `searching_opponent`
- `opponent_found`
- `preparing_match`
- `waiting_initial_state`
- `my_turn`
- `local_selection`
- `action_sent`
- `waiting_confirmation`
- `animating_accepted_action`
- `opponent_turn`
- `receiving_opponent_action`
- `reconnecting`
- `finished`
- `sync_error`

Les booléens transport (`realtimeConnected`, requête en vol...) restent des diagnostics de transport ; ils ne décident plus seuls si le plateau est jouable.

### État local non autoritaire

Peut rester local : sélection, survol, cases proposées, modal/panneau, orientation/perspective, animation déjà autorisée, diagnostics.

### État de partie autoritaire

Doit provenir du serveur pour une partie online : joueurs/participants, couleur contrôlée, joueur courant, positions, morts, captures, phases de règle, SP, compteurs, victoire et version.

## 5. Protocole cible : ACTION + ÉVÉNEMENT ACCEPTÉ + SNAPSHOT

### ACTION

Intention envoyée par un participant avec au minimum :

- `player_id` / siège authentifié par le secret de session ;
- `controlled_color` ;
- `base_version` ;
- type d'action ;
- identifiants et coordonnées logiques nécessaires ;
- choix secondaires éventuels.

### ÉVÉNEMENT ACCEPTÉ

Événement immuable correspondant à ce que le serveur a accepté, contenant notamment :

- version de base ;
- nouvelle version ;
- acteur/couleur ;
- changements significatifs de pièces ;
- changement de tour ;
- conséquences utiles à l'animation.

Ce n'est pas un event sourcing complet. On ne reconstruit pas toute l'histoire depuis les événements.

### SNAPSHOT

État canonique complet après l'événement. Il reste la source de récupération pour :

- première connexion ;
- reconnexion ;
- perte de Broadcast ;
- onglet/PWA repris après sommeil ;
- contrôle de cohérence.

## 6. Autorité serveur : niveaux de garantie

### Fondation exécutable immédiate

Le protocole v2 doit au minimum refuser :

- mauvais siège/couleur ;
- action hors tour ;
- `base_version` périmée ;
- double validation de la même version ;
- snapshot mal formé/incompatible avec le réglage SP.

Le serveur diffuse ensuite l'événement accepté et la nouvelle version. Cela supprime une classe importante de divergences/stale writes.

### Condition avant de déclarer « autorité règles complète »

Le serveur doit aussi pouvoir résoudre ou vérifier la légalité de l'action selon les règles IN-SECT, indépendamment du DOM client. Cela nécessite d'extraire un **game rules kernel** pur du moteur existant, en particulier pour les actions multi-étapes, le Nid Sacré, l'encerclement et les Super Powers/aléas.

Tant que ce noyau commun n'est pas en production et couvert par des tests de parité, le statut doit rester : **séquençage/version autoritaires, légalité complète encore à renforcer**.

## 7. Perspective

Les coordonnées logiques ne changent jamais.

Le renderer utilise une fonction :

`logical (r,c) -> view (r,c) selon seat/perspective`

En 1v1 actuel :

- siège Rouge : identité (camp Rouge en bas/droite) ;
- siège Jaune : rotation de coordonnées de 180° (`8-r`, `8-c`) ;
- les canvases/insectes/textes ne sont jamais eux-mêmes retournés.

Cette abstraction pourra accepter plus tard des rotations/sièges supplémentaires sans modifier les règles.

## 8. Rendu d'une action adverse

À la réception d'un événement accepté :

1. runtime → `receiving_opponent_action` ;
2. vérifier `base_version`/`result_version` ;
3. jouer localement les animations significatives décrites par l'événement ;
4. appliquer le snapshot final canonique ;
5. runtime → `my_turn` ou `opponent_turn` ;
6. feedback de changement de tour.

Aucune position de curseur/doigt adverse n'est synchronisée.

## 9. Diagnostic structuré

Le runtime expose en développement :

- état de machine ;
- connexion ;
- code/session/siège ;
- couleur contrôlée ;
- joueur courant ;
- version serveur connue ;
- version locale appliquée ;
- dernière action envoyée ;
- dernier événement reçu ;
- action en attente ;
- dernière erreur de synchronisation.

Un panneau n'est affiché que si `?mpdebug=1` est présent.

## 10. Classification

### À CONSERVER

- moteur de règles existant comme référence fonctionnelle ;
- IA solo ;
- rendu/identité visuelle ;
- Supabase, secrets de sièges, matchmaking ;
- vote Super Powers ;
- version SQL et `get(since=...)` ;
- Realtime comme accélérateur, jamais comme vérité unique ;
- reprise de session locale.

### À ISOLER

- sélection/UX locale ;
- transport HTTP/Realtime ;
- runtime online ;
- perspective ;
- animation d'événement accepté ;
- diagnostics.

### À RENFORCER

- version attendue explicite ;
- double action/idempotence ;
- reconnexion et cache ancien ;
- tests automatiques de protocole ;
- état unique d'interactivité.

### À REFACTORER

- règles mutatives mêlées au DOM/audio ;
- Super Powers aléatoires exécutés côté navigateur ;
- `finishTurn` mêlant transition de règle, sauvegarde, rendu et lancement IA.

### À REMPLACER

- wrappers successifs de `isHuman`/`finishTurn` ;
- rotation CSS globale du plateau ;
- `push` implicite d'un snapshot sans `base_version` explicite comme protocole final ;
- interprétation de `players[*].human` comme identité réseau.

## 11. Critères de validation

Un correctif n'est pas déclaré robuste parce que le plateau « semble fonctionner ».

Ordre de preuve :

1. implémenté ;
2. tests automatiques du runtime/protocole ;
3. test navigateur à deux sessions ;
4. test sur deux appareils réels ;
5. scénarios anormaux (veille, arrière-plan, refresh, cache, perte réseau, double tap, stale version, double reconnexion, abandon, longue attente) ;
6. partie complète où aucun joueur ne doute de l'état réel.
