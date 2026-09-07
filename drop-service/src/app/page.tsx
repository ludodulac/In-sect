export default function HomePage() {
  return (
    <main style={{ padding: '48px 0' }}>
      <section className="card stack">
        <p className="muted" style={{ margin: 0 }}>Drop Service — V1</p>
        <h1 style={{ margin: 0 }}>Assistant Demandes & Devis</h1>
        <p style={{ margin: 0 }}>
          Une application simple pour permettre aux artisans de recevoir des demandes clients complètes,
          organisées et exploitables même lorsqu'ils sont sur chantier.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Première brique implémentée : page publique artisan et enregistrement des demandes dans Supabase.
          Le dashboard authentifié arrive ensuite.
        </p>
      </section>
    </main>
  )
}
