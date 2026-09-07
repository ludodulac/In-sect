# Projets du dépôt

Ce dépôt contient désormais **deux projets indépendants**.

## 1. IN-SECT — jeu vidéo

Le jeu historique reste à la racine du dépôt (`index.html`, `js/`, assets, fichiers multijoueur et dossier `supabase/`). Son architecture et ses invariants sont documentés dans `AI_START_HERE.md`, `README.md` et `MULTIPLAYER_HANDOFF.md`.

## 2. Drop Service — micro-SaaS pour artisans

La nouvelle application est isolée dans `drop-service/`.

Règle absolue : une tâche concernant Drop Service ne doit pas modifier le jeu, et une tâche concernant le jeu ne doit pas modifier `drop-service/`, sauf besoin transversal explicitement demandé.

Les deux projets utilisent le même projet Supabase IN-SECT mais avec des objets séparés :
- jeu : objets préfixés `insect_...` ;
- Drop Service : objets préfixés `drop_service_...`.

Pour travailler sur Drop Service, commencer par `drop-service/AI_START_HERE.md`.
