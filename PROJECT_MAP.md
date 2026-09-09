# IN-SECT — carte de navigation

Commencer par `AI_START_HERE.md`. Ne charger que la couche correspondant au problème.

## Jeu / règles

Vérifier le code et les tests qui décident l'état, les actions légales et leurs conséquences. Le moteur décide ; l'interface représente.

## Multijoueur

- `MULTIPLAYER_ARCHITECTURE.md` — architecture cible/contrats du multijoueur.
- `MULTIPLAYER_HANDOFF.md` — état opérationnel à revérifier contre code, Supabase et tests.
- `MULTIPLAYER_TRANSFORMATION_PLAN.md` — plan de transformation, pas preuve que chaque étape est déployée.

Frontière à préserver :
`intention locale → validation serveur → événement autoritaire accepté → application sur les deux clients → animation → snapshot résultant`.

Les snapshots servent à l'initialisation, reconnexion et récupération ; ils ne doivent pas remplacer silencieusement la causalité des événements pendant la partie.

## Produit / marketing

- `PRODUCT_MARKETING.md` — réflexion produit/audience/marketing ; ne pas l'utiliser comme contrat technique.

## Attention structurelle

Le répertoire `drop-service/` présent dans ce dépôt appartient à un historique/une contamination de projet. Ne jamais le traiter comme la cible IN-SECT et ne pas le nettoyer sans besoin explicite et vérification préalable.
