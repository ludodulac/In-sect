import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const url = Deno.env.get('SUPABASE_URL')!
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(url, serviceRole, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

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
async function realtimeTopic(match: any) {
  if (!match?.id || !match?.host_secret_hash || !match?.guest_secret_hash) return null
  const token = await sha256(`insect-realtime-v1:${match.id}:${match.host_secret_hash}:${match.guest_secret_hash}`)
  return `insect-${token}`
}
async function broadcastStateChanged(match: any, version: number) {
  try {
    const topic = await realtimeTopic(match)
    if (!topic) return
    const response = await fetch(`${url}/realtime/v1/api/broadcast/${encodeURIComponent(topic)}/events/state_changed`, {
      method: 'POST',
      headers: {
        apikey: serviceRole,
        authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: Number(version) }),
    })
    if (!response.ok) console.warn('realtime_broadcast_failed', response.status, await response.text())
  } catch (error) {
    console.warn('realtime_broadcast_failed', error)
  }
}
function currentColor(state: any) {
  const order = state?.G?.order, idx = state?.G?.idx
  return Array.isArray(order) && Number.isInteger(idx) ? (order[idx] || null) : null
}
function publicRules(match: any) {
  return {
    host_voted: match.host_sp_vote !== null,
    guest_voted: match.guest_sp_vote !== null,
    sp_decided: match.sp_enabled !== null,
    sp_enabled: match.sp_enabled,
    sp_random: match.host_sp_vote !== null && match.guest_sp_vote !== null && match.host_sp_vote !== match.guest_sp_vote,
  }
}
async function createRoom(hostSecret: string, guestSecret?: string) {
  const hostHash = await sha256(hostSecret)
  const guestHash = guestSecret ? await sha256(guestSecret) : null
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode()
    const { data, error } = await db.from('insect_matches').insert({ code, host_secret_hash: hostHash, guest_secret_hash: guestHash, status: guestSecret ? 'active' : 'waiting' }).select('code,status,version').single()
    if (!error) return data
    if (error.code !== '23505') throw error
  }
  throw new Error('room_code_generation_failed')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST requis' }, 405)
  try {
    const body = await req.json()
    const action = String(body?.action || '')

    if (action === 'create') {
      const secret = randomSecret()
      const created = await createRoom(secret)
      return json({ ok: true, code: created.code, secret, status: created.status, version: Number(created.version) })
    }

    if (action === 'matchmake_start') {
      const queueSecret = randomSecret()
      const queueHash = await sha256(queueSecret)
      const now = new Date()
      const nowIso = now.toISOString()
      const freshCutoff = new Date(now.getTime() - 5000).toISOString()
      await db.from('insect_matchmaking_queue').delete().lt('expires_at', nowIso)

      const { data: waiting, error: waitError } = await db.from('insect_matchmaking_queue')
        .select('*').is('matched_code', null).eq('consumed', false).gt('expires_at', nowIso).gt('last_seen_at', freshCutoff)
        .order('requested_at', { ascending: true }).limit(1).maybeSingle()
      if (waitError) throw waitError

      if (!waiting) {
        const { error } = await db.from('insect_matchmaking_queue').insert({
          player_secret_hash: queueHash,
          queue_secret_hash: queueHash,
          requested_at: nowIso,
          last_seen_at: nowIso,
          expires_at: new Date(now.getTime() + 120000).toISOString(),
        })
        if (error) throw error
        return json({ ok: true, matched: false, queue_secret: queueSecret })
      }

      const hostSecret = randomSecret()
      const guestSecret = randomSecret()
      const room = await createRoom(hostSecret, guestSecret)
      const { data: claimed, error: claimError } = await db.from('insect_matchmaking_queue')
        .update({ matched_code: room.code, matched_role: 'host', match_secret: hostSecret })
        .eq('id', waiting.id).is('matched_code', null).gt('last_seen_at', freshCutoff).select('id').maybeSingle()
      if (claimError) throw claimError
      if (!claimed) {
        await db.from('insect_matches').delete().eq('code', room.code)
        return json({ ok: false, error: 'Conflit de matchmaking, réessayez.' }, 409)
      }

      const { error: insertError } = await db.from('insect_matchmaking_queue').insert({
        player_secret_hash: queueHash,
        queue_secret_hash: queueHash,
        requested_at: nowIso,
        last_seen_at: nowIso,
        matched_code: room.code,
        matched_role: 'guest',
        match_secret: guestSecret,
        consumed: true,
        expires_at: new Date(now.getTime() + 120000).toISOString(),
      })
      if (insertError) throw insertError
      return json({ ok: true, matched: true, queue_secret: queueSecret, code: room.code, secret: guestSecret, role: 'guest', status: 'active' })
    }

    if (action === 'matchmake_status' || action === 'matchmake_cancel') {
      const queueSecret = String(body?.queue_secret || '')
      if (!queueSecret) return json({ ok: false, error: 'Session de recherche manquante.' }, 401)
      const qh = await sha256(queueSecret)
      const { data: q, error } = await db.from('insect_matchmaking_queue').select('*').eq('queue_secret_hash', qh).maybeSingle()
      if (error) throw error
      if (!q) return json({ ok: false, error: 'Recherche introuvable ou expirée.' }, 404)

      if (action === 'matchmake_cancel') {
        if (!q.matched_code) await db.from('insect_matchmaking_queue').delete().eq('id', q.id)
        return json({ ok: true, cancelled: !q.matched_code, matched: !!q.matched_code })
      }

      if (new Date(q.expires_at).getTime() < Date.now() && !q.matched_code) {
        await db.from('insect_matchmaking_queue').delete().eq('id', q.id)
        return json({ ok: true, matched: false, expired: true })
      }
      if (!q.matched_code) {
        await db.from('insect_matchmaking_queue').update({ last_seen_at: new Date().toISOString() }).eq('id', q.id)
        return json({ ok: true, matched: false })
      }

      await db.from('insect_matchmaking_queue').update({ consumed: true, last_seen_at: new Date().toISOString() }).eq('id', q.id)
      return json({ ok: true, matched: true, code: q.matched_code, secret: q.match_secret, role: q.matched_role, status: 'active' })
    }

    const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (code.length !== 6) return json({ ok: false, error: 'Code invalide.' }, 400)
    let match = await getMatch(code)
    if (!match) return json({ ok: false, error: 'Partie introuvable.' }, 404)
    if (new Date(match.expires_at).getTime() < Date.now()) {
      await db.from('insect_matches').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', match.id)
      return json({ ok: false, error: 'Cette partie a expiré.' }, 410)
    }

    if (action === 'join') {
      if (match.status !== 'waiting' || match.guest_secret_hash) return json({ ok: false, error: 'Cette partie a déjà un adversaire.' }, 409)
      const secret = randomSecret(), guestHash = await sha256(secret)
      const { data, error } = await db.from('insect_matches').update({ guest_secret_hash: guestHash, status: 'active', updated_at: new Date().toISOString() })
        .eq('id', match.id).eq('status', 'waiting').is('guest_secret_hash', null).select('status,version').maybeSingle()
      if (error) throw error
      if (!data) return json({ ok: false, error: 'Un autre joueur vient de rejoindre cette partie.' }, 409)
      return json({ ok: true, secret, status: data.status, version: Number(data.version) })
    }

    const secret = String(body?.secret || '')
    if (!secret) return json({ ok: false, error: 'Secret de session manquant.' }, 401)
    const role = await identify(match, secret)
    if (!role) return json({ ok: false, error: 'Session invalide.' }, 403)
    const rtTopic = await realtimeTopic(match)

    if (action === 'vote_sp') {
      if (match.status !== 'active' || match.state) return json({ ok: false, error: 'Le vote est fermé.' }, 409)
      if (typeof body?.enabled !== 'boolean') return json({ ok: false, error: 'Vote invalide.' }, 400)
      const voteColumn = role === 'host' ? 'host_sp_vote' : 'guest_sp_vote'
      const { error } = await db.from('insect_matches').update({ [voteColumn]: body.enabled, updated_at: new Date().toISOString() }).eq('id', match.id)
      if (error) throw error
      match = await getMatch(code)
      if (match.host_sp_vote !== null && match.guest_sp_vote !== null && match.sp_enabled === null) {
        const same = match.host_sp_vote === match.guest_sp_vote
        const finalEnabled = same ? match.host_sp_vote : crypto.getRandomValues(new Uint8Array(1))[0] < 128
        const { data, error: decideError } = await db.from('insect_matches')
          .update({ sp_enabled: finalEnabled, sp_decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', match.id).is('sp_enabled', null).select('*').maybeSingle()
        if (decideError) throw decideError
        match = data || await getMatch(code)
      }
      return json({ ok: true, role, realtime_topic: rtTopic, ...publicRules(match) })
    }

    if (action === 'get') {
      const since = Number(body?.since ?? -1)
      return json({ ok: true, role, status: match.status, version: Number(match.version), state: Number(match.version) > since ? match.state : null, realtime_topic: rtTopic, ...publicRules(match) })
    }

    if (action === 'push') {
      if (match.status !== 'active') return json({ ok: false, error: 'Partie non active.' }, 409)
      if (match.sp_enabled === null) return json({ ok: false, error: 'Les deux joueurs doivent voter avant de commencer.' }, 409)
      const state = body?.state
      if (!state || state.schema !== 1 || !state.G) return json({ ok: false, error: 'État de partie invalide.' }, 400)
      if (!!state.optSP !== !!match.sp_enabled) return json({ ok: false, error: 'Réglage des super pouvoirs invalide.' }, 409)
      const playerColor = role === 'host' ? 'yellow' : 'red'
      if (match.state) {
        const before = currentColor(match.state)
        if (before && before !== playerColor) return json({ ok: false, error: "Ce n'est pas votre tour." }, 409)
      } else if (role !== 'host') return json({ ok: false, error: 'Le joueur hôte doit initialiser la partie.' }, 409)

      const nextVersion = Number(match.version) + 1, nextStatus = state?.G?.over ? 'finished' : 'active'
      const { data, error } = await db.from('insect_matches').update({ state, version: nextVersion, status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', match.id).eq('version', match.version).select('version,status').maybeSingle()
      if (error) throw error
      if (!data) return json({ ok: false, error: 'Conflit de synchronisation. Rechargez la partie.' }, 409)
      await broadcastStateChanged(match, Number(data.version))
      return json({ ok: true, version: Number(data.version), status: data.status, realtime_topic: rtTopic })
    }
    return json({ ok: false, error: 'Action inconnue.' }, 400)
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Erreur serveur multijoueur.' }, 500)
  }
})
