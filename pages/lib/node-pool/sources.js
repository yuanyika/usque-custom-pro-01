import { parseSource } from './parse.js';
export const SOURCES = [
  {id:'au1rxx-us',role:'primary',enabled:true,country:'US',countryEvidence:'upstream-geoip',
    urls:['https://raw.githubusercontent.com/Au1rxx/free-vpn-subscriptions/main/output/by-country/clash-US.yaml'],
    statusUrl:'https://raw.githubusercontent.com/Au1rxx/free-vpn-subscriptions/main/output/status.json'},
  {id:'barabama',role:'reserve',enabled:false,country:'UNKNOWN',countryEvidence:'unknown',
    urls:['https://raw.githubusercontent.com/Barabama/FreeNodes/feat/ai-crawler-v2/nodes/provider.yaml'],reason:'未提供可靠出口 GeoIP；默认关闭'},
  {id:'share-daily',role:'reserve',enabled:false,country:'UNKNOWN',countryEvidence:'unknown',
    urls:['https://raw.githubusercontent.com/share-daily/node/main/clash.yaml'],reason:'无明确许可证且未提供可靠出口 GeoIP；不启用'}
];
export async function fetchText(url, fetcher = fetch) {
  // Workers' global fetch needs its receiver; reject redirects rather than following a new origin.
  const res = await fetcher.call(globalThis,url,{ signal:AbortSignal.timeout(12000),redirect:'manual',headers:{'Accept':'text/plain, application/json','User-Agent':'Usque-Node-Pool-v7'},cf:{cacheTtl:600,cacheEverything:true} });
  if (!res.ok) throw new Error(`upstream_http_${res.status}`);
  if (Number(res.headers.get('content-length')) > 2*1024*1024) throw new Error('source_size');
  const reader = res.body.getReader(); let size = 0; const chunks = [];
  try {
    while (true) { const {done,value} = await reader.read(); if(done) break; size += value.byteLength; if(size > 2*1024*1024) throw new Error('source_size'); chunks.push(value); }
  } catch(e) { await reader.cancel(); throw e; }
  const bytes = new Uint8Array(size); let offset=0; for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  return new TextDecoder().decode(bytes);
}
export async function fetchSource(source, fetcher = fetch, now = Date.now()) {
  const [nodes,meta] = await Promise.all([
    Promise.all(source.urls.map(async url => parseSource(await fetchText(url,fetcher)))).then(parts => parts.flat()),
    source.statusUrl ? fetchText(source.statusUrl,fetcher).then(JSON.parse).catch(() => null) : null
  ]);
  const stamp = Number(meta?.generated_at_unix) * 1000;
  const last_seen = Number.isFinite(stamp) && stamp > 0 && stamp <= now + 300000 ? stamp : null;
  return {nodes,last_seen};
}
