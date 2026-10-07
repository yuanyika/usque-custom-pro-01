import { parseDocument } from 'yaml';

export function parseSource(text) {
  if (typeof text !== 'string' || text.length > 2 * 1024 * 1024) throw new Error('source_size');
  const doc = parseDocument(text, { uniqueKeys: true, schema: 'core' });
  if (doc.errors.length) throw new Error('invalid_yaml');
  const data = doc.toJS({ maxAliasCount: 30 });
  if (!data || !Array.isArray(data.proxies) || data.proxies.length > 5000) throw new Error('invalid_proxies');
  return data.proxies;
}
