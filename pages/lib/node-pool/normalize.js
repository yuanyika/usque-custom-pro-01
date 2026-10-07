const common = ['type','server','port','uuid','password','cipher','alterId','tls','servername','sni','network','udp','flow','client-fingerprint','alpn','packet-encoding','reality-opts','ws-opts','grpc-opts','http-opts','h2-opts','skip-cert-verify'];
const nested = {
  'reality-opts': ['public-key','short-id'],
  'ws-opts': ['path','headers','max-early-data','early-data-header-name'],
  'grpc-opts': ['grpc-service-name'],
  'http-opts': ['method','path','headers'],
  'h2-opts': ['host','path']
};
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function safeValue(value, depth = 0) {
  if (depth > 4) throw new Error('nested_value');
  if (typeof value === 'string') {
    if (value.length > 2048 || /[\x00-\x1f]/.test(value)) throw new Error('invalid_string');
    return value;
  }
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
  if (Array.isArray(value) && value.length <= 32) return value.map(v => safeValue(v, depth + 1));
  if (value && typeof value === 'object' && Object.keys(value).length <= 32) {
    const out = {};
    for (const [k,v] of Object.entries(value)) {
      if (!/^[\w-]{1,64}$/.test(k) || /private.?key|access.?token|license|device|authorization|cookie/i.test(k)) throw new Error('forbidden_field');
      out[k] = safeValue(v, depth + 1);
    }
    return out;
  }
  throw new Error('invalid_value');
}
export function normalizeProxy(raw) {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const type = String(raw.type || '').toLowerCase().replace(/^shadowsocks$/, 'ss');
    if (!['vless','vmess','trojan','ss'].includes(type)) return null;
    const p = {};
    for (const key of common) if (raw[key] !== undefined) {
      if (nested[key]) {
        p[key] = {};
        for (const n of nested[key]) if (raw[key]?.[n] !== undefined) p[key][n] = safeValue(raw[key][n]);
      } else p[key] = safeValue(raw[key]);
    }
    p.type = type;
    p.server = String(p.server || '').toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
    p.port = Number(p.port);
    if (!/^[a-z0-9.:_-]{1,253}$/.test(p.server) || !Number.isInteger(p.port) || p.port < 1 || p.port > 65535) return null;
    if (/^(localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd][a-f0-9]{2}:|fe80:)/.test(p.server)) return null;
    if (['vless','vmess'].includes(type) && !uuidPattern.test(String(p.uuid || ''))) return null;
    if (['trojan','ss'].includes(type) && (typeof p.password !== 'string' || !p.password)) return null;
    if (type === 'ss' && !['aes-128-gcm','aes-256-gcm','chacha20-ietf-poly1305','2022-blake3-aes-128-gcm','2022-blake3-aes-256-gcm','2022-blake3-chacha20-poly1305'].includes(p.cipher)) return null;
    if (p.network === 'raw') p.network = 'tcp';
    if (p.network && !['tcp','ws','grpc','http','h2'].includes(p.network)) return null;
    if (type === 'vmess') { p.alterId ??= 0; p.cipher ??= 'auto'; }
    if (type === 'trojan') p.tls = true;
    if (p.tls !== undefined && typeof p.tls !== 'boolean') return null;
    if (p['skip-cert-verify'] !== undefined && typeof p['skip-cert-verify'] !== 'boolean') return null;
    // A provider never disables TLS verification, even in reserve.
    p['skip-cert-verify'] = false;
    return { proxy: p, insecure: raw['skip-cert-verify'] === true };
  } catch { return null; }
}
