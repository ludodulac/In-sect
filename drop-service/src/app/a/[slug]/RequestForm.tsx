'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function RequestForm({ artisanId, companyName }: { artisanId: string; companyName: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const payload = {
      artisan_id: artisanId,
      customer_name: String(form.get('customer_name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim() || null,
      city: String(form.get('city') ?? '').trim(),
      category: String(form.get('category') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      urgency: String(form.get('urgency') ?? 'normal'),
      availability: String(form.get('availability') ?? '').trim() || null
    }

    const supabase = createClient()
    const { error: insertError } = await supabase.from('drop_service_requests').insert(payload)

    if (insertError) {
      setError('Impossible d’envoyer la demande pour le moment. Réessayez dans quelques instants.')
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)
    event.currentTarget.reset()
  }

  if (success) {
    return (
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Demande envoyée</h2>
        <p className="success" style={{ margin: 0 }}>
          Votre demande a bien été transmise à {companyName}. L’entreprise pourra vous recontacter avec les informations fournies.
        </p>
        <button type="button" onClick={() => setSuccess(false)}>Envoyer une autre demande</button>
      </div>
    )
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h2 style={{ margin: 0 }}>Décrivez votre besoin</h2>

      <label>
        Nom
        <input name="customer_name" required minLength={2} maxLength={120} autoComplete="name" />
      </label>

      <label>
        Téléphone
        <input name="phone" required minLength={6} maxLength={40} autoComplete="tel" inputMode="tel" />
      </label>

      <label>
        Email (facultatif)
        <input name="email" type="email" autoComplete="email" />
      </label>

      <label>
        Commune
        <input name="city" required maxLength={120} autoComplete="address-level2" />
      </label>

      <label>
        Type de besoin
        <input name="category" required maxLength={120} placeholder="Ex. fuite, panne, remplacement..." />
      </label>

      <label>
        Description
        <textarea name="description" required minLength={5} maxLength={4000} placeholder="Expliquez le problème le plus précisément possible." />
      </label>

      <label>
        Urgence
        <select name="urgency" defaultValue="normal">
          <option value="low">Peut attendre</option>
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>

      <label>
        Disponibilités (facultatif)
        <input name="availability" placeholder="Ex. mardi après 17h" />
      </label>

      {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
      <button disabled={submitting} type="submit">{submitting ? 'Envoi…' : 'Envoyer la demande'}</button>
    </form>
  )
}
