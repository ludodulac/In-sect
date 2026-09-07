import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="container">
      <section className="card stack">
        <p className="eyebrow">Drop Service — V1</p>
        <h1 style={{ margin: 0 }}>Assistant Demandes & Devis</h1>
        <p style={{ margin: 0 }}>
          Une application simple pour permettre aux artisans de recevoir des demandes clients complètes,
          organisées et exploitables même lorsqu'ils sont sur chantier.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          La V1 comprend maintenant la page publique artisan, l'enregistrement des demandes, la création de compte,
          l'onboarding et le tableau de bord avec suivi des statuts.
        </p>
        <div className="home-actions">
          <Link className="button-link" href="/signup">Créer un espace artisan</Link>
          <Link className="button-link secondary-link" href="/login">Se connecter</Link>
        </div>
      </section>
    </main>
  )
}
