export function filterProxy(node) {
  return node.country === 'US' && node.countryEvidence === 'upstream-geoip';
}
export function tierEligibility(node) {
  const failures = node.history?.consecutive_failures || 0;
  if (failures >= 3) return 'quarantine';
  if (failures >= 2 || node.insecure) return 'reserve';
  return 'stable';
}
