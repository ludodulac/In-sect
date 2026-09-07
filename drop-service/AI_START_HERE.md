# AI START HERE — DROP SERVICE

Ce dossier contient le micro-SaaS destiné aux artisans. Il partage le dépôt GitHub et le projet Supabase avec IN-SECT, mais il doit rester strictement isolé du jeu.

## Produit

Objectif : permettre à un artisan (plombier, chauffagiste, électricien, puis autres métiers) de recevoir des demandes clients structurées lorsqu'il ne peut pas répondre immédiatement.

Parcours V1 :
1. un prospect ouvre la page publique de l'artisan ;
2. il décrit son besoin, renseigne ses coordonnées, commune, urgence et disponibilités ;
3. la demande est enregistrée ;
4. l'artisan se connecte à son espace ;
5. il traite la demande dans les statuts `new`, `contacted`, `quote_sent`, `won`, `lost`.

## Périmètre V1

Construire seulement : page publique artisan, formulaire, confirmation, authentification artisan, dashboard, fiche demande, changement de statut, isolation multi-clients et responsive mobile.

Ne pas ajouter sans validation commerciale : WhatsApp API, SMS payants, CRM externe, Make, chatbot IA complexe, calendrier avancé, génération de devis, paiement, application mobile native ou automatisations coûteuses.

## Architecture

- application : Next.js + TypeScript dans ce dossier ;
- backend : projet Supabase IN-SECT `nczdadkyysrxxcsnsrrn` ;
- tables : `public.drop_service_artisans` et `public.drop_service_requests` ;
- ne jamais toucher aux tables `insect_*` pour une tâche Drop Service ;
- RLS obligatoire sur toute table exposée ;
- utiliser uniquement une clé Supabase publishable côté navigateur, jamais de `service_role`/secret.

## Modèle de données actuel

`drop_service_artisans` : profil entreprise lié à `auth.users`, slug public, activité, zone, coordonnées, activation.

`drop_service_requests` : artisan, prospect, téléphone/email, commune, catégorie, description, urgence, disponibilités, statut, dates.

Les photos ne sont pas encore implémentées : ne pas ouvrir un bucket d'upload public sans définir précisément la sécurité et l'anti-abus.

## Règles de développement

1. Préserver le jeu IN-SECT.
2. Une seule base de code multi-clients.
3. Aucun outil payant ou API payante nécessaire à la V1.
4. Mobile-first pour le parcours artisan.
5. Toute nouvelle fonctionnalité doit répondre à un retour client ou être indispensable au parcours V1.
6. Vérifier RLS et isolation entre artisans après toute modification de schéma.
7. Documenter les décisions durables ici ou dans le README.

## Prochaine étape

Brancher la page publique et le formulaire sur Supabase, puis construire l'authentification et le dashboard réel.
