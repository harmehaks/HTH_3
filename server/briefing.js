export function buildBriefing(allRequests) {
  const requests = allRequests.filter((r) => r.status !== 'released');
  const pending = requests.reduce(
    (sum, r) =>
      sum +
      r.documents.reduce((s, d) => s + d.spans.filter((x) => x.decision === 'pending').length, 0),
    0,
  );
  const findings = (type) =>
    requests.reduce(
      (sum, r) =>
        sum +
        r.documents.reduce(
          (s, d) => s + (d.integrity?.[type].filter((x) => !x.resolved).length || 0),
          0,
        ),
      0,
    );
  const overdue = requests.filter((r) => Date.parse(r.dueAt) < Date.now()).length;
  return `Your workspace briefing. ${requests.length} requests are open. ${pending} suggested redactions need officer review. ${findings('leaks')} leak findings and ${findings('conflicts')} consistency findings remain unresolved. ${overdue} requests are past their target date. ${requests.length ? 'Start with outstanding reviews and integrity findings before approving a release.' : 'Your review queue is clear.'}`;
}
