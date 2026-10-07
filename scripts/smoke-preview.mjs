import { parse } from 'yaml';
import { mkdir,writeFile } from 'node:fs/promises';
const base=process.argv[2];if(!base||new URL(base).protocol!=='https:')throw Error('Pass HTTPS Preview URL');
const results=[];
for(const path of ['/','/api/health','/api/warp/register','/api/warp/enroll','/api/pool/status','/api/pool/provider/us-stable.yaml','/api/pool/provider/us-fast.yaml','/api/pool/provider/us-reserve.yaml','/api/pool/provider/us-all.yaml','/api/pool/provider/us-stable.yaml?profile=mobile']){
 const res=await fetch(new URL(path,base),{signal:AbortSignal.timeout(45000)}),text=await res.text();
 const row={path,status:res.status};
 if(path==='/api/pool/status')row.data=JSON.parse(text);
 if(path.includes('.yaml')&&res.ok){const p=parse(text);if(!Array.isArray(p.proxies)||!p.proxies.length)throw Error('Empty/invalid provider '+path);row.count=p.proxies.length;row.uniqueNames=new Set(p.proxies.map(n=>n.name)).size;if(p.proxies.some(n=>n['private-key']||n.private_key||n.access_token||n.license||n['skip-cert-verify']===true))throw Error('Forbidden provider fields');}
 const expected=path.startsWith('/api/warp/')?405:200;if(res.status!==expected)throw Error(JSON.stringify(row));
 results.push(row);
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/preview-smoke.json',JSON.stringify({base,at:new Date().toISOString(),results},null,2));console.log(JSON.stringify(results,null,2));
