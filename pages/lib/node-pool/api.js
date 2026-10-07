import { buildPool, buildProvider } from './provider.js';
import { sanitizeHistory } from './history.js';

const TTL=900, MAX_AGE=86400000;
const inflight = new Map();
const response = (data,status=200,extra={}) => new Response(typeof data==='string'?data:JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
function authorized(request, secret) {
  if(!secret) return true;
  return request.headers.get('Authorization') === `Bearer ${secret}` || new URL(request.url).searchParams.get('token') === secret;
}
export async function getPool(request,env={},ctx={},fetcher=fetch,cache=globalThis.caches?.default) {
  const key=new URL('/api/pool/internal-snapshot-v7-1',request.url).href;
  const cached=await cache?.match(key).catch(()=>null);
  let previous=null; try{previous=cached?await cached.json():null;}catch{}
  const age=Date.now()-Date.parse(previous?.status?.updated_at||'');
  if(age>=0&&age<TTL*1000) return previous;
  if(inflight.has(key)) return inflight.get(key);
  const job=(async()=>{
    const fresh=await buildPool({env,fetcher});
    if(!fresh.status.counts.stable&&previous?.status?.counts.stable&&age<MAX_AGE){
      return {...previous,status:{...previous.status,state:'degraded',stale:true,attempted_at:new Date().toISOString(),sources:fresh.status.sources}};
    }
    if(fresh.status.counts.stable&&cache){
      const write=cache.put(key,new Response(JSON.stringify(fresh),{headers:{'Cache-Control':'public,max-age=86400'}})).catch(()=>{});
      if(ctx.waitUntil)ctx.waitUntil(write);else await write;
    }
    if(env.POOL_HISTORY&&fresh.status.counts.stable){
      // Preserve last ranking without storing source credentials in KV.
      const write=(async()=>{
        const data=await env.POOL_HISTORY.get('pool-history-v7','json')||{};
        const nodes={}; for(const [id,h] of Object.entries(data.nodes||{}).slice(0,500))if(/^[a-f0-9]{64}$/.test(id))nodes[id]=sanitizeHistory(h);
        await env.POOL_HISTORY.put('pool-history-v7',JSON.stringify({nodes,stable:fresh.tiers.stable.map(n=>n.fingerprint)}));
      })().catch(()=>{});
      if(ctx.waitUntil)ctx.waitUntil(write);else await write;
    }
    return fresh;
  })();
  inflight.set(key,job);try{return await job;}finally{inflight.delete(key);}
}
export async function handlePool(request,env={},ctx={}) {
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/pool/'))return null;
  if(env.NODE_POOL_V7==='false') return response({enabled:false,version:7,state:'disabled'},url.pathname==='/api/pool/status'?200:404);
  if(!authorized(request,env.POOL_TOKEN))return response({error:'unauthorized'},401);
  if(url.pathname==='/api/pool/history') {
    if(request.method!=='POST')return response({error:'method_not_allowed'},405,{'Allow':'POST'});
    if(!env.POOL_HISTORY||!env.POOL_ADMIN_TOKEN)return response({error:'history_not_configured'},503);
    if(request.headers.get('Authorization')!==`Bearer ${env.POOL_ADMIN_TOKEN}`)return response({error:'unauthorized'},401);
    const body=await request.text(); if(body.length>65536)return response({error:'body_size'},413);
    let observations;try{observations=JSON.parse(body);}catch{return response({error:'invalid_json'},400);}
    if(!Array.isArray(observations)||observations.length>80)return response({error:'invalid_observations'},400);
    const allowed=new Set(['fingerprint',...Object.keys(sanitizeHistory({success_count:1,failure_count:1,consecutive_failures:1,last_success:1,last_failure:1,latency_median:1,latency_p95:1,jitter:1,openai_ok:true,github_ok:true,country:'US',last_seen:1}))]);
    if(observations.some(o=>!o||!/^[a-f0-9]{64}$/.test(o.fingerprint)||Object.keys(o).some(k=>!allowed.has(k))))return response({error:'invalid_fields'},400);
    try{
      const data=await env.POOL_HISTORY.get('pool-history-v7','json')||{nodes:{},stable:[]};data.nodes??={};
      for(const o of observations)data.nodes[o.fingerprint]=sanitizeHistory(o);
      data.nodes=Object.fromEntries(Object.entries(data.nodes).slice(-500));
      await env.POOL_HISTORY.put('pool-history-v7',JSON.stringify(data));
      const key=new URL('/api/pool/internal-snapshot-v7-1',request.url).href;
      await globalThis.caches?.default?.delete(key);
      return response({accepted:observations.length});
    }catch{return response({error:'history_unavailable'},503);}
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return response({error:'method_not_allowed'},405,{'Allow':'GET, HEAD'});
  const match=url.pathname.match(/^\/api\/pool\/provider\/us-(stable|fast|reserve|all)\.yaml$/);
  if(url.pathname!=='/api/pool/status'&&!match)return response({error:'not_found'},404);
  try{
    const pool=await getPool(request,env,ctx);
    if(!match)return response(request.method==='HEAD'?'':pool.status);
    const tier=match[1],mobile=url.searchParams.get('profile')==='mobile';
    const limit=mobile?{stable:8,fast:12,reserve:20,all:40}[tier]:{stable:15,fast:25,reserve:40,all:80}[tier];
    const nodes=pool.tiers[tier].slice(0,limit);
    if(!nodes.length)return response({error:'empty_pool',tier},503,{'Retry-After':'900'});
    return response(request.method==='HEAD'?'':buildProvider(nodes),200,{'Content-Type':'application/yaml; charset=utf-8','X-Pool-State':pool.status.state,'X-Pool-Updated':pool.status.updated_at});
  }catch{return response({error:'pool_unavailable'},503,{'Retry-After':'900'});}
}
