# AI START HERE — IN-SECT

Point d’entrée obligatoire pour tout agent IA reprenant IN-SECT.

## Contexte transversal

IN-SECT appartient à l'écosystème **`ludodulac/Grand-pere`**. Grand Père est documenté dans le dépôt `ludodulac/Grand-pere`. En nouvelle conversation : lire Grand Père `AI_START_HERE.md`, la fiche IN-SECT via `projects/_INDEX.md` et `LOOP_ENGINEERING.md`, puis revenir ici. **IN-SECT reste la vérité sur règles, code, backend multijoueur et état déployé.**

## Comprendre avant de modifier

1. vérifier `main`, changements/issues/PR/CI pertinents ;
2. utiliser `PROJECT_MAP.md` ;
3. multijoueur → lire `MULTIPLAYER_HANDOFF.md` et contrats concernés ;
4. joueur/produit/marketing → lire `PRODUCT_MARKETING.md` ;
5. vérifier `index.html` et l'ordre réel des scripts ;
6. inspecter seulement les fichiers concernés.

Le dépôt contient `drop-service/`, sous-projet/historique indépendant. Ne jamais le traiter comme cible IN-SECT ni le nettoyer sans besoin explicite.

## Identité / invariants

Jeu de stratégie 9×9 jusqu'à quatre colonies. Les règles, actions légales et état canonique appartiennent au moteur ; la présentation les représente. Une modification de règle doit considérer IA/tutoriel/rendu/options lorsqu'ils sont concernés.

## Multijoueur

Frontière à préserver : `intention locale → validation serveur → événement autoritaire accepté → application clients → animation → snapshot résultant`.

Les snapshots servent à initialisation/reconnexion/récupération ; ils ne remplacent pas silencieusement la causalité des événements en cours de partie. Toujours distinguer implémenté / testé techniquement / vérifié sur deux appareils / robuste pour joueurs extérieurs.

## Boucle

`objectif joueur → état réel → plus petit écart → première couche règles/serveur/synchronisation/rendu responsable → correction minimale → preuve → CONTINUE/PIVOT/STOP`.

Ne pas modifier une règle pour résoudre un problème visuel et ne pas affaiblir solo/IA pour simplifier le multijoueur.

## Passation

Les apprentissages produit/marketing durables vont dans leur source locale. La prochaine conversation doit retrouver **objectif / dernière boucle / preuve / prochaine décision** sans lire tout le dépôt.
