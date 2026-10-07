import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { generateKeyPairSync } from 'node:crypto';
const syntheticKeys=generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'sec1',format:'der'},publicKeyEncoding:{type:'spki',format:'der'}});
const html=await readFile('pages/index.html','utf8'),script=await readFile('pages/app.js','utf8');
function frontend(){
 const elements={};for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)){
  const [tag,type,id]=match;const e={value:tag.match(/value="([^"]*)"/)?.[1]||'',checked:/\bchecked\b/.test(tag),disabled:false,selectedOptions:[{textContent:'fixture'}],classList:{add(){},remove(){},toggle(){}},addEventListener(){},textContent:'',className:''};
  if(type==='select'){const body=html.slice(match.index).split('</select>')[0];const opts=[...body.matchAll(/<option[^>]*value="([^"]+)"[^>]*>/g)];e.value=(opts.find(v=>v[0].includes('selected'))||opts[0])?.[1]||'';}
  elements[id]=e;
 }
 const document={getElementById:id=>elements[id],querySelectorAll:()=>[],createElement:()=>({classList:{add(){}},appendChild(){},remove(){}}),body:{appendChild(){}}};
 const context=vm.createContext({document,location:{origin:'https://preview.example'},crypto,console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},URL,Blob,navigator:{},fetch:async()=>({ok:false}),TextEncoder,TextDecoder});
 const modified=script.replace('})();',`globalThis.fixture={opts,buildClash,buildShadowrocket,buildSingbox,buildVlessBridge,setSource(v){source=v;}};})();`);
 vm.runInContext(modified,context);context.fixture.setSource({private_key:syntheticKeys.privateKey.toString('base64'),endpoint_pub_key:syntheticKeys.publicKey.toString('base64'),endpoint_v4:'162.159.198.2',endpoint_h2_v4:'162.159.198.2',ipv4:'172.16.0.2',ipv6:'2606:4700::2'});
 return {api:context.fixture,elements};
}
function validateReferences(config){
 const groups=config['proxy-groups'],providers=config['proxy-providers']||{};
 const names=new Set(['DIRECT','REJECT','REJECT-DROP',...config.proxies.map(p=>p.name),...groups.map(g=>g.name)]);
 assert.equal(new Set(groups.map(g=>g.name)).size,groups.length);
 for(const group of groups){for(const n of group.proxies||[])assert.ok(names.has(n),'missing group '+n);for(const n of group.use||[])assert.ok(providers[n],'missing provider '+n);}
 for(const rule of config.rules){const parts=rule.split(',');assert.ok(names.has(parts.at(-1)==='no-resolve'?parts.at(-2):parts.at(-1)),'missing rule target '+rule);}
}
test('PC, mobile, raw, disabled, paths and rule profiles generate coherent YAML',async()=>{
 await mkdir('artifacts',{recursive:true});
 for(const mode of ['stable','fast','mobile','raw'])for(const connection of ['DIRECT','WARP','AUTO'])for(const ruleMode of ['smart','lite','global']){
  const {api,elements:e}=frontend();e.poolMode.value=mode;e.poolConnectionPath.value=connection;e.ruleMode.value=ruleMode;
  const text=api.buildClash(),config=parse(text,{merge:true});validateReferences(config);
  assert.ok(config.proxies.length>0);assert.ok(config['proxy-groups'].some(g=>g.name==='⚡ YouTube-WARP极速'));
  if(mode!=='raw'){
    const codex=config['proxy-groups'].find(g=>g.name==='CODEX-US');assert.equal(codex.type,'fallback');assert.ok(!codex.proxies.includes('DIRECT'));
    const rule=config.rules.find(r=>r.includes('openai.com'));assert.ok(rule.endsWith('CODEX-US'));
    const p=config['proxy-providers']['POOL-STABLE'+(connection==='WARP'?'-WARP':'')];assert.ok(p.url.startsWith('https://preview.example/api/pool/'));
    assert.equal(p.interval,mode==='mobile'?3600:1800);assert.equal(p['health-check'].interval,mode==='mobile'?900:300);
    assert.equal(p.override['skip-cert-verify'],false);
    assert.ok(!JSON.stringify(providersOnly(config)).includes(syntheticKeys.privateKey.toString('base64')));
    if(mode==='mobile')assert.ok(p.url.includes('profile=mobile'));
  }else assert.ok(!config['proxy-groups'].some(g=>g.name==='CODEX-US'));
  if(connection==='AUTO'&&ruleMode==='smart'&&['stable','mobile'].includes(mode))await writeFile('artifacts/mihomo-'+(mode==='mobile'?'mobile':'pc')+'.yaml',text);
 }
});
function providersOnly(c){return c['proxy-providers'];}
test('free pool and Codex toggles retain WARP and old output formats',()=>{
 const {api,elements:e}=frontend();e.freeEgressEnabled.checked=false;let config=parse(api.buildClash(),{merge:true});validateReferences(config);assert.ok(!config['proxy-providers']);
 e.freeEgressEnabled.checked=true;e.codexOptimized.checked=false;config=parse(api.buildClash(),{merge:true});assert.ok(!config.rules.some(r=>r.endsWith('CODEX-US')));
 assert.ok(api.buildShadowrocket().includes('proxies:'));assert.ok(JSON.parse(api.buildSingbox()).outbounds);assert.ok(JSON.parse(api.buildVlessBridge()).inbounds);
});
test('token stays in local provider authorization header, never URL',()=>{
 const {api,elements:e}=frontend();e.poolToken.value='SYNTHETIC_POOL_TOKEN';const c=parse(api.buildClash(),{merge:true});
 for(const p of Object.values(c['proxy-providers'])){assert.ok(!p.url.includes('SYNTHETIC_POOL_TOKEN'));assert.equal(p.header.Authorization[0],'Bearer SYNTHETIC_POOL_TOKEN');}
});
