import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'yaml';
import { parseSource } from '../pages/lib/node-pool/parse.js';
import { normalizeProxy } from '../pages/lib/node-pool/normalize.js';
import { fingerprintProxy, dedupeNodes } from '../pages/lib/node-pool/dedupe.js';
import { filterProxy, tierEligibility } from '../pages/lib/node-pool/filter.js';
import { scoreProxy, rankNodes } from '../pages/lib/node-pool/score.js';
import { buildPool, buildProvider } from '../pages/lib/node-pool/provider.js';
import { getPool, handlePool } from '../pages/lib/node-pool/api.js';
import { sanitizeHistory } from '../pages/lib/node-pool/history.js';
import { fetchText } from '../pages/lib/node-pool/sources.js';
import pages from '../src/pages-worker.js';
import workers from '../src/workers-worker.js';
const proxy={name:'fixture',type:'vless',server:'example.com',port:443,uuid:'00000000-0000-4000-8000-000000000001',tls:true,network:'ws','ws-opts':{path:'/path',headers:{Host:'example.com'}}};
const source={id:'fixture',enabled:true,country:'US',countryEvidence:'upstream-geoip',urls:['https://fixture.test/nodes'],statusUrl:'https://fixture.test/status'};
const fetcher=async url=>new Response(url.endsWith('/status')?JSON.stringify({generated_at_unix:Math.floor(Date.now()/1000)}):stringify({proxies:[proxy]}));
test('Worker fetch keeps its global receiver and refuses redirects',async()=>{
 assert.equal(await fetchText('https://fixture.test',function(url,init){assert.equal(this,globalThis);assert.equal(init.redirect,'manual');return Promise.resolve(new Response('ok'));}),'ok');
 await assert.rejects(()=>fetchText('https://fixture.test',async()=>new Response('',{status:302})),/upstream_http_302/);
});
test('YAML parser rejects malformed, duplicate keys, oversized and non-provider inputs',()=>{
 assert.equal(parseSource(stringify({proxies:[proxy]})).length,1);
 for(const input of ['proxies: [','proxies: []\nproxies: []','rules: []','proxies: '+ 'x'.repeat(2*1024*1024)])assert.throws(()=>parseSource(input));
});
test('normalization strips dialer/private metadata, validates endpoints and enforces TLS',()=>{
 const n=normalizeProxy({...proxy,'dialer-proxy':'attacker',private_key:'secret',license:'private','skip-cert-verify':true});
 assert.equal(n.proxy['skip-cert-verify'],false);assert.equal(n.insecure,true);assert.equal(n.proxy.private_key,undefined);assert.equal(n.proxy['dialer-proxy'],undefined);
 for(const p of [{...proxy,type:'wireguard'},{...proxy,uuid:'bad'},{...proxy,server:'127.0.0.1'},{...proxy,port:0},{...proxy,'ws-opts':{headers:{Authorization:'secret'}}}])assert.equal(normalizeProxy(p),null);
 assert.equal(normalizeProxy({...proxy,network:'raw'}).proxy.network,'tcp');
});
test('fingerprints ignore names and object order but distinguish credentials, transport, SNI and path',async()=>{
 const base=normalizeProxy(proxy).proxy,id=await fingerprintProxy(base);
 assert.equal(id,await fingerprintProxy({...base,name:'different'}));
 assert.equal(id,await fingerprintProxy(Object.fromEntries(Object.entries(base).reverse())));
 for(const change of [{uuid:'00000000-0000-4000-8000-000000000002'},{network:'grpc'},{servername:'other.example'},{'ws-opts':{path:'/other'}},{port:444}])assert.notEqual(id,await fingerprintProxy({...base,...change}));
 assert.equal(dedupeNodes([{fingerprint:id,country:'UNKNOWN'},{fingerprint:id,country:'US'}]).length,1);
});
test('US admission never trusts names or flags and quarantines recoverably',()=>{
 assert.equal(filterProxy({name:'🇺🇸 US',country:'UNKNOWN'}),false);
 assert.equal(filterProxy({country:'US',countryEvidence:'name'}),false);
 assert.equal(filterProxy({country:'US',countryEvidence:'upstream-geoip'}),true);
 assert.equal(tierEligibility({history:{consecutive_failures:2}}),'reserve');
 assert.equal(tierEligibility({history:{consecutive_failures:3}}),'quarantine');
 assert.equal(tierEligibility({history:{consecutive_failures:0}}),'stable');
});
test('stability dominates a marginal latency advantage; unknown reachability is not success',()=>{
 const now=Date.now(),base={last_seen:now};
 const reliable={...base,history:{success_count:100,failure_count:0,latency_median:180,jitter:10,openai_ok:true,github_ok:true}};
 const flaky={...base,history:{success_count:10,failure_count:30,latency_median:130,jitter:200,openai_ok:false,github_ok:true}};
 assert.ok(scoreProxy(reliable)>scoreProxy(flaky));assert.ok(scoreProxy(base)<scoreProxy(reliable));
 assert.equal(rankNodes([{...base,fingerprint:'a'},{...base,fingerprint:'b'}],['b'])[0].fingerprint,'b');
});
test('source failure degrades gracefully, empty output is not reported as usable',async()=>{
 const backup={...source,id:'backup',urls:['https://backup.test/nodes']};
 const pool=await buildPool({sources:[source,backup],fetcher:async url=>url.includes('fixture.test/nodes')?new Response('failed',{status:502}):fetcher(url)});
 assert.equal(pool.status.state,'degraded');assert.equal(pool.status.counts.stable,1);
 const empty=await buildPool({sources:[source],fetcher:async()=>new Response('bad')});assert.equal(empty.status.state,'empty');
 const unknown=await buildPool({sources:[{...source,country:'UNKNOWN',countryEvidence:'unknown'}],fetcher});assert.equal(unknown.status.counts.stable,0);
});
test('tiers are capped; provider round-trips and contains only normalized public nodes',async()=>{
 const nodes=Array.from({length:120},(_,i)=>({...proxy,'ws-opts':{path:'/path'+i},port:443+i}));
 const pool=await buildPool({sources:[source],fetcher:async url=>new Response(url.endsWith('/status')?'{}':stringify({proxies:nodes}))});
 assert.equal(pool.status.counts.stable,15);assert.equal(pool.status.counts.fast,25);assert.equal(pool.status.counts.reserve,40);
 const output=buildProvider(pool.tiers.stable),p=parse(output);
 assert.equal(p.proxies.length,15);assert.ok(p.proxies.every(n=>n.name.startsWith('US-')));assert.ok(!output.includes('private_key'));
});
test('last good cache survives all-source failure, expires after 24 hours',async()=>{
 const first=await buildPool({sources:[source],fetcher});
 first.status.updated_at=new Date(Date.now()-1000000).toISOString();
 const cache={match:async()=>new Response(JSON.stringify(first)),put:async()=>{}};
 const request=new Request('https://cache.test/api/pool/status');
 const stale=await getPool(request,{}, {},async()=>new Response('unavailable',{status:502}),cache);
 assert.equal(stale.status.stale,true);assert.equal(stale.status.state,'degraded');
 first.status.updated_at=new Date(Date.now()-90000000).toISOString();
 const expired=await getPool(request,{}, {},async()=>new Response('unavailable',{status:502}),cache);assert.equal(expired.status.state,'empty');
});
test('optional KV errors do not block provider generation; only history whitelist survives',async()=>{
 const p=await buildPool({sources:[source],fetcher,env:{POOL_HISTORY:{get:async()=>{throw Error('KV outage')}}}});assert.equal(p.status.counts.stable,1);assert.equal(p.status.state,'degraded');
 assert.deepEqual(sanitizeHistory({success_count:1,private_key:'secret',uuid:'secret',latency_median:-1}),{success_count:1});
});
test('feature flag, token, routes, methods and WARP routes remain independent',async()=>{
 const req=path=>new Request('https://routes.test'+path);
 assert.equal((await handlePool(req('/api/pool/status'),{NODE_POOL_V7:'false'})).status,200);
 assert.equal((await handlePool(req('/api/pool/provider/us-stable.yaml'),{NODE_POOL_V7:'false'})).status,404);
 assert.equal((await handlePool(req('/api/pool/status'),{POOL_TOKEN:'fixture'})).status,401);
 assert.equal((await handlePool(req('/api/pool/provider/no.yaml'))).status,404);
 for(const worker of [pages,workers]){
   assert.equal((await worker.fetch(req('/api/health'))).status,200);
   assert.equal((await worker.fetch(req('/api/warp/register'))).status,405);
   assert.equal((await worker.fetch(req('/api/warp/enroll'))).status,405);
   assert.equal(await (await worker.fetch(req('/'),{ASSETS:{fetch:async()=>new Response('asset')}})).text(),'asset');
 }
});
test('history writes require admin auth and reject keys or arbitrary fields',async()=>{
 const env={POOL_ADMIN_TOKEN:'fixture-admin',POOL_HISTORY:{get:async()=>({}),put:async()=>{}}};
 const req=body=>new Request('https://history.test/api/pool/history',{method:'POST',headers:{Authorization:'Bearer fixture-admin'},body:JSON.stringify(body)});
 assert.equal((await handlePool(req([{fingerprint:'a'.repeat(64),private_key:'bad'}]),env)).status,400);
 assert.equal((await handlePool(req([{fingerprint:'a'.repeat(64),success_count:1}]),env)).status,200);
 assert.equal((await handlePool(new Request('https://history.test/api/pool/history',{method:'POST',body:'[]'}),env)).status,401);
});
