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
async function broadcastStateChanged(match: any, version: number, event: any = null) {
  try {
    const topic = await realtimeTopic(match)
    if (!topic) return
    const response = await fetch(`${url}/realtime/v1/api/broadcast/${encodeURIComponent(topic)}/events/state_changed`, {
      method: 'POST',
      headers: { apikey: serviceRole, authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: Number(version), event: event || null }),
    })
    if (!response.ok) console.warn('realtime_broadcast_failed', response.status, await response.text())
  } catch (error) { console.warn('realtime_broadcast_failed', error) }
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
function flattenPieces(state: any) {
  const result = new Map<string, any>()
  for (const color of Object.keys(state?.G?.players || {})) for (const p of state.G.players[color]?.pieces || []) {
    const id = String(p?.id)
    if (!result.has(id)) result.set(id, { id: p.id, color: p.color, type: p.type, r: p.r, c: p.c, dead: !!p.dead })
  }
  return result
}
function canonicalChanges(before: any, after: any) {
  const b = flattenPieces(before), a = flattenPieces(after), changes: any[] = []
  const ids = new Set([...b.keys(), ...a.keys()])
  for (const id of ids) {
    const from = b.get(id) || null, to = a.get(id) || null
    if (!from && to) { changes.push({ kind: 'piece_added', id: to.id, to }); continue }
    if (from && !to) { changes.push({ kind: 'piece_removed', id: from.id, from }); continue }
    if (!from || !to) continue
    const moved = from.r !== to.r || from.c !== to.c, dead = from.dead !== to.dead, color = from.color !== to.color
    if (moved || dead || color) changes.push({ kind: 'piece_changed', id: to.id, color: to.color, type: to.type, from: { r: from.r, c: from.c, dead: from.dead, color: from.color }, to: { r: to.r, c: to.c, dead: to.dead, color: to.color } })
  }
  return changes
}
function stable(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`
  return JSON.stringify(value)
}
function validateSnapshotShape(state: any, match: any) {
  if (!state || state.schema !== 1 || !state.G || !state.G.players || !Array.isArray(state.G.order)) return 'État de partie invalide.'
  if (!!state.optSP !== !!match.sp_enabled) return 'Réglage des super pouvoirs invalide.'
  const idx = Number(state.G.idx)
  if (!Number.isInteger(idx) || idx < 0 || idx >= state.G.order.length) return 'Joueur courant invalide.'
  if (!state.G.order.includes('yellow') || !state.G.order.includes('red')) return 'Participants de partie invalides.'
  return null
}
function validateInitialSnapshot(match: any, role: string, state: any, event: any, baseVersion: number) {
  if (match.state) return 'Les snapshots client ne peuvent plus modifier une partie commencée. Utilisez le protocole d’action autoritaire.'
  const shapeError = validateSnapshotShape(state, match)
  if (shapeError) return shapeError
  if (!Number.isInteger(baseVersion) || baseVersion < 0) return 'Version de base invalide.'
  if (baseVersion !== Number(match.version)) return 'Version périmée. Récupérez l’état serveur avant de rejouer.'
  if (role !== 'host') return 'Le joueur hôte doit initialiser la partie.'
  if (!event || event.schema !== 1 || event.kind !== 'match_initialized') return 'Événement initial invalide.'
  if (event.actor_color !== 'yellow') return 'La couleur de l’initialisation ne correspond pas au siège hôte.'
  if (Number(event.base_version) !== baseVersion) return 'La version de l’événement ne correspond pas à la requête.'
  if (currentColor(state) !== 'yellow' || Number(state.G.turn || 0) !== 0 || !!state.G.over) return 'État initial invalide.'
  if (stable(event.changes || []) !== stable(canonicalChanges(null, state))) return 'L’événement initial ne correspond pas au snapshot.'
  return null
}
async function createRoom(hostSecret: string, guestSecret?: string) {
  const hostHash = await sha256(hostSecret), guestHash = guestSecret ? await sha256(guestSecret) : null
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
    const body = await req.json(), action = String(body?.action || '')
    if (action === 'create') {
      const secret = randomSecret(), created = await createRoom(secret)
      return json({ ok: true, code: created.code, secret, status: created.status, version: Number(created.version) })
    }
    if (action === 'matchmake_start') {
      const queueSecret = randomSecret(), queueHash = await sha256(queueSecret)
      const now = new Date(), nowIso = now.toISOString(), freshCutoff = new Date(now.getTime() - 5000).toISOString()
      await db.from('insect_matchmaking_queue').delete().lt('expires_at', nowIso)
      const { data: waiting, error: waitError } = await db.from('insect_matchmaking_queue').select('*').is('matched_code', null).eq('consumed', false).gt('expires_at', nowIso).gt('last_seen_at', freshCutoff).order('requested_at', { ascending: true }).limit(1).maybeSingle()
      if (waitError) throw waitError
      if (!waiting) {
        const { error } = await db.from('insect_matchmaking_queue').insert({ player_secret_hash: queueHash, queue_secret_hash: queueHash, requested_at: nowIso, last_seen_at: nowIso, expires_at: new Date(now.getTime() + 120000).toISOString() })
        if (error) throw error
        return json({ ok: true, matched: false, queue_secret: queueSecret })
      }
      const hostSecret = randomSecret(), guestSecret = randomSecret(), room = await createRoom(hostSecret, guestSecret)
      const { data: claimed, error: claimError } = await db.from('insect_matchmaking_queue').update({ matched_code: room.code, matched_role: 'host', match_secret: hostSecret }).eq('id', waiting.id).is('matched_code', null).gt('last_seen_at', freshCutoff).select('id').maybeSingle()
      if (claimError) throw claimError
      if (!claimed) { await db.from('insect_matches').delete().eq('code', room.code); return json({ ok: false, error: 'Conflit de matchmaking, réessayez.' }, 409) }
      const { error: insertError } = await db.from('insect_matchmaking_queue').insert({ player_secret_hash: queueHash, queue_secret_hash: queueHash, requested_at: nowIso, last_seen_at: nowIso, matched_code: room.code, matched_role: 'guest', match_secret: guestSecret, consumed: true, expires_at: new Date(now.getTime() + 120000).toISOString() })
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
      if (action === 'matchmake_cancel') { if (!q.matched_code) await db.from('insect_matchmaking_queue').delete().eq('id', q.id); return json({ ok: true, cancelled: !q.matched_code, matched: !!q.matched_code }) }
      if (new Date(q.expires_at).getTime() < Date.now() && !q.matched_code) { await db.from('insect_matchmaking_queue').delete().eq('id', q.id); return json({ ok: true, matched: false, expired: true }) }
      if (!q.matched_code) { await db.from('insect_matchmaking_queue').update({ last_seen_at: new Date().toISOString() }).eq('id', q.id); return json({ ok: true, matched: false }) }
      await db.from('insect_matchmaking_queue').update({ consumed: true, last_seen_at: new Date().toISOString() }).eq('id', q.id)
      return json({ ok: true, matched: true, code: q.matched_code, secret: q.match_secret, role: q.matched_role, status: 'active' })
    }

    const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (code.length !== 6) return json({ ok: false, error: 'Code invalide.' }, 400)
    let match = await getMatch(code)
    if (!match) return json({ ok: false, error: 'Partie introuvable.' }, 404)
    if (new Date(match.expires_at).getTime() < Date.now()) { await db.from('insect_matches').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', match.id); return json({ ok: false, error: 'Cette partie a expiré.' }, 410) }
    if (action === 'join') {
      if (match.status !== 'waiting' || match.guest_secret_hash) return json({ ok: false, error: 'Cette partie a déjà un adversaire.' }, 409)
      const secret = randomSecret(), guestHash = await sha256(secret)
      const { data, error } = await db.from('insect_matches').update({ guest_secret_hash: guestHash, status: 'active', updated_at: new Date().toISOString() }).eq('id', match.id).eq('status', 'waiting').is('guest_secret_hash', null).select('status,version').maybeSingle()
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
        const same = match.host_sp_vote === match.guest_sp_vote, finalEnabled = same ? match.host_sp_vote : crypto.getRandomValues(new Uint8Array(1))[0] < 128
        const { data, error: decideError } = await db.from('insect_matches').update({ sp_enabled: finalEnabled, sp_decided_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', match.id).is('sp_enabled', null).select('*').maybeSingle()
        if (decideError) throw decideError
        match = data || await getMatch(code)
      }
      return json({ ok: true, role, realtime_topic: rtTopic, ...publicRules(match) })
    }
    if (action === 'get') {
      const since = Number(body?.since ?? -1)
      return json({ ok: true, role, status: match.status, version: Number(match.version), state: Number(match.version) > since ? match.state : null, event: Number(match.version) > since ? (match.state?._mp_event || null) : null, realtime_topic: rtTopic, ...publicRules(match) })
    }
    if (action === 'commit_turn') {
      if (match.status !== 'active') return json({ ok: false, error: 'Partie non active.' }, 409)
      if (match.sp_enabled === null) return json({ ok: false, error: 'Les deux joueurs doivent voter avant de commencer.' }, 409)
      if (match.state) return json({ ok: false, error: 'Écriture snapshot refusée après initialisation. Mettez le client à jour.', server_version: Number(match.version), action_api: 'insect-play' }, 426)
      const baseVersion = Number(body?.base_version), state = body?.state, proposedEvent = body?.event
      const validationError = validateInitialSnapshot(match, role, state, proposedEvent, baseVersion)
      if (validationError) return json({ ok: false, error: validationError, server_version: Number(match.version) }, 409)
      const nextVersion = Number(match.version) + 1
      const acceptedEvent = { ...proposedEvent, base_version: Number(match.version), result_version: nextVersion, accepted_at: Date.now() }
      const persistedState = { ...state, _mp_event: acceptedEvent }
      const { data, error } = await db.from('insect_matches').update({ state: persistedState, version: nextVersion, status: 'active', updated_at: new Date().toISOString() }).eq('id', match.id).eq('version', baseVersion).is('state', null).select('version,status').maybeSingle()
      if (error) throw error
      if (!data) return json({ ok: false, error: 'Conflit d’initialisation. Récupérez la version serveur.', server_version: Number(match.version) }, 409)
      await broadcastStateChanged(match, Number(data.version), acceptedEvent)
      return json({ ok: true, version: Number(data.version), status: data.status, event: acceptedEvent, realtime_topic: rtTopic })
    }
    if (action === 'push') return json({ ok: false, error: 'Client multijoueur obsolète : les snapshots de gameplay ne sont plus acceptés.', server_version: Number(match.version), action_api: 'insect-play' }, 426)

    return json({ ok: false, error: 'Action inconnue.' }, 400)
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Erreur serveur multijoueur.' }, 500)
  }
})
