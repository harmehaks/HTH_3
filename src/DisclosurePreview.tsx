import { useState } from 'react';
import { Eye, Fingerprint, Check, ArrowUpRight } from 'lucide-react';

export default function DisclosurePreview({ onReview }: { onReview: () => void }) {
  const [protectedContext, setProtectedContext] = useState(false);
  return (
    <div className="disclosure-preview">
      <div className="preview-top">
        <span>
          <span className="live-dot" /> THE DISCLOSURE LENS
        </span>
        <span>SYNTHETIC EXAMPLE</span>
      </div>
      <div className="preview-tabs" role="group" aria-label="Disclosure example">
        <button aria-pressed={!protectedContext} onClick={() => setProtectedContext(false)}>
          <Eye size={14} /> Name hidden
        </button>
        <button aria-pressed={protectedContext} onClick={() => setProtectedContext(true)}>
          <Fingerprint size={14} /> Context protected
        </button>
      </div>
      <div className="preview-record">
        <div className="preview-record-heading">
          <span>INTERNAL BRIEFING</span>
          <span>01 / 01</span>
        </div>
        <p>
          The pilot reduced processing time by <strong>18%.</strong>
        </p>
        <p>
          Prepared by <span className="ink-redaction">name withheld</span>
        </p>
        <p className="context-line">
          {protectedContext ? (
            <span className="ink-redaction context-hidden">identifying context withheld</span>
          ) : (
            <mark>
              The only officer leading the Northern Region pilot received the Northstar service
              award.
            </mark>
          )}
        </p>
        <div className="preview-record-footer">
          <span>PUBLIC VALUE PRESERVED</span>
          <strong>18% improvement</strong>
        </div>
      </div>
      <div className={`preview-insight ${protectedContext ? 'protected' : ''}`} aria-live="polite">
        {protectedContext ? <Check size={20} /> : <Fingerprint size={20} />}
        <div>
          <strong>
            {protectedContext
              ? 'The outcome stays. The identifying clue goes.'
              : 'A hidden name can still leave a visible identity.'}
          </strong>
          <p>
            {protectedContext
              ? 'Illustrative mitigation. A real release still needs officer review.'
              : 'Unique roles and public awards can reveal who is behind a redaction.'}
          </p>
        </div>
      </div>
      <button className="preview-link" onClick={onReview}>
        Explore the review workspace <ArrowUpRight size={15} />
      </button>
    </div>
  );
}
