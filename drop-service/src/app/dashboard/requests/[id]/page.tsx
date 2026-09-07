'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

type PhotoRow = {
  id: string
  storage_path: string
}

const statusLabels: Record<RequestRow['status'], string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  quote_sent: 'Devis envoyé',
  won: 'Gagné',
  lost: 'Perdu',
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [request, setRequest] = useState<RequestRow | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadRequest()
  }, [params.id])

  async function loadRequest() {
    setLoading(true)
    setError('')

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      router.replace('/login')
      return
    }

    const { data: requestData, error: requestError } = await supabase
      .from('drop_service_requests')
      .select('id, customer_name, phone, email, city, category, description, urgency, availability, status, created_at')
      .eq('id', params.id)
      .maybeSingle()

    if (requestError || !requestData) {
      setError('Demande introuvable ou non autorisée.')
      setLoading(false)
      return
    }

    setRequest(requestData as RequestRow)

    const { data: photos } = await supabase
      .from('drop_service_request_photos')
      .select('id, storage_path')
      .eq('request_id', params.id)
      .order('created_at', { ascending: true })

    const urls: string[] = []
    for (const photo of (photos ?? []) as PhotoRow[]) {
      const { data } = await supabase.storage
        .from('drop-service-request-photos')
        .createSignedUrl(photo.storage_path, 60 * 10)
      if (data?.signedUrl) urls.push(data.signedUrl)
    }
    setPhotoUrls(urls)
    setLoading(false)
  }

  async function updateStatus(status: RequestRow['status']) {
    if (!request) return
    const previous = request.status
    setRequest({ ...request, status })

    const { error: updateError } = await supabase
      .from('drop_service_requests')
      .update({ status })
      .eq('id', request.id)

    if (updateError) {
      setRequest({ ...request, status: previous })
      setError('Le changement de statut a échoué.')
    }
  }

  if (loading) return <main className="container"><p>Chargement…</p></main>

  if (!request) {
    return (
      <main className="container narrow stack">
        <p className="error card">{error || 'Demande introuvable.'}</p>
        <Link className="button-link secondary-link" href="/dashboard">Retour au tableau de bord</Link>
      </main>
    )
  }

  return (
    <main className="container stack">
      <div className="detail-nav">
        <Link href="/dashboard">← Retour aux demandes</Link>
      </div>

      <section className="card stack">
        <div className="request-topline">
          <div>
            <p className="eyebrow">Demande client</p>
            <h1 style={{ margin: 0 }}>{request.customer_name}</h1>
            <p>{request.city} · {request.category}</p>
          </div>
          <span className={`badge urgency-${request.urgency}`}>{request.urgency}</span>
        </div>

        <p>{request.description}</p>
        {request.availability ? <p><strong>Disponibilités :</strong> {request.availability}</p> : null}
        <p><strong>Téléphone :</strong> <a href={`tel:${request.phone}`}>{request.phone}</a></p>
        {request.email ? <p><strong>Email :</strong> <a href={`mailto:${request.email}`}>{request.email}</a></p> : null}
        <p className="muted">Reçue le {new Date(request.created_at).toLocaleString('fr-FR')}</p>

        <label>
          Statut
          <select value={request.status} onChange={(event) => updateStatus(event.target.value as RequestRow['status'])}>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Photos</h2>
        {photoUrls.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Aucune photo jointe à cette demande.</p>
        ) : (
          <div className="photo-grid">
            {photoUrls.map((url, index) => (
              <a href={url} target="_blank" rel="noreferrer" key={url}>
                <img src={url} alt={`Photo de la demande ${index + 1}`} />
              </a>
            ))}
          </div>
        )}
      </section>

      {error ? <p className="error card">{error}</p> : null}
    </main>
  )
}
