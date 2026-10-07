const fields = ['success_count','failure_count','consecutive_failures','last_success','last_failure','latency_median','latency_p95','jitter','openai_ok','github_ok','country','last_seen'];
export function sanitizeHistory(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const result = {};
  for(const key of fields) {
    const v = input[key];
    if (['openai_ok','github_ok'].includes(key)) { if (typeof v === 'boolean') result[key]=v; }
    else if(key === 'country') { if(['US','UNKNOWN','NON-US'].includes(v)) result[key]=v; }
    else if(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= (key.startsWith('last_') ? Date.now()+300000 : 1e9)) result[key]=v;
  }
  return result;
}
export async function loadHistory(env) {
  if(!env?.POOL_HISTORY) return {nodes:{},stable:[],enabled:false};
  try {
    const data = await env.POOL_HISTORY.get('pool-history-v7','json');
    const nodes = {};
    for(const [id,h] of Object.entries(data?.nodes || {}).slice(0,500)) if(/^[a-f0-9]{64}$/.test(id)) nodes[id]=sanitizeHistory(h);
    return {nodes,stable:Array.isArray(data?.stable)?data.stable.filter(v=>/^[a-f0-9]{64}$/.test(v)).slice(0,15):[],enabled:true};
  } catch { return {nodes:{},stable:[],enabled:true,degraded:true}; }
}
