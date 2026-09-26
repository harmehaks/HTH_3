import { Check, Circle, Fingerprint, ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { RequestRecord } from './types';

export default function ReleaseReadiness({ record }: { record: RequestRecord }) {
  const summary = record.readiness;
  if (!summary || !record.documents.length) return null;
  const released = record.status === 'released';
  const completed = summary.checks.filter((c) => c.passed).length;
  return (
    <section
      className={`release-readiness ${released ? 'is-released' : ''}`}
      aria-label="Release readiness"
    >
      <div className="readiness-intro">
        <span className="eyebrow">
          <ShieldCheck size={14} /> RELEASE CONTROL
        </span>
        <h2>
          {released
            ? 'A record ready to share.'
            : summary.ready
              ? 'Ready for your final decision.'
              : 'A clear path to release.'}
        </h2>
        <p>
          {released
            ? 'Approved text has been preserved for the requester.'
            : `${completed} of 4 review gates complete. Every gate is checked by the server.`}
        </p>
        {released && (
          <a className="text-link" href={`/api/requests/${record.id}/export/receipt`}>
            <Fingerprint size={15} /> Download release receipt <ArrowUpRight size={14} />
          </a>
        )}
      </div>
      <div className="readiness-checks">
        {summary.checks.map((c) => (
          <div className={`readiness-check ${c.passed ? 'passed' : ''}`} key={c.id}>
            <span>{c.passed ? <Check size={14} /> : <Circle size={14} />}</span>
            <div>
              <strong>{c.label}</strong>
              <small>{c.passed ? 'Complete' : c.detail}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="disclosure-balance">
        <span className="eyebrow">DISCLOSURE BALANCE</span>
        <strong>
          {summary.retainedPercent}
          <span>%</span>
        </strong>
        <p>of source characters remain visible</p>
        <div
          className="disclosure-meter"
          role="img"
          aria-label={`${summary.retainedPercent}% of source characters visible`}
        >
          <i style={{ width: `${summary.retainedPercent}%` }} />
        </div>
        <small>Text retained, not a safety score.</small>
      </div>
    </section>
  );
}
