import { stringify } from 'yaml';
import { SOURCES, fetchSource } from './sources.js';
import { normalizeProxy } from './normalize.js';
import { fingerprintProxy, dedupeNodes } from './dedupe.js';
import { filterProxy, tierEligibility } from './filter.js';
import { rankNodes } from './score.js';
import { loadHistory } from './history.js';

export async function buildPool({env={},fetcher=fetch,sources=SOURCES,now=Date.now()} = {}) {
  const history = await loadHistory(env);
  const records = await Promise.all(sources.map(async source => {
    if(!source.enabled) return {source,state:'disabled',nodes:[],last_seen:null};
    try {return {source,state:'ok',...await fetchSource(source,fetcher,now)};}
    catch(e) { const code=/^(upstream_http_\d+|invalid_yaml|invalid_proxies|source_size)$/.test(e.message)?e.message:String(e.name||'source_error');return {source,state:'failed',error:code,nodes:[],last_seen:null}; }
  }));
  let raw=0; const nodes=[];
  for(const r of records) for(const p of r.nodes) {
    raw++; const normalized=normalizeProxy(p); if(!normalized) continue;
    const fingerprint=await fingerprintProxy(normalized.proxy);
    nodes.push({...normalized,fingerprint,source_rank:raw,country:r.source.country,countryEvidence:r.source.countryEvidence,last_seen:r.last_seen,history:history.nodes[fingerprint]||{}});
  }
  const unique = dedupeNodes(nodes);
  const us = unique.filter(n => filterProxy(n) && n.history.country !== 'NON-US');
  const ranked = rankNodes(us,history.stable,now);
  const active = ranked.filter(n => tierEligibility(n)==='stable');
  const stable = active.slice(0,15);
  const fast = [...active].sort((a,b) => (a.history.latency_median??1e9)-(b.history.latency_median??1e9)||b.score-a.score||a.source_rank-b.source_rank||a.fingerprint.localeCompare(b.fingerprint)).slice(0,25);
  const selected = new Set([...stable,...fast].map(n=>n.fingerprint));
  const reserve = ranked.filter(n=>tierEligibility(n)!=='quarantine'&&!selected.has(n.fingerprint)).slice(0,40);
  const quarantine = ranked.filter(n=>tierEligibility(n)==='quarantine');
  const unknown = unique.filter(n=>!filterProxy(n));
  const tiers = {stable,fast,reserve,all:dedupeNodes([...stable,...fast,...reserve])};
  return {tiers,status:{version:7,enabled:true,state:!stable.length?'empty':records.some(r=>r.source.enabled&&r.state!=='ok')||history.degraded?'degraded':'ok',updated_at:new Date(now).toISOString(),country_evidence:'upstream-geoip (not a local exit measurement)',history:history.enabled?'kv':'none',history_degraded:!!history.degraded,counts:{raw,deduped:unique.length,us:us.length,stable:stable.length,fast:fast.length,reserve:reserve.length,unknown:unknown.length,quarantine:quarantine.length},sources:records.map(r=>({id:r.source.id,role:r.source.role,state:r.state,error:r.error||null,last_seen:r.last_seen?new Date(r.last_seen).toISOString():null,reason:r.source.reason||null}))}};
}
export function buildProvider(nodes) {
  // Only normalized public source proxies reach this function. No user config is accepted.
  return stringify({proxies:nodes.map(n=>({...n.proxy,name:`US-${n.proxy.type}-${n.fingerprint.slice(0,16)}`}))},{lineWidth:0});
}
