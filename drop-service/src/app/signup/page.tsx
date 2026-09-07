'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      setError(error.message.includes('already')
        ? 'Un compte existe déjà avec cet email.'
        : 'Impossible de créer le compte pour le moment.')
      return
    }

    if (data.session) {
      router.replace('/onboarding')
      router.refresh()
      return
    }

    setMessage('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.')
  }

  return (
    <main className="container narrow">
      <p className="eyebrow">Créer un compte</p>
      <h1>Ouvrir votre espace artisan</h1>
      <p>Après création du compte, vous pourrez configurer votre page publique et recevoir vos premières demandes.</p>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        <button type="submit" disabled={loading}>{loading ? 'Création…' : 'Créer mon compte'}</button>
        <p className="muted">Déjà inscrit ? <Link href="/login">Se connecter</Link></p>
      </form>
    </main>
  )
}
