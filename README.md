# IN-SECT — L'Échiquier des Colonies

Jeu de stratégie web (PWA) : 4 colonies s'affrontent sur un plateau 9×9, chacune
menée par une Reine protégée par 8 pièces aux capacités distinctes. Victoire par
assassinat de la Reine adverse ou par encerclement.

## Structure du projet

```
index.html          Structure de l'application (écrans, modals, règles)
style.css           Styles principaux
tuto.css            Styles du tutoriel animé
tuto.js             Logique du tutoriel animé
manifest.json        Manifeste PWA (icône, couleurs, nom)
js/
  01-core.js         Constantes, état global, helpers, stats de partie
  02-audio-fx.js     Moteur audio (WebAudio), particules ambiantes et FX
  03-nav-menu.js     Navigation écrans/modals, sélection du mode de jeu
  04-board.js        Initialisation de partie, rendu du plateau et des pièces
  05-rules.js        Règles de mouvement, captures, Nid Sacré, encerclement, victoire
  06-ai.js           Moteur d'intelligence artificielle (3 niveaux)
  07-powers.js       Options de jeu et Super Pouvoirs
  08-boot.js         Musique de fond, démarrage de l'application
```

Les fichiers de `js/` sont des scripts classiques (pas de modules ES, pas de
bundler nécessaire) chargés dans l'ordre indiqué dans `index.html`. Ils
partagent un même scope global, exactement comme l'ancien fichier unique
`script.js` — le découpage est purement organisationnel, aucune logique n'a
été modifiée lors de la séparation.

## Déploiement

Le projet est statique : n'importe quel hébergement de fichiers statiques
fonctionne (GitHub Pages, Netlify, Vercel...). Aucune étape de build requise.

## Intelligence artificielle

Trois niveaux, sélectionnables avant la partie :

- **Basique** (`aiLevel1`) — heuristique simple, un seul coup à l'avance.
- **Tactique** (`aiLevel2`) — heuristique enrichie avec détection de menaces directes.
- **Expert** (`aiLevel3`) — minimax profondeur 3 avec élagage alpha :
  1. Évalue mon coup candidat.
  2. Anticipe les meilleures réponses de chaque adversaire vivant.
  3. Pour les réponses les plus dangereuses, recherche mon meilleur coup suivant
     — ce qui permet de détecter des combinaisons à 2-3 coups, pas seulement
     des menaces immédiates.
  4. Élague les coups qui ne peuvent plus battre le meilleur candidat déjà
     trouvé, ce qui libère du budget de calcul pour regarder plus loin ailleurs.

## Modèle économique

Le jeu est actuellement en accès libre et illimité, sans paywall actif (voir
l'en-tête de `js/01-core.js`). Aucun modèle de monétisation n'est imposé par
le code — pub, premium ou abonnement peuvent être branchés selon la stratégie
retenue.

## Licence / propriété

© 2026 IN-SECT — L'Échiquier des Colonies. Tous droits réservés.
Concept et code originaux — propriété de l'éditeur du projet.
