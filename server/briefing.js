// Voice receives workflow metadata only, never document text, titles, or finding excerpts.
export function buildBriefing(allRequests, now = Date.now()) {
  const safeRef = (value) => (/^[A-Za-z0-9-]{1,80}$/.test(value || '') ? value : null);
  const requests = allRequests
    .filter((r) => r.status !== 'released')
    .map((r) => {
      const docs = r.documents || [];
      const findings = (type) =>
        docs.flatMap((d) => d.integrity?.[type] || []).filter((f) => !f.resolved);
      const pending = docs.reduce(
        (n, d) => n + (d.spans || []).filter((s) => s.decision === 'pending').length,
        0,
      );
      const leaks = findings('leaks'),
        conflicts = findings('conflicts');
      const overdue = Date.parse(r.dueAt) < now;
      return {
        ...r,
        pending,
        leaks,
        conflicts,
        overdue,
        score: leaks.length * 5 + conflicts.length * 3 + pending + (overdue ? 10 : 0),
      };
    });
  const sum = (key) =>
    requests.reduce((n, r) => n + (Array.isArray(r[key]) ? r[key].length : Number(r[key])), 0);
  const priorities = [...requests]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 2)
    .map((r) => {
      const prior = r.conflicts.find((f) => safeRef(f.requestRef));
      return `${r.synthetic ? 'Demo request' : 'Request'} ${safeRef(r.id) || 'with an unavailable reference'}: ${r.pending} redactions need review, ${r.leaks.length} leak findings, and ${r.conflicts.length} consistency findings.${prior ? ` Compare with ${prior.synthetic ? 'synthetic reference' : 'reference'} ${safeRef(prior.requestRef)}.` : ''}${r.overdue ? ' This request is overdue.' : ''}`;
    })
    .join(' ');
  return `Your workspace briefing. ${requests.length} requests are open. ${sum('pending')} suggested redactions need officer review. ${sum('leaks')} leak findings and ${sum('conflicts')} consistency findings remain unresolved. ${sum('overdue')} requests are past their target date. ${priorities || 'Your review queue is clear.'}`;
}
