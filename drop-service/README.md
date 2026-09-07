# Drop Service — Assistant Demandes & Devis

Micro-SaaS pour artisans, isolé dans le dépôt IN-SECT.

## But

Aider les artisans à recevoir des demandes clients complètes et organisées lorsqu'ils sont sur chantier ou indisponibles au téléphone.

## V1 actuelle

- page publique par artisan via slug ;
- formulaire prospect ;
- ajout de 3 photos maximum par demande ;
- stockage privé des photos dans Supabase Storage ;
- création de compte et connexion artisan ;
- onboarding entreprise ;
- dashboard des demandes ;
- fiche détaillée d'une demande ;
- statuts : Nouveau → Contacté → Devis envoyé → Gagné / Perdu ;
- isolation stricte des données entre artisans ;
- interface mobile-first.

## Stack

- Next.js 15
- React 19
- TypeScript
- Supabase Auth + Postgres + Storage

Projet Supabase partagé avec le jeu IN-SECT : `nczdadkyysrxxcsnsrrn`.

Objets Drop Service :
- `public.drop_service_artisans`
- `public.drop_service_requests`
- `public.drop_service_request_photos`
- bucket privé `drop-service-request-photos`

Ne jamais utiliser ou modifier les tables `insect_*` depuis cette application.

## Démarrage local

```bash
cd drop-service
cp .env.example .env.local
npm install
npm run dev
```

Renseigner dans `.env.local` la clé publishable Supabase du projet IN-SECT.

## Déploiement Vercel

Le dépôt contient aussi le jeu IN-SECT à la racine. Drop Service doit donc être déployé comme un projet Vercel indépendant avec :

- dépôt GitHub : `ludodulac/In-sect`
- Root Directory : `drop-service`
- Framework Preset : Next.js
- Build Command : valeur par défaut
- Output Directory : valeur par défaut

Variables d'environnement Vercel :

```text
NEXT_PUBLIC_SUPABASE_URL=https://nczdadkyysrxxcsnsrrn.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<clé publishable Supabase>
```

Ne jamais ajouter de clé `service_role` ou de clé secrète dans une variable `NEXT_PUBLIC_*`.

## Validation avant pilotes réels

Avant d'envoyer beaucoup de trafic sur le formulaire public :
- ajouter une protection anti-spam / rate limiting ;
- tester inscription, connexion et déconnexion ;
- tester création de profil artisan ;
- tester une demande avec et sans photos sur mobile ;
- vérifier qu'un artisan ne peut jamais lire les demandes ou photos d'un autre artisan.

## Règle produit

Ne pas transformer la V1 en gros SaaS avant validation terrain. Notifications avancées, IA, SMS, WhatsApp, calendrier, devis et paiement restent des extensions futures, pas des dépendances de lancement.

Voir `AI_START_HERE.md` avant toute modification substantielle.
