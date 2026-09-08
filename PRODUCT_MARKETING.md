# IN-SECT — Mémoire produit & marketing

Date de création : 2026-09-08

> Source canonique durable pour la connaissance produit/marketing d’IN-SECT. Ce document ne remplace ni `AI_START_HERE.md` (architecture/invariants), ni `MULTIPLAYER_HANDOFF.md` (passation multijoueur), ni les règles du jeu. Il conserve ce que nous savons — et distingue explicitement ce qui reste à apprendre.

## 1. Discipline de preuve

Toute affirmation sur le marché ou les joueurs doit être classée :

- **HYPOTHÈSE** — intuition à tester ;
- **OBSERVATION** — comportement constaté pendant un test, sans généralisation ;
- **RETOUR JOUEUR** — déclaration explicite d’un joueur ;
- **COMPORTEMENT MESURÉ** — donnée instrumentée avec contexte/échantillon ;
- **CONCLUSION CONFIRMÉE** — convergence de plusieurs sources suffisantes pour guider durablement le produit.

Ne jamais transformer une hypothèse ou un cas isolé en vérité de marché.

## 2. Positionnement actuel

### Ce qui est établi sur le produit

IN-SECT est un jeu de stratégie sur plateau 9×9 opposant des colonies menées par des Reines. Le système comprend notamment huit types de pièces aux capacités distinctes, l’encerclement, des cadavres persistants qui modifient le champ de bataille, des effets de manipulation/poussée, le Nid Sacré et des Super Pouvoirs.

Le jeu ne doit pas être réduit à « des échecs avec des insectes » : cette formule masque plusieurs mécaniques structurantes et n’est pas retenue comme positionnement canonique.

### HYPOTHÈSE FORTE DE POSITIONNEMENT

Une guerre tactique où **même les morts continuent d’influencer le champ de bataille**.

Cette piste est conservée comme hypothèse forte parce que les cadavres persistants donnent au terrain une mémoire des affrontements et peuvent rendre le concept racontable. Elle n’est pas encore considérée comme slogan définitif ni comme bénéfice confirmé par des joueurs.

## 3. Promesse produit à explorer

**HYPOTHÈSE** — Proposer une confrontation tactique profonde dans laquelle les rôles des pièces sont très identifiables, les décisions transforment durablement le terrain et une partie crée progressivement sa propre géographie stratégique.

Le niveau de complexité souhaité doit venir des décisions, pas de la manipulation de l’interface.

## 4. Publics — état de connaissance

### Joueur principal

**INCONNU / À ÉTABLIR.** Aucun persona principal ne doit être déclaré tant que des tests joueurs et/ou comportements mesurés ne permettent pas de le défendre.

### Profils à tester

Ce sont uniquement des **HYPOTHÈSES** de recrutement pour les tests :

- joueurs de jeux de stratégie abstraite/tactique qui apprécient la maîtrise progressive ;
- joueurs de jeux de plateau modernes attirés par des rôles asymétriques ou capacités distinctes ;
- joueurs mobile/web recherchant des parties tactiques 1v1 accessibles sans installation lourde ;
- joueurs attirés par un univers de colonies/insectes et par des situations de bataille émergentes.

À documenter pour chaque profil : jeux déjà pratiqués, déclencheur d’essai, compréhension du concept, plaisir réel, raisons de rejouer ou d’abandonner.

## 5. Éléments différenciants à tester auprès des joueurs

Ne pas confondre originalité interne et valeur perçue. Tester notamment :

- plateau 9×9 ;
- colonies et Reines ;
- huit types de pièces aux capacités différentes ;
- encerclement ;
- cadavres persistants modifiant le champ de bataille ;
- manipulation/poussée ;
- Nid Sacré ;
- Super Pouvoirs ;
- rôles très identifiables des pièces.

Pour chaque élément, chercher : compréhension immédiate, intérêt déclaré, usage réel, contribution aux décisions, mémorisation après la partie et capacité à donner envie d’en parler.

## 6. Références / concurrents

**CONNAISSANCE MANQUANTE.** Aucune liste de concurrents ou de références ne doit être présentée comme validée à ce stade.

À construire à partir de deux sources distinctes :
1. références structurelles utiles à l’équipe (mécaniques, onboarding, 1v1, lisibilité mobile) ;
2. jeux réellement cités ou pratiqués par les joueurs testés.

La seconde source est plus importante pour comprendre le marché perçu.

## 7. Questions produit prioritaires

Nous devons pouvoir répondre progressivement, avec niveau de preuve :

- Qui est le joueur principal d’IN-SECT ?
- Quels autres profils pourraient aimer le jeu ?
- À quels jeux jouent-ils déjà ?
- Qu’est-ce qui leur donne envie d’essayer IN-SECT ?
- Quelle sensation ou expérience IN-SECT apporte-t-il que leurs autres jeux apportent moins bien ?
- Qu’est-ce qui est immédiatement compréhensible et partageable dans le concept ?
- Qu’est-ce qui donne envie de refaire une partie ?
- Qu’est-ce qui crée de la maîtrise à long terme ?
- Quelles caractéristiques sont réellement différenciantes aux yeux des joueurs ?
- Quels éléments sont difficiles à comprendre ou repoussent les nouveaux joueurs ?

## 8. Tests joueurs : protocole produit minimal

La priorité technique reste de valider le vrai 1v1. Dès qu’une partie réelle est utilisée comme test produit, noter le contexte sans perturber la partie : type d’appareil, nouveau joueur ou non, familiarité avec les jeux de stratégie, mode utilisé et Super Pouvoirs activés ou non.

### Questions auxquelles les métriques doivent répondre

- **Arrive-t-on jusqu’au jeu ?** arrivée jusqu’à la première partie, parties commencées.
- **L’entrée en jeu est-elle compréhensible ?** durée avant première action, incompréhensions initiales, recours aux règles/tutoriel.
- **La boucle tient-elle ?** parties terminées, abandons, durée des parties.
- **Le système est-il utilisé/compris ?** utilisation des Super Pouvoirs, incompréhensions récurrentes, actions interdites mal comprises.
- **Le jeu donne-t-il envie de continuer ?** revanche/rejouer, envie déclarée de rejouer.
- **Quel mode répond au besoin ?** préférence et usage solo/multijoueur.

Ne collecter une métrique que si elle répond à une question produit explicite. Documenter la définition exacte de l’événement avant d’en tirer une conclusion.

## 9. Journal des apprentissages joueurs

Ajouter les résultats futurs sous la forme :

### AAAA-MM-JJ — Test / cohorte
- Contexte :
- Niveau de preuve : OBSERVATION / RETOUR JOUEUR / COMPORTEMENT MESURÉ
- Ce qui s’est passé :
- Frictions :
- Ce qui a créé du plaisir/tension :
- Rejouer/revanche :
- Citation courte éventuelle :
- Hypothèse renforcée/affaiblie :
- Décision éventuelle :
- À retester :

### 2026-09-08 — 1v1 réel ordinateur + téléphone
- Contexte : test multijoueur réel ; Jaune sur ordinateur, Rouge sur téléphone.
- Niveau de preuve : **OBSERVATION + RETOUR JOUEUR**.
- Ce qui s’est passé : avant le premier coup Jaune confirmé par le serveur, le joueur Rouge pouvait déplacer localement ses pièces alors que ce n’était pas son tour ; après synchronisation du coup Jaune, ces déplacements provisoires disparaissaient et les pièces rouges revenaient à l’état serveur.
- Friction de compréhension : les deux appareils affichaient initialement `Tour de la colonie Jaune — À vous`, ce qui a fait croire au joueur Rouge que c’était son tour. Une fois la partie réellement synchronisée, la couleur du tour était compréhensible mais la mention générique `À vous` restait trompeuse.
- Friction d’identité/orientation : le joueur doit savoir immédiatement quelle colonie il contrôle et se percevoir depuis son propre camp. Pour le 1v1 multijoueur, chaque appareil doit présenter sa colonie locale en bas du plateau, à la manière d’une perspective personnelle plutôt que d’un plateau identique sur les deux écrans.
- Décision : verrouiller toute entrée multijoueur avant réception de l’état serveur initial et hors tour local ; afficher explicitement `VOUS : JAUNE/ROUGE`, distinguer `À VOUS` et `ADVERSAIRE`, et orienter le plateau 1v1 pour placer la colonie locale en bas.
- À retester : vérifier sur les deux appareils que Rouge ne peut plus déplacer avant le premier coup Jaune ; vérifier que Jaune voit son camp en bas sur son appareil et Rouge son camp en bas sur le sien ; vérifier alternance version serveur et application automatique.

## 10. Décisions produit/marketing durables

### 2026-09-08 — Fiabilité avant expansion sociale
**Décision :** fermer le vrai 1v1 et améliorer la boucle de jeu avant Elo, tournoi, chat ou système social complexe.

**Pourquoi :** les fonctions de méta-jeu ne compensent pas une partie fondamentale qui ne se synchronise pas ou n’est pas comprise.

### 2026-09-08 — UX : profondeur par les décisions
**Décision :** viser une manipulation très simple ; conserver la profondeur dans les choix tactiques plutôt que dans l’interface.

### 2026-09-08 — Identité locale en multijoueur
**Décision :** en multijoueur, l’interface doit distinguer la vérité du tour de l’identité du joueur. L’état partagé peut contenir plusieurs joueurs humains, mais `À VOUS` ne doit apparaître que si la couleur courante correspond à la couleur locale. Le joueur doit voir explicitement sa couleur et, en 1v1, son camp depuis le bas du plateau.

**Direction future 4 joueurs :** conserver le principe d’une perspective personnelle ; l’objectif exprimé est que le joueur local soit présenté depuis le bas/droite. À concevoir et tester au moment du vrai multijoueur 4 joueurs, sans modifier maintenant le mode 3 IA historique.

### 2026-09-08 — Marketing fondé sur les preuves
**Décision :** maintenir explicitement les niveaux HYPOTHÈSE / OBSERVATION / RETOUR JOUEUR / COMPORTEMENT MESURÉ / CONCLUSION CONFIRMÉE.

## 11. Idées rejetées ou non prioritaires

- « Échecs avec des insectes » comme réduction canonique du produit — rejeté comme trop réducteur.
- Elo, tournoi, chat, système social complexe avant fiabilité du 1v1 — non prioritaire.
- Instrumentation exhaustive « parce qu’on peut la mesurer » — rejetée ; chaque métrique doit répondre à une question.
- Refonte arbitraire de l’identité visuelle existante — rejetée ; améliorer progressivement ce qui pose une friction démontrée.

## 12. Questions ouvertes immédiates

1. Le scénario 1v1 minimal est-il réellement fiable sur deux appareils après les derniers correctifs ?
2. Où les nouveaux joueurs hésitent-ils pendant leur premier tour ?
3. Savent-ils immédiatement qui joue et ce qu’une pièce sélectionnée peut faire ?
4. Quelles mécaniques retiennent-ils spontanément après une partie ?
5. Les cadavres persistants sont-ils perçus comme une vraie source de stratégie et une signature mémorable ?
6. Qu’est-ce qui déclenche concrètement une revanche ?
7. Quels jeux les testeurs considèrent-ils eux-mêmes comme les alternatives à IN-SECT ?
