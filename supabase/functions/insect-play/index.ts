import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
import { resolveIntent } from '../_shared/insect-rules-kernel.ts'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
}
const url=Deno.env.get('SUPABASE_URL')!
const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(url,serviceRole,{auth:{persistSession:false}})
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})

async function sha256(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
async function identify(match:any,secret:string){const h=await sha256(secret);if(h===match.host_secret_hash)return'host';if(match.guest_secret_hash&&h===match.guest_secret_hash)return'guest';return null}
async function topicFor(match:any){if(!match?.id||!match?.host_secret_hash||!match?.guest_secret_hash)return null;const token=await sha256(`insect-realtime-v1:${match.id}:${match.host_secret_hash}:${match.guest_secret_hash}`);return`insect-${token}`}
async function broadcast(match:any,version:number,event:any){try{const topic=await topicFor(match);if(!topic)return;const r=await fetch(`${url}/realtime/v1/api/broadcast/${encodeURIComponent(topic)}/events/state_changed`,{method:'POST',headers:{apikey:serviceRole,authorization:`Bearer ${serviceRole}`,'Content-Type':'application/json'},body:JSON.stringify({version,event})});if(!r.ok)console.warn('insect_play_broadcast_failed',r.status,await r.text())}catch(e){console.warn('insect_play_broadcast_failed',e)}}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({ok:false,error:'POST requis'},405)
  try{
    const body=await req.json()
    if(String(body?.action||'')!=='play_action')return json({ok:false,error:'Action inconnue.'},400)
    const code=String(body?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)
    const secret=String(body?.secret||'')
    const baseVersion=Number(body?.base_version)
    const intent=body?.intent
    if(code.length!==6)return json({ok:false,error:'Code invalide.'},400)
    if(!secret)return json({ok:false,error:'Secret de session manquant.'},401)
    if(!Number.isInteger(baseVersion)||baseVersion<0)return json({ok:false,error:'Version de base invalide.'},400)

    const {data:match,error:readError}=await db.from('insect_matches').select('*').eq('code',code).maybeSingle()
    if(readError)throw readError
    if(!match)return json({ok:false,error:'Partie introuvable.'},404)
    if(new Date(match.expires_at).getTime()<Date.now())return json({ok:false,error:'Cette partie a expiré.'},410)
    const role=await identify(match,secret)
    if(!role)return json({ok:false,error:'Session invalide.'},403)
    if(match.status!=='active')return json({ok:false,error:'Partie non active.'},409)
    if(match.sp_enabled===null)return json({ok:false,error:'Le vote Super Powers doit être terminé.'},409)
    if(!match.state)return json({ok:false,error:'État initial serveur indisponible.'},409)
    if(baseVersion!==Number(match.version))return json({ok:false,error:'Version périmée.',server_version:Number(match.version)},409)

    const actorColor=role==='host'?'yellow':'red'
    const resolved=resolveIntent(match.state,intent,actorColor)
    if(!resolved.ok)return json({ok:false,error:resolved.error,server_version:Number(match.version)},409)
    if(!!resolved.state.optSP!==!!match.sp_enabled)return json({ok:false,error:'État Super Powers incohérent.'},409)

    const nextVersion=Number(match.version)+1
    const acceptedEvent={...resolved.event,base_version:Number(match.version),result_version:nextVersion,accepted_at:Date.now()}
    const persisted={...resolved.state,_mp_event:acceptedEvent}
    const nextStatus=persisted?.G?.over?'finished':'active'
    const {data:updated,error:updateError}=await db.from('insect_matches')
      .update({state:persisted,version:nextVersion,status:nextStatus,updated_at:new Date().toISOString()})
      .eq('id',match.id).eq('version',baseVersion).select('version,status').maybeSingle()
    if(updateError)throw updateError
    if(!updated)return json({ok:false,error:'Conflit de synchronisation.',server_version:Number(match.version)},409)
    await broadcast(match,Number(updated.version),acceptedEvent)
    return json({ok:true,version:Number(updated.version),status:updated.status,event:acceptedEvent})
  }catch(e){console.error('[IN-SECT PLAY]',e);return json({ok:false,error:'Erreur serveur de résolution multijoueur.'},500)}
})
