'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function normalizeSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [companyName, setCompanyName] = useState('')
  const [activity, setActivity] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [slug, setSlug] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void initialize()
  }, [])

  async function initialize() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      router.replace('/login')
      return
    }

    setUserId(data.user.id)
    setEmail(data.user.email ?? '')

    const { data: existing } = await supabase
      .from('drop_service_artisans')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (existing) {
      router.replace('/dashboard')
    }
  }

  function handleCompanyName(value: string) {
    setCompanyName(value)
    if (!slug || slug === normalizeSlug(companyName)) {
      setSlug(normalizeSlug(value))
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!userId) return

    setLoading(true)
    setError('')

    const cleanSlug = normalizeSlug(slug)
    if (cleanSlug.length < 2) {
      setLoading(false)
      setError('Choisissez une adresse publique d’au moins 2 caractères.')
      return
    }

    const { error } = await supabase.from('drop_service_artisans').insert({
      user_id: userId,
      company_name: companyName.trim(),
      activity: activity.trim(),
      service_area: serviceArea.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      slug: cleanSlug,
    })

    setLoading(false)

    if (error) {
      setError(error.code === '23505'
        ? 'Cette adresse publique est déjà utilisée. Choisissez-en une autre.'
        : 'Impossible de créer le profil artisan.')
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main className="container narrow">
      <p className="eyebrow">Première configuration</p>
      <h1>Créer votre espace artisan</h1>
      <p>Ces informations servent à générer votre page publique de réception des demandes.</p>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <label>
          Nom de l’entreprise
          <input value={companyName} onChange={(e) => handleCompanyName(e.target.value)} required minLength={2} maxLength={120} />
        </label>
        <label>
          Activité
          <input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Plomberie, chauffage…" required minLength={2} maxLength={120} />
        </label>
        <label>
          Zone d’intervention
          <input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="Brest et alentours" />
        </label>
        <label>
          Téléphone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </label>
        <label>
          Email professionnel
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
        <label>
          Adresse de la page publique
          <div className="slug-field"><span>/a/</span><input value={slug} onChange={(e) => setSlug(normalizeSlug(e.target.value))} required /></div>
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={loading || !userId}>{loading ? 'Création…' : 'Créer mon espace'}</button>
      </form>
    </main>
  )
}
