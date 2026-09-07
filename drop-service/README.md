# Drop Service — Assistant Demandes & Devis

Micro-SaaS pour artisans, isolé dans le dépôt IN-SECT.

## But

Aider les artisans à recevoir des demandes clients complètes et organisées lorsqu'ils sont sur chantier ou indisponibles au téléphone.

## V1

- page publique par artisan via slug ;
- formulaire prospect ;
- connexion artisan ;
- dashboard des demandes ;
- fiche demande ;
- statuts : Nouveau → Contacté → Devis envoyé → Gagné / Perdu ;
- isolation stricte des données entre artisans ;
- interface mobile-first.

## Stack

- Next.js 15
- React 19
- TypeScript
- Supabase Auth + Postgres

Projet Supabase partagé avec le jeu IN-SECT : `nczdadkyysrxxcsnsrrn`.

Objets Drop Service :
- `public.drop_service_artisans`
- `public.drop_service_requests`

Ne jamais utiliser ou modifier les tables `insect_*` depuis cette application.

## Démarrage local

```bash
cd drop-service
cp .env.example .env.local
npm install
npm run dev
```

Renseigner dans `.env.local` la clé publishable Supabase du projet IN-SECT.

## Règle produit

Ne pas transformer la V1 en gros SaaS avant validation terrain. Les photos, notifications avancées, IA, SMS, WhatsApp, calendrier, devis et paiement sont des extensions futures, pas des dépendances de lancement.

Voir `AI_START_HERE.md` avant toute modification substantielle.
