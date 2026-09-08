/* IN-SECT — Realtime transporte l'événement accepté; get(version) reste la récupération canonique. */
(function(){
'use strict';
const MP=window.INSECT_MP;
const RT=window.INSECT_MP_RUNTIME;
const projectUrl=String(window.INSECT_SUPABASE_URL||'').trim();
const publishableKey=String(window.INSECT_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!MP||!RT||!/^https:\/\//i.test(projectUrl)||!publishableKey)return;

const SDK_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3';
let client=null,channel=null,channelTopic=null,loadingSdk=null,topicLookup=false;

function loadSdk(){
  if(window.supabase?.createClient)return Promise.resolve(window.supabase);
  if(loadingSdk)return loadingSdk;
  loadingSdk=new Promise((resolve,reject)=>{
    const existing=document.getElementById('insect-supabase-js');
    if(existing){existing.addEventListener('load',()=>resolve(window.supabase),{once:true});existing.addEventListener('error',reject,{once:true});return}
    const s=document.createElement('script');s.id='insect-supabase-js';s.src=SDK_URL;s.async=true;s.crossOrigin='anonymous';
    s.onload=()=>window.supabase?.createClient?resolve(window.supabase):reject(new Error('Supabase Realtime indisponible'));
    s.onerror=()=>reject(new Error('Chargement Supabase Realtime impossible'));
    document.head.appendChild(s);
  });
  return loadingSdk;
}
async function fetchTopic(){
  if(topicLookup||!MP.code||!MP.secret||MP.realtimeTopic)return MP.realtimeTopic||null;
  topicLookup=true;
  try{
    const r=await fetch(MP.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get',code:MP.code,secret:MP.secret,since:Number.isFinite(MP.lastVersion)?MP.lastVersion:-1}),cache:'no-store'});
    let o=null;try{o=await r.json()}catch(_){}
    if(r.ok&&o?.ok!==false&&o?.realtime_topic){MP.realtimeTopic=String(o.realtime_topic);return MP.realtimeTopic}
  }catch(e){console.warn('[IN-SECT MP REALTIME] topic',e)}finally{topicLookup=false}
  return null;
}
async function disconnect(){
  const old=channel;channel=null;channelTopic=null;MP.realtimeConnected=false;RT.setConnection(MP.code?'polling':'offline');
  if(old&&client){try{await client.removeChannel(old)}catch(_){}}
}
async function connect(topic){
  if(!topic||channelTopic===topic)return;
  await disconnect();
  try{
    const sdk=await loadSdk();
    if(!client)client=sdk.createClient(projectUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const next=client.channel(topic,{config:{broadcast:{self:false}}});
    channel=next;channelTopic=topic;
    next.on('broadcast',{event:'state_changed'},payload=>{
      const body=payload?.payload||{};
      const version=Number(body.version);
      if(Number.isFinite(version)&&version<=Number(MP.lastVersion))return;
      const event=body.event||null;
      if(event&&typeof MP.receiveAcceptedEvent==='function'&&MP.receiveAcceptedEvent(event,version))return;
      if(typeof MP.syncNow==='function')MP.syncNow(false);
    });
    next.subscribe((status,err)=>{
      if(status==='SUBSCRIBED'){MP.realtimeConnected=true;RT.setConnection('realtime');return}
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        MP.realtimeConnected=false;RT.setConnection('polling');
        if(channel===next){channel=null;channelTopic=null}
        if(err)console.warn('[IN-SECT MP REALTIME]',status,err);
      }
    });
  }catch(e){channel=null;channelTopic=null;MP.realtimeConnected=false;RT.setConnection('polling');console.warn('[IN-SECT MP REALTIME] connect',e)}
}
async function ensure(){
  if(!MP.code||!MP.secret){if(channel)await disconnect();return}
  const topic=MP.realtimeTopic||await fetchTopic();
  if(topic)await connect(topic);
}
setInterval(()=>{ensure()},750);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ensure()});
window.addEventListener('pagehide',()=>{MP.realtimeConnected=false;RT.setConnection(MP.code?'reconnecting':'offline')});
MP.realtimeConnected=false;
MP.ensureRealtime=ensure;
})();
