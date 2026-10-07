const clamp = v => Math.max(0, Math.min(1,v));
export function scoreProxy(node, now = Date.now()) {
  const h = node.history || {};
  const total = (h.success_count || 0) + (h.failure_count || 0);
  const success = total ? (h.success_count || 0) / total : 0.5;
  const reach = v => v === true ? 1 : v === false ? 0 : 0.5;
  const latency = Number.isFinite(h.latency_median) ? clamp(1 - h.latency_median / 2000) : 0.5;
  const jitter = Number.isFinite(h.jitter) ? clamp(1 - h.jitter / 500) : 0.5;
  const fresh = node.last_seen ? clamp(1 - (now - node.last_seen) / 86400000) : 0;
  return Math.round(100 * (0.35*success + 0.20*reach(h.openai_ok) + 0.15*reach(h.github_ok) + 0.15*latency + 0.10*jitter + 0.05*fresh));
}
export function rankNodes(nodes, previous = [], now = Date.now()) {
  const order = new Map(previous.map((v,i) => [v,i]));
  const scored = nodes.map(n => ({...n, score:scoreProxy(n,now)})).sort((a,b) => b.score - a.score || (a.source_rank??0)-(b.source_rank??0) || a.fingerprint.localeCompare(b.fingerprint));
  // Preserve incumbents within a 10 point band; failed nodes are excluded by tier selection.
  const result = [];
  while (scored.length) {
    const band = scored.filter(n => n.score >= scored[0].score - 10);
    band.sort((a,b) => (order.get(a.fingerprint) ?? 1e6) - (order.get(b.fingerprint) ?? 1e6) || b.score-a.score || (a.source_rank??0)-(b.source_rank??0) || a.fingerprint.localeCompare(b.fingerprint));
    const next = band[0]; result.push(next); scored.splice(scored.indexOf(next),1);
  }
  return result;
}
