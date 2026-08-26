import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const url = Deno.env.get('SUPABASE_URL')!
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(url, serviceRole, { auth: { persistSession: false } })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
}

function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

async function getMatch(code: string) {
  const { data, error } = await db.from('insect_matches').select('*').eq('code', code).maybeSingle()
  if (error) throw error
  return data
}

async function identify(match: any, secret: string) {
  const hash = await sha256(secret)
  if (hash === match.host_secret_hash) return 'host'
  if (match.guest_secret_hash && hash === match.guest_secret_hash) return 'guest'
  return null
}

function currentColor(state: any) {
  const order = state?.G?.order
  const idx = state?.G?.idx
  if (!Array.isArray(order) || !Number.isInteger(idx)) return null
  return order[idx] || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST requis' }, 405)

  try {
    const body = await req.json()
    const action = String(body?.action || '')

    if (action === 'create') {
      const secret = randomSecret()
      const secretHash = await sha256(secret)
      let created: any = null
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = randomCode()
        const { data, error } = await db.from('insect_matches').insert({
          code, host_secret_hash: secretHash, status: 'waiting',
        }).select('code,status,version').single()
        if (!error) { created = data; break }
        if (error.code !== '23505') throw error
      }
      if (!created) return json({ ok: false, error: 'Impossible de générer un code.' }, 503)
      return json({ ok: true, code: created.code, secret, status: created.status, version: Number(created.version) })
    }

    const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (code.length !== 6) return json({ ok: false, error: 'Code invalide.' }, 400)

    const match = await getMatch(code)
    if (!match) return json({ ok: false, error: 'Partie introuvable.' }, 404)
    if (new Date(match.expires_at).getTime() < Date.now()) {
      await db.from('insect_matches').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', match.id)
      return json({ ok: false, error: 'Cette partie a expiré.' }, 410)
    }

    if (action === 'join') {
      if (match.status !== 'waiting' || match.guest_secret_hash) return json({ ok: false, error: 'Cette partie a déjà un adversaire.' }, 409)
      const secret = randomSecret()
      const guestHash = await sha256(secret)
      const { data, error } = await db.from('insect_matches')
        .update({ guest_secret_hash: guestHash, status: 'active', updated_at: new Date().toISOString() })
        .eq('id', match.id).eq('status', 'waiting').is('guest_secret_hash', null)
        .select('status,version').maybeSingle()
      if (error) throw error
      if (!data) return json({ ok: false, error: 'Un autre joueur vient de rejoindre cette partie.' }, 409)
      return json({ ok: true, secret, status: data.status, version: Number(data.version) })
    }

    const secret = String(body?.secret || '')
    if (!secret) return json({ ok: false, error: 'Secret de session manquant.' }, 401)
    const role = await identify(match, secret)
    if (!role) return json({ ok: false, error: 'Session invalide.' }, 403)

    if (action === 'get') {
      const since = Number(body?.since ?? -1)
      return json({ ok: true, role, status: match.status, version: Number(match.version), state: Number(match.version) > since ? match.state : null })
    }

    if (action === 'push') {
      if (match.status !== 'active') return json({ ok: false, error: 'Partie non active.' }, 409)
      const state = body?.state
      if (!state || state.schema !== 1 || !state.G) return json({ ok: false, error: 'État de partie invalide.' }, 400)

      const playerColor = role === 'host' ? 'yellow' : 'red'
      if (match.state) {
        const before = currentColor(match.state)
        if (before && before !== playerColor) return json({ ok: false, error: "Ce n'est pas votre tour." }, 409)
      } else if (role !== 'host') {
        return json({ ok: false, error: 'Le joueur hôte doit initialiser la partie.' }, 409)
      }

      const nextVersion = Number(match.version) + 1
      const nextStatus = state?.G?.over ? 'finished' : 'active'
      const { data, error } = await db.from('insect_matches')
        .update({ state, version: nextVersion, status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', match.id).eq('version', match.version)
        .select('version,status').maybeSingle()
      if (error) throw error
      if (!data) return json({ ok: false, error: 'Conflit de synchronisation. Rechargez la partie.' }, 409)
      return json({ ok: true, version: Number(data.version), status: data.status })
    }

    return json({ ok: false, error: 'Action inconnue.' }, 400)
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Erreur serveur multijoueur.' }, 500)
  }
})
