# IN-SECT — Passation multijoueur V1

> À lire **après `AI_START_HERE.md`**. Ce document contient le contexte durable nécessaire pour reprendre le multijoueur sans dépendre d'une conversation précédente.

## 1. Priorité produit actuelle

Objectif immédiat : obtenir un multijoueur **1v1 simple, robuste, gratuit et testable**.

Ordre des priorités :
1. fiabilité technique ;
2. vrai 1v1 fonctionnel ;
3. tests avec de vrais joueurs ;
4. mesure du comportement ;
5. monétisation/commercialisation plus tard.

Ne pas ajouter Elo, classement, chat, amis, tournoi ou architecture complexe tant que le scénario fondamental n'est pas fiable :

**Jaune joue → serveur version +1 → Rouge voit le coup → Rouge joue → serveur version +1 → Jaune voit le coup.**

Budget de cette phase : **0 €**. Utiliser GitHub + PWA + Supabase gratuit. Prévenir avant toute décision susceptible d'engendrer un coût.

## 2. Invariants à préserver

- Le solo/IA existe et fonctionne : **ne pas le casser pour corriger le multijoueur**.
- Garder le multijoueur aussi isolé que possible du moteur historique.
- Toute interception de fonctions globales (`finishTurn`, `isHuman`, rendu, initialisation…) doit être explicitement conditionnée à une session online.
- Hors session online, le comportement historique doit rester inchangé.
- Pas de gros refactoring pendant la stabilisation.
- Le polling ~1 seconde est volontaire et acceptable pour la V1.

## 3. Supabase IN-SECT

Projet Supabase dédié :
- project ref : `nczdadkyysrxxcsnsrrn`
- région : Paris / `eu-west-3`

**Attention : il existe un autre projet Supabase sans rapport avec IN-SECT. Ne jamais y intervenir.**

Architecture retenue :

`navigateur → Edge Function → tables Supabase`

Le navigateur ne doit pas accéder librement aux données sensibles. `SUPABASE_SERVICE_ROLE_KEY` reste exclusivement côté serveur.

Tables principales :
- `public.insect_matches` — parties, code, statut, secrets hashés, état JSON, version, expiration, votes SP ;
- `public.insect_matchmaking_queue` — file de matchmaking, secret/hash, dates, heartbeat, match attribué, rôle, secret de partie, consommation.

Le schéma versionné se trouve dans `supabase/insect_multiplayer_schema.sql`.

## 4. Edge Function

Fonction : `insect-match`

Code versionné : `supabase/functions/insect-match/index.ts`

Endpoint client : `https://nczdadkyysrxxcsnsrrn.supabase.co/functions/v1/insect-match`

Actions connues :
- `create`
- `join`
- `get`
- `push`
- `vote_sp`
- `matchmake_start`
- `matchmake_status`
- `matchmake_cancel`

`verify_jwt=false` est **volontaire** : cette fonction utilise ses propres secrets de session. Ne pas modifier cette architecture sans raison solide.

Au 2 septembre 2026, la fonction déployée vérifiée était **version 4 ACTIVE**, `verify_jwt=false`.

### Correction matchmaking v4

Un bug réel avait permis à un téléphone d'être appairé avec une ancienne recherche abandonnée (« joueur fantôme »). Exemple historique : partie `J42YUF`, host ayant voté, aucun vrai guest actif.

La v4 déployée utilise `last_seen_at` comme heartbeat et une fenêtre de fraîcheur d'environ 5 secondes avant de considérer une entrée de file comme disponible. `matchmake_status` rafraîchit `last_seen_at`.

Cette correction avait d'abord été déployée sur Supabase sans être synchronisée dans GitHub. Elle a depuis été remise dans `main` :
- commit `4909d90` — `Sync deployed matchmaking heartbeat to GitHub`
- commit `6677dd8` — `Sync multiplayer matchmaking schema documentation`

**Ne jamais redéployer aveuglément une ancienne version GitHub sur Supabase. Toujours comparer le code déployé et le code versionné avant un déploiement.**

## 5. Client multijoueur

Fichiers :
- `js/09-multiplayer-config.js`
- `js/09-multiplayer.js`

Le client est chargé après le moteur historique via `js/08-boot.js` (`loadMultiplayerClient()`). Il n'est donc pas nécessaire que `index.html` contienne directement les scripts `09-*`.

Modes V1 :

### Matchmaking
- premier chercheur : Host / Jaune ;
- second : Guest / Rouge ;
- appairage puis vote SP.

### Partie privée
- création d'un code de 6 caractères / lien ;
- second appareil rejoint par code/lien.

## 6. Vote des Super Pouvoirs

Une fois les deux joueurs présents :
- chacun vote OUI/NON ;
- même vote → résultat appliqué ;
- désaccord → tirage serveur 50/50 ;
- résultat verrouillé pour la partie ;
- la partie ne démarre réellement qu'après décision.

Ce mécanisme a déjà fonctionné lors de tests réels ordinateur + téléphone.

## 7. Incident historique KBTZXN

Test réel ordinateur + téléphone :
- matchmaking OK ;
- rôles/couleurs OK ;
- votes SP OK ;
- lancement des deux plateaux OK ;
- **les coups ne se synchronisaient pas**.

Partie Supabase historique : `KBTZXN`.

État constaté :
- `status = active`
- `version = 1`
- `host_sp_vote = true`
- `guest_sp_vote = true`
- `sp_enabled = true`
- état initial présent ;
- `G.idx = 0`, ordre `[yellow, red]` ;
- les deux joueurs étaient marqués `human=true` dans l'état initial.

Interprétation : l'état initial avait bien été poussé, mais les coups suivants n'avaient pas produit de nouvelles versions serveur. Le diagnostic devait donc commencer côté **émission du nouvel état**, pas par le polling adverse.

## 8. Correction de synchronisation réalisée

Commit principal :
- `e14a623` — `Fix multiplayer turn state synchronization`

`finishTurn()` reste le point principal de fin de tour du moteur historique. La logique multijoueur reste dans `js/09-multiplayer.js`.

Le client a été renforcé pour :
- déclencher l'envoi de l'état après la fin d'un tour online ;
- dédupliquer les états/tours afin d'éviter les doubles `push` ;
- empêcher deux `push` concurrents ;
- marquer un état distant comme déjà reçu pour ne pas le renvoyer ;
- utiliser le polling comme **filet de sécurité** : si le tour est déjà passé à l'adversaire mais que l'état local terminé n'a pas encore été confirmé envoyé, tenter le `push` avant de poursuivre ;
- rendre les erreurs de synchronisation visibles au lieu de les laisser uniquement dans `console.warn` ;
- afficher la version serveur lors d'une synchronisation réussie.

Aucun fichier de règles/IA n'a été réécrit pour cette correction. Les hooks doivent rester conditionnés à `MP.active`.

## 9. Application d'un état distant

Une fois les `push` confirmés, la chaîne à surveiller est :

`polling → get → nouvelle version → applyState → reconstruction des références → rendu`

Un simple `JSON.parse` ne suffit pas nécessairement : `G.board` contient des références vers les objets pièces. Le client reconstruit donc le board depuis `G.players[*].pieces` après réception.

Ne réécrire cette partie que si un test prouve que le serveur reçoit bien la nouvelle version mais que l'adversaire ne l'applique pas.

## 10. Test de validation obligatoire restant

Le correctif a été vérifié par inspection du code et de Supabase, mais **le test utilisateur final à deux appareils n'a pas encore été revendiqué comme exécuté après le correctif**.

Test exact :
1. rechargement complet ordinateur + téléphone (attention au cache/PWA) ;
2. ordinateur → Trouver un adversaire ;
3. téléphone → Trouver un adversaire ;
4. vérifier Jaune/Host et Rouge/Guest ;
5. voter SP sur les deux ;
6. attendre le plateau sur les deux ;
7. relever le nouveau code de partie ;
8. vérifier état initial serveur `version = 1` ;
9. Jaune joue **un seul coup** ;
10. attendre 1–2 s maximum ;
11. serveur attendu : `version = 2` ;
12. Rouge doit voir automatiquement le coup ;
13. Rouge joue **un seul coup** ;
14. serveur attendu : `version = 3` ;
15. Jaune doit voir automatiquement le coup.

Le client doit afficher un message du type `Synchronisé · version 2`, puis `Synchronisé · version 3` en cas de succès.

Si le test échoue, récupérer simplement le **nouveau code de partie**, puis inspecter Supabase :
- version reste 1 → problème encore côté push/acceptation serveur ;
- version passe 2 mais Rouge ne bouge pas → problème get/applyState/rendu ;
- version 2 puis Rouge ne peut pas pousser → examiner rôle, couleur, `currentColor(state)` et erreur serveur retournée.

## 11. Protection serveur actuelle

Pour `push` :
- partie doit être active ;
- vote SP décidé ;
- état schema 1 avec `G` ;
- `optSP` doit correspondre au choix serveur ;
- Host correspond à `yellow`, Guest à `red` ;
- si un état précédent existe, le serveur vérifie la couleur qui devait jouer dans cet état ;
- mise à jour protégée par la version courante ;
- version incrémentée de 1.

Ce n'est pas une validation anti-triche complète des mouvements. Pour la V1 de tests amicaux, c'est volontairement acceptable.

## 12. Analytics

Instrumentation existante dans `js/08-boot.js`. Ne pas la supprimer lors des corrections multijoueur.

Événements multijoueur intéressants plus tard :
- `multiplayer_search_start`
- `multiplayer_match_found`
- `multiplayer_vote_complete`
- `multiplayer_game_start`
- `multiplayer_turn_synced`
- `multiplayer_disconnect`
- `multiplayer_game_complete`

Pas prioritaire avant la validation du flux UN COUP → SERVEUR → ADVERSAIRE.

## 13. Positionnement produit durable

IN-SECT n'est pas à présenter simplement comme « des échecs avec des insectes ». Éléments différenciants : plateau 9×9, Reines, 8 types de pièces, encerclement, cadavres persistants qui influencent le terrain, manipulation/poussée, Nid Sacré, Super Pouvoirs, rôles identifiables (Diplomate, Reporter, Assassin, etc.).

Idée de positionnement déjà retenue comme direction : une guerre tactique où **même les morts continuent d'influencer le champ de bataille**.

La priorité reste néanmoins la fiabilité produit, pas le marketing.

## 14. État de passation au 2 septembre 2026

### FAIT ET VÉRIFIÉ
- `AI_START_HERE.md` est maintenant sur `main` (commit `c2b46b7`).
- Projet Supabase correct vérifié : `nczdadkyysrxxcsnsrrn`.
- Edge Function déployée vérifiée : `insect-match` v4 ACTIVE, `verify_jwt=false`.
- Correction heartbeat v4 resynchronisée dans GitHub.
- Schéma matchmaking documenté/versionné.
- Incident `KBTZXN` vérifié en base : version restée à 1.
- Client de synchronisation renforcé dans `e14a623`.

### RESTE À VALIDER EN CONDITIONS RÉELLES
- test ordinateur + téléphone après `e14a623` ;
- version 1 → 2 après le coup Jaune ;
- application automatique chez Rouge ;
- version 2 → 3 après le coup Rouge ;
- application automatique chez Jaune.

### PROCHAINE ÉTAPE
Faire **uniquement** ce test minimal. En cas d'échec, diagnostiquer à partir du nouveau code de partie et de la version serveur avant toute nouvelle fonctionnalité.

### À NE PAS REFAIRE
- ne pas repartir de `KBTZXN` comme si c'était un test du nouveau correctif : c'est un incident historique antérieur ;
- ne pas remplacer la v4 Supabase par une vieille copie sans comparaison ;
- ne pas refactorer le moteur solo/IA pour résoudre ce problème ;
- ne pas ajouter classement/chat/Elo/tournoi avant validation de la synchronisation fondamentale.

## 15. Mise à jour autoritaire — 8 septembre 2026

> **Cette section décrit l'architecture actuelle et supplante les sections historiques 4, 8, 9 et 11 lorsqu'elles parlent de `push` ou de snapshots de gameplay. Les sections précédentes sont conservées comme historique des incidents et décisions.**

### Architecture actuelle

Le 1v1 a été migré vers un serveur réellement autoritaire :

`clic joueur → intention browser-safe → insect-play → noyau de règles serveur → update versionnée → Broadcast Realtime → get(version) → snapshot canonique → rendu`

Rôles des composants :
- `insect-match` : création/join/matchmaking/vote SP/`get` et **snapshot initial uniquement** ;
- `insect-play` : résolution de chaque action de gameplay ;
- `insect-rules-kernel.ts` : règles pures côté serveur ;
- `09-multiplayer-intent.js` : collecte l'intention sans muter l'état autoritaire ;
- `09-multiplayer-event-player.js` : joue visuellement l'événement accepté sans muter `G` ;
- `09-multiplayer-runtime.js` : état explicite de session, verrouillage d'entrée et perspective ;
- `12-multiplayer-realtime.js` : accélération/wakeup ; le `get` versionné reste la vérité et le filet de récupération ;
- `10-multiplayer-resume.js` : persiste seulement l'identité de session et restaure depuis le serveur.

Le polling est désormais **strictement en lecture après l'initialisation**. La CI échoue si `js/09-multiplayer.js` réintroduit un `push`, un export `commitState` ou un `commit_turn` de gameplay.

### Protection serveur déployée

Projet : `nczdadkyysrxxcsnsrrn`.

État vérifié le 8 septembre 2026 :
- `insect-match` **v6 ACTIVE**, `verify_jwt=false` ;
- `insect-play` **v1 ACTIVE**, `verify_jwt=false`.

Après présence de l'état initial :
- l'ancien `push` est refusé (`426`) ;
- `commit_turn` n'est plus un chemin de gameplay ;
- une action doit fournir la version de base exacte ;
- le siège authentifié détermine la couleur (`host=yellow`, `guest=red`) ;
- le serveur vérifie le joueur courant et la légalité de l'intention ;
- la mise à jour DB est conditionnée à la version courante ;
- deux actions concurrentes sur la même version ne peuvent pas être acceptées toutes les deux.

Les aléas de règle nécessaires, notamment le fallback de placement du Double Kill et les déclenchements SP, sont décidés côté serveur.

### Validation technique obtenue

La CI couvre runtime/perspective, syntaxe et frontière d'autorité cliente, règles pures et type-check des deux Edge Functions.

Un smoke test **contre les fonctions Supabase réellement déployées** a validé :
- initialisation `version 1` ;
- Rouge hors tour refusé ;
- deux actions Jaune concurrentes sur `version 1` → exactement une acceptée ;
- passage `version 1 → 2` ;
- action sur version périmée refusée ;
- action Rouge valide `version 2 → 3` ;
- ancien `push` refusé ;
- reconnexion avec récupération exacte du snapshot canonique ;
- Broadcast Realtime `state_changed` réellement reçu pour les versions **2 et 3**.

Dernier résultat live :

`LIVE_SMOKE_OK versions=1->2->3 realtime=2,3 wrong-turn=blocked double-action=single-winner stale=blocked legacy-push=blocked reconnect=canonical`

Cette preuve est une **validation technique du protocole déployé**, pas une validation UX sur deux appareils physiques.

### Perspective et identité online

Les coordonnées logiques de la partie ne changent jamais. La perspective est uniquement une projection d'affichage :
- Rouge conserve sa perspective naturelle en bas ;
- Jaune reçoit une projection locale qui place son camp en bas ;
- les insectes ne sont pas retournés par une rotation CSS globale ;
- le bandeau online distingue explicitement l'identité locale et le tour (`VOUS`, `À VOUS`, `ADVERSAIRE`).

Cette direction vient du test réel ordinateur + téléphone du 8 septembre, où le libellé générique `À vous` et l'absence de perspective locale créaient de la confusion.

### Niveau de preuve au 8 septembre 2026

- **Implémenté : OUI.**
- **Techniquement testé : OUI**, y compris HTTP, concurrence DB, reconnexion et Realtime déployé.
- **Vérifié après cette migration sur deux appareils physiques : NON.**
- **Robuste pour des joueurs externes : NON revendiqué.**

### Prochaine étape obligatoire

Faire un nouveau test minimal ordinateur + téléphone sur la version intégrant cette migration :
1. rechargement complet / attention au cache PWA ;
2. créer/rejoindre une nouvelle partie ;
3. vérifier l'identité locale `VOUS : JAUNE` / `VOUS : ROUGE` ;
4. vérifier que chacun voit son camp en bas ;
5. Rouge ne doit pouvoir effectuer aucune action avant le coup Jaune ;
6. Jaune joue un seul coup → serveur attendu `1 → 2` → Rouge voit automatiquement le coup ;
7. Rouge joue un seul coup → serveur attendu `2 → 3` → Jaune voit automatiquement le coup ;
8. aucune pièce locale ne doit « revenir en arrière » après synchronisation.

Seulement après ce succès, passer aux scénarios de robustesse : arrière-plan/veille, changement d'onglet, reload/PWA, reconnexion, double action, latence, abandon et fin de partie.
