'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      setError('Connexion impossible. Vérifiez votre email et votre mot de passe.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="container narrow">
      <p className="eyebrow">Espace professionnel</p>
      <h1>Espace artisan</h1>
      <p>Connectez-vous pour consulter et traiter vos demandes clients.</p>
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
        <button type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
        <p className="muted">Pas encore de compte ? <Link href="/signup">Créer mon espace</Link></p>
      </form>
    </main>
  )
}
