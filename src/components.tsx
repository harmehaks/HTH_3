import { useEffect, useRef, type ReactNode } from 'react';
import {
  X,
  LoaderCircle,
  Check,
  ArrowUpRight,
  FileText,
  MoreHorizontal,
  ArrowRight,
  ShieldCheck,
  Clock3,
} from 'lucide-react';
import type { RequestSummary } from './types';
export function IconButton({
  children,
  label,
  onClick,
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`icon-button ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Status({ status }: { status: string }) {
  return (
    <Badge tone={status === 'released' ? 'green' : status === 'received' ? 'neutral' : 'amber'}>
      {status === 'released' ? 'Released' : status === 'received' ? 'Received' : 'In review'}
    </Badge>
  );
}
export function Risk({ value }: { value: number }) {
  return (
    <span className={`risk ${value >= 60 ? 'high' : value > 0 ? 'moderate' : 'low'}`}>
      <span />
      {value >= 60 ? 'High' : value > 0 ? 'Moderate' : 'Low'}
      <small>{value}/100</small>
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileText size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={25} />
      <p>Getting your workspace ready…</p>
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = original;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
export const date = (s: string) =>
  new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
export const daysLeft = (s: string) => Math.ceil((Date.parse(s) - Date.now()) / 86400000);
export function Due({ request }: { request: RequestSummary }) {
  const days = daysLeft(request.dueAt);
  return request.status === 'released' ? (
    <span className="due released">
      <Check size={13} /> Completed
    </span>
  ) : (
    <span className={`due ${days < 0 ? 'late' : days <= 7 ? 'soon' : ''}`}>
      <Clock3 size={13} />
      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days} days left`}
    </span>
  );
}
export function RequestTable({
  items,
  onOpen,
  compact = false,
}: {
  items: RequestSummary[];
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="request-table">
        <thead>
          <tr>
            <th>Request / document</th>
            {!compact && <th>Department</th>}
            <th>Status</th>
            <th>Leak risk</th>
            <th>Target date</th>
            <th>
              <span className="sr-only">Open request</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r.id)}>
              <td>
                <button
                  className="table-document"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(r.id);
                  }}
                >
                  <span className={`file-icon ${r.status === 'released' ? 'done' : ''}`}>
                    {r.status === 'released' ? <ShieldCheck size={20} /> : <FileText size={20} />}
                  </span>
                  <span>
                    <strong>{r.title}</strong>
                    <small>
                      {r.id}
                      <span>·</span>
                      {r.documentCount} {r.documentCount === 1 ? 'document' : 'documents'}
                      {r.pending > 0 && (
                        <>
                          <span>·</span>
                          {r.pending} to review
                        </>
                      )}
                    </small>
                  </span>
                </button>
              </td>
              {!compact && (
                <td>
                  <span className="department-cell">{r.department}</span>
                </td>
              )}
              <td>
                <Status status={r.status} />
              </td>
              <td>
                <Risk value={r.risk || 0} />
              </td>
              <td>
                <Due request={r} />
              </td>
              <td>
                <IconButton label={`Open ${r.title}`} onClick={() => onOpen(r.id)}>
                  <ArrowUpRight size={17} />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <Empty
          title="No requests here yet"
          description="Try a different search or create a new request."
        />
      )}
    </div>
  );
}
export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function ArrowLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={15} />
    </button>
  );
}
