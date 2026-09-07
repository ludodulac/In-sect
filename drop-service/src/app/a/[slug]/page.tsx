import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'
import { RequestForm } from './RequestForm'

export default async function ArtisanPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: artisan, error } = await supabase
    .from('drop_service_artisans')
    .select('id, company_name, activity, service_area, phone, email, logo_url')
    .eq('slug', slug)
    .single()

  if (error || !artisan) notFound()

  return (
    <main style={{ padding: '32px 0 56px' }}>
      <div className="stack" style={{ gap: 20 }}>
        <section className="card stack">
          <p className="muted" style={{ margin: 0 }}>Demande en ligne</p>
          <h1 style={{ margin: 0 }}>{artisan.company_name}</h1>
          <p style={{ margin: 0 }}>{artisan.activity}</p>
          {artisan.service_area ? <p className="muted" style={{ margin: 0 }}>Zone d’intervention : {artisan.service_area}</p> : null}
        </section>

        <RequestForm artisanId={artisan.id} companyName={artisan.company_name} />
      </div>
    </main>
  )
}
