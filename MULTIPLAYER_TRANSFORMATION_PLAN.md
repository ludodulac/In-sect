# IN-SECT — stratégie de transformation multijoueur

Date : 2026-09-02

## Objectif

Faire évoluer le multijoueur actuel, fiable mais basé sur polling HTTP, vers une expérience réactive et tolérante aux interruptions mobiles, sans toucher au comportement solo/IA.

## Principes d'architecture

1. **Le serveur reste autoritaire.** `insect-match` + `insect_matches.version` restent la vérité pour les tours validés.
2. **Realtime accélère, il ne remplace pas la vérité serveur.** Broadcast sert aux signaux éphémères et à réveiller immédiatement le client adverse ; le `get` versionné reste le mécanisme de récupération/rattrapage.
3. **Une perte de connexion n'est pas un abandon.** Une partie active doit survivre à un onglet mobile suspendu. Au retour, le client récupère l'état serveur courant.
4. **Matchmaking et partie active ont des politiques de présence différentes.** Le heartbeat court reste pertinent dans la file d'attente ; il ne doit pas détruire une partie déjà commencée.
5. **Solo/IA intouchés.** Toute nouvelle logique reste dans la couche `09-multiplayer*` ou le backend multijoueur.

## Phases

### Phase 1 — reprise de session / mobile background (priorité bloquante)

- Conserver localement, uniquement sur l'appareil, le code de partie, le secret de siège, le rôle et la couleur locale pendant une partie active.
- Au chargement ou au retour au premier plan, tenter un `get` avec ces identifiants avant de renvoyer l'utilisateur au menu.
- Si la partie est toujours active, restaurer le dernier état serveur et reprendre le polling.
- Ne supprimer cette session locale que lors d'une fin de partie confirmée, d'un abandon explicite ou d'une réponse serveur indiquant que la partie n'est plus récupérable.
- Afficher un état simple `Reconnexion…` / `Reconnecté` plutôt que d'annuler silencieusement.

Critère : téléphone en arrière-plan 30–60 s, puis retour => même partie et état serveur courant.

### Phase 2 — transport Realtime hybride

- Charger `supabase-js` uniquement pour le multijoueur.
- Ouvrir un canal Broadcast propre au code de partie après authentification logique par le secret de siège côté API actuelle.
- Au `push` validé, diffuser un petit événement `state_changed` contenant au minimum la nouvelle version.
- À réception, lancer immédiatement `get(since=lastVersion)` puis `applyState`.
- Garder le polling, mais le ralentir et le considérer comme filet de sécurité / reconnexion.

Critère : Jaune joue => version N+1 => Rouge récupère/applique sans attendre le prochain poll ; puis inversement.

### Phase 3 — signaux visuels éphémères

- Broadcast `piece_selected` / `piece_unselected` avec identifiant de pièce et couleur.
- Ces événements ne modifient jamais l'état officiel et peuvent être perdus sans conséquence.
- Le client adverse montre la sélection rapidement, sans lui donner le droit de jouer avant réception de l'état serveur validé.

Critère : la sélection adverse devient perceptible quasi immédiatement, sans désynchroniser les règles.

### Phase 4 — journal de coups léger

- Ajouter un journal append-only des coups validés avec numéro de version/tour, rôle, action minimale et horodatage.
- Le snapshot `state` reste la récupération rapide ; le journal sert au diagnostic et prépare un replay futur.
- Aucun écran de replay n'est développé tant que la synchronisation/reconnexion n'est pas validée.

Critère : une partie problématique peut être diagnostiquée par sa séquence de coups sans dépendre du dernier snapshot.

## Garde-fous

- Pas de service-role dans le navigateur.
- Pas de modification du schéma `realtime` ; utiliser les APIs/policies supportées par Supabase.
- Pas de suppression du polling avant plusieurs tests réels téléphone/tablette.
- Pas de refactor des règles, de l'IA ou du rendu historique pour résoudre un problème réseau.
- Chaque phase doit être testable et réversible indépendamment.

## Première transformation engagée

Une branche `multiplayer-resume-foundation` part du `main` vérifié. La configuration multijoueur y expose désormais l'URL Supabase et la clé **publishable** publique nécessaires au futur client Realtime ; aucune clé privilégiée n'est exposée et aucun comportement de jeu n'est encore modifié.
