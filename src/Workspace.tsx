import { useEffect, useState, useRef, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  FileText,
  Plus,
  ScanLine,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  Download,
  LoaderCircle,
  RotateCcw,
  CheckCheck,
  ExternalLink,
  Columns2,
  LockKeyhole,
  Info,
} from 'lucide-react';
import { api, send } from './api';
import { Badge, IconButton, Loading, Empty, Status, Risk, Modal, date } from './components';
import { FindingDialog, ManualDialog } from './Dialogs';
import type { Category, RequestRecord, Doc, Span, Finding } from './types';
type Props = {
  id: string;
  categories: Category[];
  onBack: () => void;
  notify: (s: string, error?: boolean) => void;
  onChanged: () => void;
  onUpload: (id: string) => void;
};
export default function Workspace({ id, categories, onBack, notify, onChanged, onUpload }: Props) {
  const [record, setRecord] = useState<RequestRecord | null>(null),
    [error, setError] = useState(''),
    [docIndex, setDocIndex] = useState(0),
    [selected, setSelected] = useState(''),
    [view, setView] = useState('original'),
    [tab, setTab] = useState('redactions'),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Span | null>(null),
    [finding, setFinding] = useState<Finding | null>(null),
    [manual, setManual] = useState<string | null>(null),
    [release, setRelease] = useState(false),
    [reopen, setReopen] = useState(false),
    [note, setNote] = useState(''),
    [editCat, setEditCat] = useState('');
  const viewerRef = useRef<HTMLDivElement>(null);
  const previousSelection = useRef('');
  const [exportOpen, setExportOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false),
    [referenceText, setReferenceText] = useState(''),
    [referenceUrl, setReferenceUrl] = useState('');
  useEffect(() => {
    if (previousSelection.current && previousSelection.current !== selected)
      viewerRef.current
        ?.querySelector('.text-span.selected')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    previousSelection.current = selected;
  }, [selected]);
  useEffect(() => {
    setRecord(null);
    setError('');
    setDocIndex(0);
    api<RequestRecord>(`/requests/${id}`)
      .then((r) => {
        setRecord(r);
        setSelected(r.documents[0]?.spans[0]?.id || '');
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const saved = (r: RequestRecord) => {
    setRecord(r);
    setFinding(null);
    setManual(null);
    setEdit(null);
    onChanged();
  };
  async function action(
    path: string,
    body: unknown = {},
    method = 'POST',
    message = 'Changes saved.',
  ) {
    setBusy(true);
    try {
      const r = await api<RequestRecord>(path, send(body, method));
      saved(r);
      const checkError = r.documents.find((d) => d.integrityError)?.integrityError;
      notify(checkError ? `Changes saved. ${checkError}` : message, Boolean(checkError));
      return true;
    } catch (e) {
      setRecord(record);
      notify((e as Error).message, true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <Empty
        title="We couldn’t open this request"
        description={error}
        action={
          <button className="button secondary" onClick={onBack}>
            Back to requests
          </button>
        }
      />
    );
  if (!record) return <Loading />;
  const doc = record.documents[docIndex],
    span = doc?.spans.find((s) => s.id === selected) || doc?.spans[0],
    pending = doc?.spans.filter((s) => s.decision === 'pending').length || 0,
    checked = doc?.spans.filter((s) => s.decision !== 'pending').length || 0,
    locked = record.status === 'released';
  const allFindings = doc
      ? [...(doc.integrity?.leaks || []), ...(doc.integrity?.conflicts || [])]
      : [],
    unresolved = allFindings.filter((f) => !f.resolved).length,
    cat = categories.find((c) => c.id === span?.category);
  const prevNext = (offset: number) => {
    if (!doc) return;
    const index = doc.spans.findIndex((s) => s.id === span?.id);
    setSelected(doc.spans[(index + offset + doc.spans.length) % doc.spans.length]?.id || '');
  };
  const ready =
    record.documents.length > 0 &&
    record.documents.every(
      (d) =>
        d.attested &&
        d.spans.every((s) => s.decision !== 'pending') &&
        d.integrity &&
        [...d.integrity.leaks, ...d.integrity.conflicts].every((f) => f.resolved),
    );
  return (
    <>
      <div className="workspace-breadcrumb">
        <button onClick={onBack}>
          <ArrowLeft size={15} />
          Requests
        </button>
        <span>/</span>
        <span>{id}</span>
        {record.synthetic && <Badge>Demo record</Badge>}
      </div>
      <div className="workspace-heading">
        <div>
          <h1>{record.title}</h1>
          <p>
            {record.department}
            <span>·</span>Target {date(record.dueAt)}
          </p>
        </div>
        <div className="heading-actions">
          <Status status={record.status} />
          <button className="button secondary" onClick={() => setExportOpen(true)} disabled={!doc}>
            <Download size={16} />
            {locked ? 'Download release' : 'Export draft'}
          </button>
          {locked ? (
            <button className="button primary" onClick={() => setReopen(true)}>
              <RotateCcw size={16} />
              Reopen
            </button>
          ) : (
            <button className="button primary" onClick={() => setRelease(true)} disabled={!ready}>
              <ShieldCheck size={16} />
              Approve release
            </button>
          )}
        </div>
      </div>
      <div className="review-progress">
        <div className="progress-step complete">
          <span>1</span>
          <div>
            <strong>Ingest & classify</strong>
            <small>
              {record.documents.length} {record.documents.length === 1 ? 'document' : 'documents'}{' '}
              in the workspace
            </small>
          </div>
          <Check size={15} />
        </div>
        <div className={`progress-step ${pending === 0 && doc ? 'complete' : 'current'}`}>
          <span>2</span>
          <div>
            <strong>Officer review</strong>
            <small>
              {checked} of {doc?.spans.length || 0} suggestions reviewed
            </small>
          </div>
          <div className="mini-progress">
            <i
              style={{ width: `${doc?.spans.length ? (checked / doc.spans.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className={`progress-step ${doc?.integrity && unresolved === 0 ? 'complete' : ''}`}>
          <span>3</span>
          <div>
            <strong>Integrity & release</strong>
            <small>
              {locked
                ? 'Release approved'
                : !doc?.integrity
                  ? 'Checks need a fresh run'
                  : `${unresolved} findings to resolve`}
            </small>
          </div>
          <ShieldCheck size={15} />
        </div>
      </div>
      {!doc ? (
        <div className="panel">
          <Empty
            title="A fresh start for this request"
            description={record.description}
            action={
              <button className="button primary" onClick={() => onUpload(id)}>
                <Plus size={17} />
                Add a document
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="review-layout">
            <div className="document-panel panel">
              <div className="document-toolbar">
                <div className="document-select">
                  <FileText size={17} />
                  <select
                    aria-label="Select document"
                    value={docIndex}
                    onChange={(e) => {
                      setDocIndex(Number(e.target.value));
                      setSelected(record.documents[Number(e.target.value)].spans[0]?.id || '');
                    }}
                  >
                    {record.documents.map((d, i) => (
                      <option key={d.id} value={i}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!locked && (
                  <IconButton label="Add a document" onClick={() => onUpload(id)}>
                    <Plus size={17} />
                  </IconButton>
                )}
              </div>
              <div className="viewer-controls">
                <div className="segmented">
                  <button
                    className={view === 'original' ? 'active' : ''}
                    onClick={() => setView('original')}
                  >
                    <Eye size={14} />
                    Original
                  </button>
                  <button
                    className={view === 'redacted' ? 'active' : ''}
                    onClick={() => setView('redacted')}
                  >
                    <ScanLine size={14} />
                    Redacted
                  </button>
                  <button
                    className={view === 'compare' ? 'active' : ''}
                    onClick={() => setView('compare')}
                  >
                    <Columns2 size={14} />
                    Compare
                  </button>
                </div>
                {!locked && (
                  <button
                    className="text-link"
                    onClick={() => setManual(window.getSelection()?.toString() || '')}
                  >
                    <Plus size={14} />
                    Manual redaction
                  </button>
                )}
              </div>
              <div
                className={`document-canvas ${view === 'compare' ? 'comparison' : ''}`}
                style={view === 'published' ? { display: 'none' } : undefined}
                ref={viewerRef}
              >
                {view === 'compare' ? (
                  <>
                    <div>
                      <div className="compare-label">ORIGINAL RECORD</div>
                      <DocumentText
                        doc={doc}
                        categories={categories}
                        selected={span?.id || ''}
                        onSelect={(s) => {
                          setSelected(s);
                          setTab('redactions');
                        }}
                        redacted={false}
                      />
                    </div>
                    <div>
                      <div className="compare-label">CANDIDATE RELEASE</div>
                      <DocumentText
                        doc={doc}
                        categories={categories}
                        selected={span?.id || ''}
                        onSelect={(s) => {
                          setSelected(s);
                          setTab('redactions');
                        }}
                        redacted
                      />
                    </div>
                  </>
                ) : (
                  <DocumentText
                    doc={doc}
                    categories={categories}
                    selected={span?.id || ''}
                    onSelect={(s) => {
                      setSelected(s);
                      setTab('redactions');
                    }}
                    redacted={view === 'redacted'}
                  />
                )}
              </div>
              <div className="published-reference-bar">
                <div>
                  <BookOpen size={14} />
                  <span>
                    {doc.reference
                      ? 'Published reference attached'
                      : 'Compare against a published release'}
                  </span>
                </div>
                {doc.reference ? (
                  <button className="text-link" onClick={() => setView('published')}>
                    View comparison
                    <Columns2 size={13} />
                  </button>
                ) : (
                  !locked && (
                    <button className="text-link" onClick={() => setReferenceOpen(true)}>
                      <Plus size={13} />
                      Attach reference
                    </button>
                  )
                )}
              </div>
              {view === 'published' && doc.reference && (
                <div className="published-comparison">
                  <div>
                    <div className="compare-label">CANDIDATE RELEASE</div>
                    <DocumentText
                      doc={doc}
                      categories={categories}
                      selected={span?.id || ''}
                      onSelect={setSelected}
                      redacted
                    />
                  </div>
                  <div>
                    <div className="compare-label">
                      <a href={doc.reference.sourceUrl} target="_blank" rel="noreferrer">
                        PUBLISHED RELEASE <ExternalLink size={10} />
                      </a>
                    </div>
                    <article className="document-paper">
                      <div className="paper-header">
                        <span>PUBLIC REFERENCE</span>
                        <span>OFFICER PROVIDED</span>
                      </div>
                      <div className="document-text">{doc.reference.text}</div>
                    </article>
                  </div>
                </div>
              )}
              <div className="document-footer">
                <span>
                  {doc.pages} {doc.pages === 1 ? 'source page' : 'source pages'} · Text review
                </span>
                <span>
                  <LockKeyhole size={12} />
                  {locked ? 'Approved release' : 'Officer-only original'}
                </span>
              </div>
            </div>
            <aside className="review-aside">
              <div className="panel decision-panel">
                <div className="review-tabs">
                  <button
                    className={tab === 'redactions' ? 'active' : ''}
                    onClick={() => setTab('redactions')}
                  >
                    Redactions<span>{doc.spans.length}</span>
                  </button>
                  <button
                    className={tab === 'integrity' ? 'active' : ''}
                    onClick={() => setTab('integrity')}
                  >
                    Integrity<span className={unresolved ? 'alert' : ''}>{unresolved}</span>
                  </button>
                </div>
                {tab === 'redactions' ? (
                  <>
                    {doc.spans.length === 0 ? (
                      <Empty
                        title="No suggestions found"
                        description="Read the entire record. Local rules and AI can miss sensitive information."
                      />
                    ) : (
                      <>
                        <div className="redaction-nav">
                          <span>
                            Suggestion {doc.spans.findIndex((s) => s.id === span?.id) + 1} of{' '}
                            {doc.spans.length}
                          </span>
                          <div>
                            <IconButton label="Previous suggestion" onClick={() => prevNext(-1)}>
                              <ChevronLeft size={16} />
                            </IconButton>
                            <IconButton label="Next suggestion" onClick={() => prevNext(1)}>
                              <ChevronRight size={16} />
                            </IconButton>
                          </div>
                        </div>
                        <div className="decision-content">
                          <div className="category-heading">
                            <span
                              className="category-tile"
                              style={{ background: cat?.color + '18', color: cat?.color }}
                            >
                              <ShieldCheck size={22} />
                            </span>
                            <div>
                              <h3>{cat?.name}</h3>
                              <small>
                                {cat?.kind} · s. {cat?.section}
                              </small>
                            </div>
                          </div>
                          <div className="confidence">
                            <span>Suggestion confidence</span>
                            <strong className={span.confidence < 0.85 ? 'amber-text' : ''}>
                              {Math.round(span.confidence * 100)}%
                            </strong>
                            <div>
                              <i
                                style={{
                                  width: `${span.confidence * 100}%`,
                                  background: cat?.color,
                                }}
                              />
                            </div>
                          </div>
                          {span.confidence < 0.85 && (
                            <div className="low-confidence">
                              <AlertTriangle size={14} />
                              Lower confidence · assess carefully
                            </div>
                          )}
                          <div className="decision-label">SUGGESTED SPAN</div>
                          <blockquote className="sensitive-quote">
                            {doc.text.slice(span.start, span.end)}
                          </blockquote>
                          <div className="decision-label">WHY IT WAS FLAGGED</div>
                          <p className="justification">{span.justification}</p>
                          <a
                            className="text-link legal-link"
                            href={cat?.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Read section {cat?.section}
                            <ExternalLink size={13} />
                          </a>
                          <div className="decision-state">
                            <Badge
                              tone={
                                span.decision === 'approved'
                                  ? 'green'
                                  : span.decision === 'dismissed'
                                    ? 'neutral'
                                    : 'amber'
                              }
                            >
                              {span.decision === 'pending'
                                ? 'Awaiting your decision'
                                : span.decision === 'approved'
                                  ? 'Withholding approved'
                                  : 'Marked for disclosure'}
                            </Badge>
                            {span.reviewNote && <p>{span.reviewNote}</p>}
                          </div>
                          {!locked && (
                            <div className="decision-actions">
                              <button
                                className="button primary full-width"
                                disabled={busy || span.decision === 'approved'}
                                onClick={() =>
                                  action(
                                    `/requests/${id}/documents/${doc.id}/spans/${span.id}`,
                                    { decision: 'approved', note: span.reviewNote },
                                    'PATCH',
                                    'Withholding approved.',
                                  )
                                }
                              >
                                <Check size={16} />
                                Approve withholding
                              </button>
                              <div>
                                <button
                                  className="button secondary"
                                  disabled={busy}
                                  onClick={() => {
                                    setEdit(span);
                                    setNote('');
                                    setEditCat('disclose');
                                  }}
                                >
                                  Disclose / change
                                </button>
                                <button
                                  className="icon-button"
                                  disabled={busy || span.decision === 'pending'}
                                  title="Return to pending review"
                                  aria-label="Return to pending review"
                                  onClick={() =>
                                    action(
                                      `/requests/${id}/documents/${doc.id}/spans/${span.id}`,
                                      { decision: 'pending', note: '' },
                                      'PATCH',
                                      'Suggestion returned to review.',
                                    )
                                  }
                                >
                                  <RotateCcw size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="model-note">
                            <Info size={13} />
                            {span.source} · Suggestions support your judgment.
                          </div>
                        </div>
                      </>
                    )}
                    <div className="suggestion-list">
                      {doc.spans.map((s, i) => {
                        const c = categories.find((c) => c.id === s.category);
                        return (
                          <button
                            key={s.id}
                            className={s.id === span?.id ? 'active' : ''}
                            onClick={() => setSelected(s.id)}
                          >
                            <span
                              className="suggestion-num"
                              style={{ background: c?.color + '18', color: c?.color }}
                            >
                              {i + 1}
                            </span>
                            <span>
                              <strong>{c?.name}</strong>
                              <small>
                                s. {c?.section} · {Math.round(s.confidence * 100)}% confidence
                              </small>
                            </span>
                            {s.decision === 'pending' ? (
                              <span className="pending-circle" />
                            ) : (
                              <Check size={15} className="green-text" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="integrity-content">
                    <div className="integrity-score">
                      <span>Contextual leak risk</span>
                      {doc.integrity ? (
                        <Risk value={doc.integrity.risk} />
                      ) : (
                        <Badge tone="amber">Needs a fresh check</Badge>
                      )}
                    </div>
                    <p className="aside-description">
                      An independent tester checks only the candidate release. Similar prior
                      decisions provide a second perspective.
                    </p>
                    {doc.integrityError && (
                      <p className="warning-note" role="alert">
                        {doc.integrityError}
                      </p>
                    )}
                    {doc.integrity && (
                      <small className="muted">
                        {doc.integrity.tester} · {date(doc.integrity.checkedAt)}
                      </small>
                    )}
                    {allFindings.length === 0 ? (
                      <div className="small-empty">
                        <ShieldCheck size={27} />
                        <h3>
                          {doc.integrity ? 'No findings in this pass' : 'Run the integrity checks'}
                        </h3>
                        <p>
                          {doc.integrity
                            ? 'A clean pass supports review; it does not prove that disclosure is safe.'
                            : 'The candidate release changed. Test the current text before release.'}
                        </p>
                      </div>
                    ) : (
                      allFindings.map((f) => (
                        <div className={`finding-card ${f.resolved ? 'resolved' : ''}`} key={f.id}>
                          <div>
                            <Badge tone={f.resolved ? 'green' : f.clue ? 'amber' : 'purple'}>
                              {f.resolved
                                ? 'Resolved'
                                : f.clue
                                  ? 'Contextual leak'
                                  : 'Consistency conflict'}
                            </Badge>
                            {f.similarity && <small>{Math.round(f.similarity * 100)}% match</small>}
                          </div>
                          <p>{f.inference}</p>
                          <blockquote>{f.clue || f.excerpt}</blockquote>
                          {f.requestRef && (
                            <small>
                              {f.requestRef}
                              {f.synthetic ? ' · Demo reference' : ''}
                            </small>
                          )}
                          {f.resolved ? (
                            <p className="resolved-note">
                              <Check size={13} />
                              {f.note}
                            </p>
                          ) : (
                            !locked && (
                              <button className="text-link" onClick={() => setFinding(f)}>
                                Review finding
                                <ArrowRight size={14} />
                              </button>
                            )
                          )}
                        </div>
                      ))
                    )}
                    {!locked && (
                      <button
                        className="button secondary full-width"
                        disabled={busy}
                        onClick={() =>
                          action(
                            `/requests/${id}/integrity`,
                            {},
                            'POST',
                            'Integrity checks completed.',
                          )
                        }
                      >
                        <ShieldCheck size={16} />
                        {busy ? 'Running checks…' : 'Run integrity checks'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="review-note">
                <ShieldCheck size={17} />
                <div>
                  <strong>Your judgment is the final word.</strong>
                  <p>
                    Review exceptions, injury tests, discretion, and the entire record before
                    release.
                  </p>
                </div>
              </div>
            </aside>
          </div>
          <div className="attestation-bar">
            <div>
              <span className="icon-tile green">
                <CheckCheck size={20} />
              </span>
              <div>
                <strong>Finish with a full-document review</strong>
                <p>
                  Confirm you reviewed unmarked text, statutory conditions, exceptions, and
                  remaining disclosure risks.
                </p>
              </div>
            </div>
            {locked ? (
              <Badge tone="green">Review confirmed</Badge>
            ) : (
              <label className="attestation-check">
                <input
                  type="checkbox"
                  checked={doc.attested}
                  disabled={busy || doc.attested}
                  onChange={() => {
                    setRecord({
                      ...record,
                      documents: record.documents.map((d) =>
                        d.id === doc.id ? { ...d, attested: true } : d,
                      ),
                    });
                    action(
                      `/requests/${id}/documents/${doc.id}/attestation`,
                      { attested: true },
                      'PATCH',
                      'Full document review confirmed.',
                    );
                  }}
                />
                I have reviewed the entire record
              </label>
            )}
          </div>
        </>
      )}
      {edit && doc && (
        <Modal
          title="Record your review decision"
          subtitle="Disclosure and category changes require a rationale."
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(
                `/requests/${id}/documents/${doc.id}/spans/${edit.id}`,
                {
                  decision: editCat === 'disclose' ? 'dismissed' : 'approved',
                  category: editCat === 'disclose' ? edit.category : editCat,
                  note,
                },
                'PATCH',
                'Review decision saved.',
              );
            }}
          >
            <label>
              Decision
              <select value={editCat} onChange={(e) => setEditCat(e.target.value)}>
                <option value="disclose">Disclose this span</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    Withhold · {c.name} · s. {c.section}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rationale
              <textarea
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Explain why disclosure is appropriate or why this legal category applies."
              />
            </label>
            <div className="form-note">
              Changes automatically trigger fresh integrity checks before release.
            </div>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button className="button primary" disabled={busy || !note.trim()}>
                <Check size={16} />
                Save decision
              </button>
            </div>
          </form>
        </Modal>
      )}
      {finding && doc && (
        <FindingDialog
          finding={finding}
          id={id}
          docId={doc.id}
          notify={notify}
          onClose={() => setFinding(null)}
          onResolved={saved}
        />
      )}
      {manual !== null && doc && (
        <ManualDialog
          doc={doc}
          id={id}
          categories={categories}
          selectedText={manual}
          onClose={() => setManual(null)}
          onSaved={saved}
          notify={notify}
        />
      )}
      {exportOpen && (
        <Modal
          title={locked ? 'Download the approved release' : 'Export the candidate release'}
          subtitle={
            locked
              ? 'Reviewed records, ready to share.'
              : 'Draft exports are marked as not approved for release.'
          }
          onClose={() => setExportOpen(false)}
        >
          <div className="export-options">
            {[
              [
                'pdf',
                'Redacted PDF',
                'A fresh PDF containing replaced text, with no original source bytes.',
              ],
              ['txt', 'Redacted text', 'A portable text version of every candidate document.'],
              [
                'json',
                'Officer decision log',
                'Legal categories, review rationales and integrity findings for your records.',
              ],
            ].map(([format, title, description]) => (
              <a
                key={format}
                href={`/api/requests/${id}/export/${format}`}
                className="export-option"
              >
                <span className="icon-tile green">
                  <Download size={19} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
          <div className="form-note">
            <ShieldCheck size={15} />
            <span>
              Requester access is limited to approved PDF and text releases. The decision log is
              officer-only.
            </span>
          </div>
        </Modal>
      )}
      {referenceOpen && doc && (
        <Modal
          title="Compare with a published release"
          subtitle="Attach the actual publicly released version of this record."
          onClose={() => setReferenceOpen(false)}
          wide
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await action(
                `/requests/${id}/documents/${doc.id}/reference`,
                { text: referenceText, sourceUrl: referenceUrl },
                'PUT',
                'Published reference attached for comparison.',
              );
              if (ok) {
                setReferenceOpen(false);
                setView('published');
              }
            }}
          >
            <label>
              Public source URL
              <input
                type="url"
                required
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label>
              Published record text
              <textarea
                required
                rows={8}
                maxLength={120000}
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                placeholder="Paste the released version, including its redaction markers."
              />
            </label>
            <div className="form-note">
              The original unreleased text is never inferred from this reference. The comparison is
              for officer assessment and does not automatically approve redactions.
            </div>
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setReferenceOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || !referenceText.trim() || !referenceUrl.trim()}
              >
                <BookOpen size={15} />
                Attach comparison
              </button>
            </div>
          </form>
        </Modal>
      )}
      {release && (
        <Modal
          title="Approve this release"
          subtitle="Make the reviewed records available to the requester."
          onClose={() => setRelease(false)}
        >
          <div className="release-summary">
            <ShieldCheck size={40} />
            <h3>{record.title}</h3>
            <p>
              {record.documents.length} reviewed documents · All suggestions decided · Integrity
              findings resolved
            </p>
            <p>
              The requester receives the redacted records. Your approval is recorded in the activity
              log.
            </p>
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setRelease(false)}>
              Keep reviewing
            </button>
            <button
              className="button primary"
              disabled={busy || !ready}
              onClick={async () => {
                const ok = await action(
                  `/requests/${id}/release`,
                  {},
                  'POST',
                  'Release approved. The requester can now access the reviewed documents.',
                );
                if (ok) setRelease(false);
              }}
            >
              <ShieldCheck size={16} />
              Approve & release
            </button>
          </div>
        </Modal>
      )}
      {reopen && (
        <Modal
          title="Reopen this request"
          subtitle="The requester’s release will be withdrawn while you review again."
          onClose={() => setReopen(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await action(
                `/requests/${id}/reopen`,
                { note },
                'POST',
                'Request reopened for review.',
              );
              if (ok) setReopen(false);
            }}
          >
            <label>
              Reason for reopening
              <textarea value={note} onChange={(e) => setNote(e.target.value)} required rows={4} />
            </label>
            <div className="modal-actions">
              <button className="button secondary" type="button" onClick={() => setReopen(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={busy || !note.trim()}>
                Reopen request
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function DocumentText({
  doc,
  categories,
  selected,
  onSelect,
  redacted,
}: {
  doc: Doc;
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
  redacted: boolean;
}) {
  const spans = [...doc.spans].sort((a, b) => a.start - b.start),
    parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const s of spans) {
    parts.push(doc.text.slice(cursor, s.start));
    const c = categories.find((c) => c.id === s.category),
      hide = redacted && s.decision !== 'dismissed';
    parts.push(
      <button
        key={s.id}
        className={`text-span ${hide ? 'blacked-out' : ''} ${selected === s.id ? 'selected' : ''} ${s.decision === 'dismissed' ? 'disclosed' : ''}`}
        style={{ '--span-color': c?.color } as CSSProperties}
        title={`${c?.name} · s. ${c?.section} · ${s.justification}`}
        aria-label={`Suggestion: ${c?.name}, section ${c?.section}`}
        onClick={() => onSelect(s.id)}
      >
        {hide ? `[REDACTED · s. ${c?.section}]` : doc.text.slice(s.start, s.end)}
      </button>,
    );
    cursor = s.end;
  }
  parts.push(doc.text.slice(cursor));
  return (
    <article className="document-paper">
      <div className="paper-header">
        <span>GOVERNMENT RECORD</span>
        <span>{redacted ? 'CANDIDATE RELEASE' : 'ORIGINAL'}</span>
      </div>
      <div className="document-text">{parts}</div>
      <div className="paper-footer">
        {redacted
          ? 'Redacted text preview · Removed content is replaced, not overlaid.'
          : 'Highlighted spans are suggestions for officer review.'}
      </div>
    </article>
  );
}
