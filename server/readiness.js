import { createHash } from 'node:crypto';
import { renderRedacted } from './engine.js';

// One source of truth for the release button, review summary and API gate.
export function releaseReadiness(record) {
  const documents = record.documents || [];
  const pending = documents.reduce(
    (n, d) => n + d.spans.filter((s) => s.decision === 'pending').length,
    0,
  );
  const unreviewed = documents.filter((d) => !d.attested).length;
  const unchecked = documents.filter(
    (d) =>
      !d.integrity ||
      d.integrityError ||
      d.integrity.outputHash !==
        createHash('sha256').update(renderRedacted(d.text, d.spans)).digest('hex'),
  ).length;
  const unresolved = documents.reduce(
    (n, d) =>
      n +
      [...(d.integrity?.leaks || []), ...(d.integrity?.conflicts || [])].filter((f) => !f.resolved)
        .length,
    0,
  );
  const totalCharacters = documents.reduce((n, d) => n + d.text.length, 0);
  const withheldCharacters = documents.reduce(
    (n, d) =>
      n +
      d.spans.filter((s) => s.decision !== 'dismissed').reduce((m, s) => m + s.end - s.start, 0),
    0,
  );
  const checks = [
    {
      id: 'decisions',
      label: 'Every suggestion reviewed',
      passed: documents.length > 0 && pending === 0,
      detail: `${pending} pending decisions`,
    },
    {
      id: 'checks',
      label: 'Current release checked',
      passed: documents.length > 0 && unchecked === 0,
      detail: `${unchecked} documents need fresh checks`,
    },
    {
      id: 'findings',
      label: 'Every finding addressed',
      passed: documents.length > 0 && unresolved === 0,
      detail: `${unresolved} unresolved findings`,
    },
    {
      id: 'review',
      label: 'Full record review confirmed',
      passed: documents.length > 0 && unreviewed === 0,
      detail: `${unreviewed} documents need confirmation`,
    },
  ];
  return {
    ready: checks.every((c) => c.passed),
    checks,
    totalCharacters,
    withheldCharacters,
    retainedPercent: totalCharacters
      ? Math.round(((totalCharacters - withheldCharacters) / totalCharacters) * 100)
      : 0,
    blockers: [
      ...(!documents.length ? ['Add at least one document before release.'] : []),
      ...(pending ? ['Review every suggested redaction before release.'] : []),
      ...(unreviewed ? ['Confirm a full document review for every document.'] : []),
      ...(unchecked ? ['Run integrity checks on the current release first.'] : []),
      ...(unresolved ? ['Resolve every integrity finding before release.'] : []),
    ],
  };
}
