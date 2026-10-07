import { mkdir, writeFile } from 'node:fs/promises';
import { fetchText } from '../pages/lib/node-pool/sources.js';
import { parseSource } from '../pages/lib/node-pool/parse.js';
import { normalizeProxy } from '../pages/lib/node-pool/normalize.js';
import { buildPool } from '../pages/lib/node-pool/provider.js';
const checks=[];
for(const [id,url] of [
 ['au1rxx-us','https://raw.githubusercontent.com/Au1rxx/free-vpn-subscriptions/main/output/by-country/clash-US.yaml'],
 ['barabama','https://raw.githubusercontent.com/Barabama/FreeNodes/feat/ai-crawler-v2/nodes/provider.yaml'],
 ['share-daily','https://raw.githubusercontent.com/share-daily/node/main/clash.yaml']
]){
 try{
  const raw=parseSource(await fetchText(url));const valid=raw.map(normalizeProxy).filter(Boolean);
  checks.push({id,state:'parsed',raw:raw.length,normalized:valid.length,insecure:valid.filter(n=>n.insecure).length,protocols:[...new Set(valid.map(n=>n.proxy.type))]});
 }catch(e){checks.push({id,state:'failed',error:e.message});}
}
const pool=await buildPool();
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/live-source-audit.json',JSON.stringify({at:new Date().toISOString(),checks,pool:pool.status},null,2));
console.log(JSON.stringify({checks,pool:pool.status},null,2));
