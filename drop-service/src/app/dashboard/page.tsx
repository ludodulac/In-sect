'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Artisan = {
  id: string
  company_name: string
  slug: string
}

type RequestRow = {
  id: string
  customer_name: string
  phone: string
  email: string | null
  city: string
  category: string
  description: string
  urgency: 'low' | 'normal' | 'urgent'
  availability: string | null
  status: 'new' | 'contacted' | 'quote_sent' | 'won' | 'lost'
  created_at: string
}

const statusLabels: Record<RequestRow['status'], string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  quote_sent: 'Devis envoyé',
  won: 'Gagné',
  lost: 'Perdu',
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [artisan, setArtisan] = useState<Artisan | null>(null)
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setError('')

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      router.replace('/login')
      return
    }

    const { data: artisanData, error: artisanError } = await supabase
      .from('drop_service_artisans')
      .select('id, company_name, slug')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (artisanError) {
      setError('Impossible de charger le profil artisan.')
      setLoading(false)
      return
    }

    if (!artisanData) {
      router.replace('/onboarding')
      return
    }

    setArtisan(artisanData)

    const { data: requestData, error: requestError } = await supabase
      .from('drop_service_requests')
      .select('id, customer_name, phone, email, city, category, description, urgency, availability, status, created_at')
      .eq('artisan_id', artisanData.id)
      .order('created_at', { ascending: false })

    if (requestError) {
      setError('Impossible de charger les demandes.')
    } else {
      setRequests((requestData ?? []) as RequestRow[])
    }

    setLoading(false)
  }

  async function updateStatus(id: string, status: RequestRow['status']) {
    const previous = requests
    setRequests((current) => current.map((request) => request.id === id ? { ...request, status } : request))

    const { error } = await supabase
      .from('drop_service_requests')
      .update({ status })
      .eq('id', id)

    if (error) {
      setRequests(previous)
      setError('Le changement de statut a échoué.')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  if (loading) {
    return <main className="container"><p>Chargement…</p></main>
  }

  return (
    <main className="container">
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">Tableau de bord artisan</p>
          <h1>{artisan?.company_name ?? 'Espace artisan'}</h1>
          {artisan ? <p>Page publique : <a href={`/a/${artisan.slug}`}>/a/{artisan.slug}</a></p> : null}
        </div>
        <button className="secondary" onClick={signOut}>Se déconnecter</button>
      </div>

      {error ? <p className="error card">{error}</p> : null}

      {requests.length === 0 ? (
        <section className="card">
          <h2>Aucune demande pour le moment</h2>
          <p>Les nouvelles demandes envoyées depuis votre page publique apparaîtront ici.</p>
        </section>
      ) : (
        <section className="request-grid">
          {requests.map((request) => (
            <article className="card request-card" key={request.id}>
              <div className="request-topline">
                <div>
                  <strong>{request.customer_name}</strong>
                  <p>{request.city} · {request.category}</p>
                </div>
                <span className={`badge urgency-${request.urgency}`}>{request.urgency}</span>
              </div>

              <p>{request.description}</p>
              {request.availability ? <p><strong>Disponibilités :</strong> {request.availability}</p> : null}
              <p><a href={`tel:${request.phone}`}>{request.phone}</a>{request.email ? <> · <a href={`mailto:${request.email}`}>{request.email}</a></> : null}</p>
              <p className="muted">Reçue le {new Date(request.created_at).toLocaleString('fr-FR')}</p>

              <label>
                Statut
                <select value={request.status} onChange={(event) => updateStatus(request.id, event.target.value as RequestRow['status'])}>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
