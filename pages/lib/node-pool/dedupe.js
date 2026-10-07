function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,canonical(value[k])]));
  return value;
}
export async function fingerprintProxy(proxy) {
  const { name, ...identity } = proxy;
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(identity)));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2,'0')).join('');
}
export function dedupeNodes(nodes) {
  const found = new Map();
  for (const n of nodes) {
    const old = found.get(n.fingerprint);
    if (!old || (old.insecure && !n.insecure) || (old.country !== 'US' && n.country === 'US')) found.set(n.fingerprint,n);
  }
  return [...found.values()];
}
