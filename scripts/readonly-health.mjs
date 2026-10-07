// Opt-in local report. GET delay only; never selects a proxy, reloads or starts a core.
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { parse } from 'yaml';
import { fingerprintProxy } from '../pages/lib/node-pool/dedupe.js';
const file=process.argv[2],controller=process.env.MIHOMO_CONTROLLER||'http://127.0.0.1:9090';
if(!file)throw Error('Usage: node scripts/readonly-health.mjs <downloaded-public-provider.yaml>');
const target=new URL(controller);if(!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.protocol!=='http:')throw Error('Controller must be loopback HTTP');
const data=parse(await readFile(file,'utf8'));if(!Array.isArray(data?.proxies))throw Error('Expected public provider YAML, never config.json');
const headers=process.env.MIHOMO_SECRET?{Authorization:'Bearer '+process.env.MIHOMO_SECRET}:{};
const observations=[];
let state={};try{state=JSON.parse(await readFile('artifacts/local-health-state.json','utf8'));}catch{}
for(const node of data.proxies.slice(0,40)){
 const delays=[];let github_ok;let success_count=0,failure_count=0,consecutive_failures=0,last_success,last_failure;
 for(const service of ['https://www.gstatic.com/generate_204','https://api.github.com']){
  const url=new URL('/proxies/'+encodeURIComponent((process.env.MIHOMO_NODE_PREFIX||'')+node.name)+'/delay',target);url.searchParams.set('url',service);url.searchParams.set('timeout','6000');
  try{
   const res=await fetch(url,{headers,signal:AbortSignal.timeout(8000)});
   if(res.status===401)throw Error('Controller authorization required: set MIHOMO_SECRET locally');
   if(res.status===404)throw Error('Provider node is not loaded in this Controller; no configuration will be changed');
   const result=await res.json();const ok=res.ok&&Number(result.delay)>0;
   if(ok){delays.push(result.delay);success_count++;consecutive_failures=0;last_success=Date.now();}else{failure_count++;consecutive_failures++;last_failure=Date.now();}
   if(service.includes('github'))github_ok=ok;
  }catch(e){if(/authorization required|not loaded/.test(e.message))throw e;failure_count++;consecutive_failures++;last_failure=Date.now();}
 }
 delays.sort((a,b)=>a-b);
 // OpenAI country/service fields remain UNKNOWN unless separately measured; 401 is not a failure.
 const fingerprint=await fingerprintProxy(node),previous=state[fingerprint]||{},samples=[...(previous.samples||[]),...delays].slice(-60).sort((a,b)=>a-b);
 const roundOk=failure_count===0;
 const observation={fingerprint,success_count:(previous.success_count||0)+(roundOk?1:0),failure_count:(previous.failure_count||0)+(roundOk?0:1),consecutive_failures:roundOk?0:(previous.consecutive_failures||0)+1,last_success:roundOk?Date.now():previous.last_success,last_failure:roundOk?previous.last_failure:Date.now(),latency_median:samples.length?samples[Math.floor(samples.length/2)]:undefined,latency_p95:samples.length?samples[Math.min(samples.length-1,Math.floor(samples.length*0.95))]:undefined,jitter:samples.length>1?samples.at(-1)-samples[0]:undefined,github_ok,country:'UNKNOWN',last_seen:Date.now()};
 state[fingerprint]={...observation,samples};observations.push(observation);
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/local-observations.json',JSON.stringify(observations,null,2));await writeFile('artifacts/local-health-state.json',JSON.stringify(state));
console.log('Local report saved. No selector or network configuration was changed. No automatic upload.');
