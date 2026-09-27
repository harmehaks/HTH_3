import { useState, useEffect, type FormEvent } from 'react';
import {
  Search,
  Plus,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  Check,
  FileText,
  Download,
  Activity,
  RefreshCw,
  Settings2,
  Database,
  KeyRound,
  Headphones,
  Sparkles,
  Link2,
  LoaderCircle,
  ExternalLink,
  Clock3,
  LockKeyhole,
} from 'lucide-react';
import { api, send, downloadJSON } from './api';
import {
  Badge,
  Status,
  Risk,
  RequestTable,
  Empty,
  Loading,
  Modal,
  SectionHeading,
  date,
  daysLeft,
} from './components';
import { FindingDialog } from './Dialogs';
import type {
  RequestSummary,
  RequestRecord,
  Category,
  Corpus,
  Audit,
  Settings,
  Finding,
} from './types';
type Notify = (s: string, error?: boolean) => void;
export function RequestsPage({
  requests,
  onOpen,
  onNew,
  search,
}: {
  requests: RequestSummary[];
  onOpen: (id: string) => void;
  onNew: () => void;
  search: string;
}) {
  const [tab, setTab] = useState('all'),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('due');
  const filtered = requests
    .filter(
      (r) =>
        (tab === 'all' ||
          (tab === 'overdue' && r.status !== 'released' && daysLeft(r.dueAt) < 0) ||
          r.status === tab) &&
        `${r.title} ${r.id} ${r.department}`
          .toLowerCase()
          .includes((search || query).toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'due'
        ? a.dueAt.localeCompare(b.dueAt)
        : sort === 'risk'
          ? b.risk - a.risk
          : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM REQUEST TO RELEASE</div>
          <h1>
            One queue. A clearer view<span className="heading-dot">.</span>
          </h1>
          <p>Keep every record, review, and deadline in focus.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={17} />
          New request
        </button>
      </div>
      <div className="panel">
        <div className="list-controls">
          <div className="filter-tabs">
            {[
              ['all', 'All requests'],
              ['in_review', 'In review'],
              ['received', 'Received'],
              ['released', 'Released'],
              ['overdue', 'Overdue'],
            ].map(([value, label]) => (
              <button
                className={tab === value ? 'active' : ''}
                key={value}
                onClick={() => setTab(value)}
              >
                {label}
                <span>
                  {
                    requests.filter(
                      (r) =>
                        value === 'all' ||
                        (value === 'overdue' && r.status !== 'released' && daysLeft(r.dueAt) < 0) ||
                        r.status === value,
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <div className="list-search-row">
            <div className="input-search">
              <Search size={16} />
              <input
                aria-label="Search requests"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search requests, institutions, references…"
              />
            </div>
            <select
              aria-label="Sort requests"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="due">Target date: earliest first</option>
              <option value="risk">Leak risk: highest first</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
        </div>
        <RequestTable items={filtered} onOpen={onOpen} />
        <div className="table-footer">
          <span>
            Showing {filtered.length} of {requests.length} requests
          </span>
          <span>
            <LockKeyhole size={12} />
            Officer workspace
          </span>
        </div>
      </div>
      <div className="info-strip">
        <Clock3 size={18} />
        <p>
          Dates start with a 30-day target. Assess statutory extensions and institution-specific
          requirements separately.
        </p>
      </div>
    </>
  );
}
export function IntegrityPage({
  requests,
  onOpen,
  notify,
  onChanged,
  search,
}: {
  requests: RequestSummary[];
  onOpen: (id: string) => void;
  notify: Notify;
  onChanged: () => void;
  search: string;
}) {
  const [records, setRecords] = useState<RequestRecord[]>([]),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(''),
    [tab, setTab] = useState('all'),
    [selected, setSelected] = useState(''),
    [resolve, setResolve] = useState<{ f: Finding; r: RequestRecord; docId: string } | null>(null);
  const load = () => {
    setError('');
    Promise.all(
      requests
        .filter((r) => r.status !== 'released')
        .map((r) => api<RequestRecord>(`/requests/${r.id}`)),
    )
      .then((rs) => {
        setRecords(rs);
        setSelected((prev) => prev || rs[0]?.id || '');
        setLoaded(true);
      })
      .catch((e) => {
        setError(e.message);
        setLoaded(true);
      });
  };
  useEffect(load, [requests]);
  const findings = records.flatMap((r) =>
      r.documents.flatMap((d) =>
        [...(d.integrity?.leaks || []), ...(d.integrity?.conflicts || [])].map((f) => ({
          f,
          r,
          docId: d.id,
        })),
      ),
    ),
    leaks = findings.filter((x) => x.f.clue && !x.f.resolved).length,
    conflicts = findings.filter((x) => !x.f.clue && !x.f.resolved).length;
  async function run() {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/requests/${selected}/integrity`, send({}));
      notify('Independent checks completed on the current candidate release.');
      onChanged();
      load();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const visible = findings.filter(
    (x) =>
      ((tab === 'all' && !x.f.resolved) ||
        (tab === 'leaks' && x.f.clue && !x.f.resolved) ||
        (tab === 'conflicts' && !x.f.clue && !x.f.resolved) ||
        (tab === 'resolved' && x.f.resolved)) &&
      `${x.r.title} ${x.f.inference} ${x.f.requestRef || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A SECOND PERSPECTIVE</div>
          <h1>
            Confidence is a team effort<span className="heading-dot">.</span>
          </h1>
          <p>Catch what a black box might miss. Learn from what came before.</p>
        </div>
        <Badge tone="green">
          <ShieldCheck size={14} />
          Independent checks
        </Badge>
      </div>
      <div className="integrity-hero">
        <div>
          <span className="icon-tile orange">
            <AlertTriangle size={23} />
          </span>
          <h2>Can context fill in the blanks?</h2>
          <p>
            The leak tester sees only the proposed redacted output and looks for clues that could
            reveal withheld information.
          </p>
          <span className="integrity-number">
            {leaks}
            <small>unresolved leak findings</small>
          </span>
        </div>
        <div>
          <span className="icon-tile purple">
            <BookOpen size={23} />
          </span>
          <h2>Have we treated this differently?</h2>
          <p>
            The consistency engine compares suggested redactions with indexed release excerpts. A
            match prompts review, not an automatic decision.
          </p>
          <span className="integrity-number">
            {conflicts}
            <small>unresolved consistency findings</small>
          </span>
        </div>
      </div>
      <div className="run-checks panel">
        <div>
          <ShieldCheck size={23} />
          <div>
            <strong>Test a candidate release</strong>
            <p>Changes to redactions require a fresh integrity pass.</p>
          </div>
        </div>
        <select
          aria-label="Request to test"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {records.map((r) => (
            <option value={r.id} key={r.id}>
              {r.title}
            </option>
          ))}
        </select>
        <button className="button primary" disabled={busy || !selected} onClick={run}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{' '}
          {busy ? 'Testing…' : 'Run checks'}
        </button>
      </div>
      <div className="filter-tabs standalone">
        {[
          ['all', 'All open findings'],
          ['leaks', 'Contextual leaks'],
          ['conflicts', 'Consistency conflicts'],
          ['resolved', 'Resolved'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? 'active' : ''}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {!loaded ? (
        <Loading />
      ) : error ? (
        <Empty
          title="Checks could not be loaded"
          description={error}
          action={
            <button className="button secondary" onClick={load}>
              Retry
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <div className="panel">
          <Empty
            title={tab === 'resolved' ? 'No resolved findings yet' : 'No findings in this view'}
            description="Continue full-document review. Automated checks cannot guarantee a safe release."
          />
        </div>
      ) : (
        <div className="lab-findings">
          {visible.map(({ f, r, docId }) => (
            <div className="panel lab-finding" key={f.id}>
              <div className="lab-finding-top">
                <Badge tone={f.resolved ? 'green' : f.clue ? 'amber' : 'purple'}>
                  {f.resolved ? 'Resolved' : f.clue ? 'Contextual leak' : 'Consistency conflict'}
                </Badge>
                <span>{r.id}</span>
                {f.similarity && (
                  <span className="similarity">{Math.round(f.similarity * 100)}% similarity</span>
                )}
              </div>
              <h3>{r.title}</h3>
              <p>{f.inference}</p>
              <blockquote>{f.clue || f.excerpt}</blockquote>
              {f.synthetic && <small className="muted">Synthetic reference · {f.requestRef}</small>}
              {f.sourceUrl && (
                <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-link">
                  Public source
                  <ExternalLink size={13} />
                </a>
              )}
              {f.resolved && (
                <p className="resolved-note">
                  <Check size={14} />
                  {f.note}
                </p>
              )}
              <div className="lab-finding-actions">
                <button className="text-link" onClick={() => onOpen(r.id)}>
                  Open document
                  <ArrowUpRight size={15} />
                </button>
                {!f.resolved && (
                  <button
                    className="button secondary small"
                    onClick={() => setResolve({ f, r, docId })}
                  >
                    Review finding
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {resolve && (
        <FindingDialog
          finding={resolve.f}
          id={resolve.r.id}
          docId={resolve.docId}
          onClose={() => setResolve(null)}
          notify={notify}
          onResolved={() => {
            setResolve(null);
            onChanged();
            load();
          }}
        />
      )}
    </>
  );
}
export function LibraryPage({
  categories,
  notify,
  search,
}: {
  categories: Category[];
  notify: Notify;
  search: string;
}) {
  const [items, setItems] = useState<Corpus[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(''),
    [tab, setTab] = useState('all'),
    [add, setAdd] = useState(false),
    [selected, setSelected] = useState<Corpus | null>(null),
    [busy, setBusy] = useState(false),
    [treatment, setTreatment] = useState('released');
  const load = () =>
    api<Corpus[]>('/corpus')
      .then((d) => {
        setItems(d);
        setLoaded(true);
      })
      .catch((e) => {
        setError(e.message);
        setLoaded(true);
      });
  useEffect(() => {
    load();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api('/corpus', send(Object.fromEntries(f)));
      setAdd(false);
      load();
      notify('Public excerpt added and indexed.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function reindex() {
    setBusy(true);
    try {
      const r = await api<{ count: number }>('/corpus/reindex', send({}));
      load();
      notify(`${r.count} references indexed with the current embedding provider.`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function starter() {
    setBusy(true);
    try {
      const r = await api<{ count: number }>('/corpus/starter', send({}));
      load();
      notify(`${r.count} public starter references added.`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter(
    (c) =>
      (tab === 'all' ||
        (tab === 'public' && !c.synthetic) ||
        (tab === 'ati' && c.sourceType === 'ati_release') ||
        (tab === 'demo' && c.synthetic)) &&
      `${c.text} ${c.title} ${c.requestRef}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">INSTITUTIONAL MEMORY</div>
          <h1>
            Better decisions start with context<span className="heading-dot">.</span>
          </h1>
          <p>A searchable reference library for cross-request consistency.</p>
        </div>
        <button className="button primary" onClick={() => setAdd(true)}>
          <Plus size={17} />
          Add public reference
        </button>
      </div>
      <div className="library-callout">
        <BookOpen size={25} />
        <div>
          <strong>A reference is a starting point, never a precedent.</strong>
          <p>
            Previous releases may have different facts, dates, exceptions, or injury assessments.
            Imported sources are officer-provided. Demo excerpts are synthetic and clearly marked.
          </p>
        </div>
      </div>
      <div className="library-controls">
        <div className="filter-tabs">
          {[
            ['all', 'All references'],
            ['public', 'Public sources'],
            ['ati', 'ATI releases'],
            ['demo', 'Demo examples'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={tab === value ? 'active' : ''}
              onClick={() => setTab(value)}
            >
              {label}
              <span>
                {
                  items.filter(
                    (c) =>
                      value === 'all' ||
                      (value === 'public' && !c.synthetic) ||
                      (value === 'ati' && c.sourceType === 'ati_release') ||
                      (value === 'demo' && c.synthetic),
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="library-tool-buttons">
          {items.filter((c) => c.id.startsWith('public-') || c.id.startsWith('ati-lac-')).length <
            24 && (
            <button className="button secondary small" disabled={busy} onClick={starter}>
              <BookOpen size={14} />
              Load public starter set
            </button>
          )}
          <button className="button secondary small" disabled={busy} onClick={reindex}>
            <RefreshCw size={14} className={busy ? 'spin' : ''} />
            Reindex library
          </button>
        </div>
      </div>
      {!loaded ? (
        <Loading />
      ) : error ? (
        <Empty title="Library unavailable" description={error} />
      ) : visible.length === 0 ? (
        <Empty
          title="No matching references"
          description="Add an excerpt from a real released ATI record with its public source URL."
        />
      ) : (
        <div className="corpus-grid">
          {visible.map((c) => (
            <button className="panel corpus-card" key={c.id} onClick={() => setSelected(c)}>
              <div>
                <span className="icon-tile purple">
                  <BookOpen size={18} />
                </span>
                <Badge tone={c.synthetic ? 'neutral' : 'green'}>
                  {c.synthetic
                    ? 'Synthetic demo'
                    : c.sourceType === 'ati_release'
                      ? 'ATI release'
                      : c.sourceType === 'proactive_publication'
                        ? 'Proactive publication'
                        : 'Public source'}
                </Badge>
              </div>
              <small className="corpus-reference">{c.requestRef}</small>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <div className="corpus-bottom">
                <span>
                  <Check size={13} />
                  {c.treatment === 'released'
                    ? 'Disclosed'
                    : `Withheld · s. ${categories.find((x) => x.id === c.category)?.section}`}
                </span>
                <ArrowUpRight size={17} />
              </div>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <Modal
          title={selected.title}
          subtitle={`${selected.requestRef} · ${selected.synthetic ? 'Synthetic demonstration excerpt' : 'Source-linked public reference'}`}
          onClose={() => setSelected(null)}
        >
          <blockquote className="library-excerpt">{selected.text}</blockquote>
          {selected.sourceType === 'ati_release' && (
            <div className="notice">
              <strong>
                {selected.publisher} · PDF page {selected.sourcePage}
              </strong>
              <p>
                {selected.sourceFile} · Package: {selected.sourceDisposition}. This excerpt was
                disclosed; the package may contain other withheld material.
              </p>
              <p>{selected.verification}</p>
            </div>
          )}
          <div className="reference-details">
            <span>
              Treatment<strong>{selected.treatment}</strong>
            </span>
            <span>
              Embedding provider<strong>{selected.embeddingModel}</strong>
            </span>
            <span>
              Added<strong>{date(selected.addedAt)}</strong>
            </span>
          </div>
          {selected.sourceUrl && (
            <a
              className="button secondary"
              target="_blank"
              href={selected.sourceUrl}
              rel="noreferrer"
            >
              <ExternalLink size={15} />
              View public source
            </a>
          )}
        </Modal>
      )}
      {add && (
        <Modal
          title="Add a public release reference"
          subtitle="Bring an actual released excerpt into your consistency checks."
          onClose={() => setAdd(false)}
          wide
        >
          <form onSubmit={submit}>
            <div className="form-grid">
              <label>
                Request reference
                <input name="requestRef" required placeholder="e.g. A-2025-004521" />
              </label>
              <label>
                Record title
                <input name="title" required placeholder="Regional program briefing" />
              </label>
            </div>
            <label>
              Public source URL
              <input name="sourceUrl" type="url" required placeholder="https://…" />
            </label>
            <label>
              Released excerpt
              <textarea
                name="text"
                required
                rows={5}
                maxLength={20000}
                placeholder="Paste text from the public release. Do not enter unreleased sensitive content."
              />
            </label>
            <div className="form-grid">
              <label>
                Prior treatment
                <select
                  name="treatment"
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                >
                  <option value="released">Disclosed</option>
                  <option value="withheld">Withheld</option>
                </select>
              </label>
              {treatment === 'withheld' && (
                <label>
                  Prior category
                  <select name="category">
                    {categories.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name} · s. {c.section}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="form-note">
              <Link2 size={15} />
              <span>
                You are responsible for checking the source and the recorded treatment. The app
                indexes the supplied text without fetching the URL.
              </span>
            </div>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setAdd(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}Add & index
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function ActivityPage({
  search,
  onOpen,
  notify,
}: {
  search: string;
  onOpen: (id: string) => void;
  notify: Notify;
}) {
  const [events, setEvents] = useState<Audit[]>([]),
    [valid, setValid] = useState(true),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api<{ events: Audit[]; valid: boolean }>('/audit')
      .then((d) => {
        setEvents(d.events);
        setValid(d.valid);
        setLoaded(true);
      })
      .catch((e) => {
        notify(e.message, true);
        setLoaded(true);
      });
  }, []);
  const filtered = events.filter((e) =>
    `${e.action} ${e.detail} ${e.actor} ${e.requestId}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVERY DECISION, ACCOUNTED FOR</div>
          <h1>
            A record you can follow<span className="heading-dot">.</span>
          </h1>
          <p>Review decisions, integrity checks, and release approvals in one place.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => downloadJSON('mr-redactor-activity.json', { valid, events })}
        >
          <Download size={16} />
          Export activity
        </button>
      </div>
      <div className={`audit-banner ${!valid ? 'invalid' : ''}`}>
        <ShieldCheck size={22} />
        <div>
          <strong>
            {valid ? 'Activity chain verified' : 'Activity chain verification failed'}
          </strong>
          <p>
            Events are linked by SHA-256 hashes. This detects changes within the stored chain; it is
            not an externally certified audit trail.
          </p>
        </div>
        <Badge tone={valid ? 'green' : 'amber'}>{valid ? 'Verified' : 'Needs investigation'}</Badge>
      </div>
      <div className="panel activity-panel">
        {!loaded ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty title="No matching activity" description="Your review actions will appear here." />
        ) : (
          filtered.map((e) => (
            <div className="activity-row" key={e.id}>
              <span className="activity-icon">
                <Activity size={18} />
              </span>
              <div>
                <div>
                  <h3>{e.action}</h3>
                  {e.requestId && (
                    <button className="text-link" onClick={() => onOpen(e.requestId!)}>
                      {e.requestId}
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
                <p>{e.detail}</p>
                <small>
                  {e.actor} · {new Date(e.at).toLocaleString('en-CA')}
                </small>
              </div>
              <Check size={15} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
export function SettingsPage({ notify }: { notify: Notify }) {
  const [settings, setSettings] = useState<Settings | null>(null),
    [configure, setConfigure] = useState<string | null>(null);
  useEffect(() => {
    api<Settings>('/settings')
      .then(setSettings)
      .catch((e) => notify(e.message, true));
  }, []);
  if (!settings) return <Loading />;
  const integrations = [
    {
      name: 'Gemini',
      description:
        'Span classification, legal justifications, independent leak testing, and embeddings.',
      icon: <Sparkles size={23} />,
      enabled: settings.classification === 'Gemini',
      status: settings.classification,
      env: 'GEMINI_API_KEY\nGEMINI_MODEL=gemini-2.5-flash\nGEMINI_EMBEDDING_MODEL=gemini-embedding-001',
    },
    {
      name: 'Auth0',
      description:
        'Authenticated officer and requester roles, with permissions enforced by the server.',
      icon: <KeyRound size={23} />,
      enabled: settings.auth === 'Auth0',
      status: settings.auth,
      env: 'DEMO_MODE=false\nSESSION_SECRET=<32+ random characters>\nAUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com\nAUTH0_CLIENT_ID=<application ID>\nAUTH0_CLIENT_SECRET=<application secret>\nAUTH0_BASE_URL=http://localhost:5173\nAUTH0_ROLES_CLAIM=https://redactor.app/roles',
    },
    {
      name: 'Tiger Data',
      description: 'Persistent PostgreSQL records and a pgvector index for similarity searches.',
      icon: <Database size={23} />,
      enabled: settings.storage.includes('PostgreSQL'),
      status: settings.storage,
      env: 'DATABASE_URL=postgresql://user:password@host:5432/database\nDATABASE_SSL=true',
    },
    {
      name: 'ElevenLabs',
      description: 'An on-demand spoken briefing of the officer’s queue and review priorities.',
      icon: <Headphones size={23} />,
      enabled: settings.voice === 'ElevenLabs',
      status: settings.voice,
      env: 'ELEVENLABS_API_KEY=<API key>\nELEVENLABS_VOICE_ID=<voice ID>',
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE THE WORKSPACE YOURS</div>
          <h1>
            Thoughtfully connected<span className="heading-dot">.</span>
          </h1>
          <p>See how your workspace is running and connect your services.</p>
        </div>
        <Badge tone={settings.demo ? 'amber' : 'green'}>
          {settings.demo ? 'Local demonstration' : 'Authenticated workspace'}
        </Badge>
      </div>
      <div className="settings-grid">
        {integrations.map((i) => (
          <div className="panel integration-card" key={i.name}>
            <div className="integration-top">
              <span className="integration-icon">{i.icon}</span>
              <Badge tone={i.enabled ? 'green' : 'neutral'}>
                {i.enabled ? 'Configured' : 'Local fallback'}
              </Badge>
            </div>
            <h2>{i.name}</h2>
            <p>{i.description}</p>
            <div className="integration-status">
              <span>Currently using</span>
              <strong>{i.status}</strong>
            </div>
            <button className="button secondary full-width" onClick={() => setConfigure(i.name)}>
              <Settings2 size={15} />
              Configuration guide
              <ArrowUpRight size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="panel settings-principles">
        <SectionHeading
          title="Review defaults"
          description="Human review is built into the release workflow."
        />
        <div>
          <span>
            <strong>Lower confidence threshold</strong>
            <p>Suggestions below 85% receive an extra review flag.</p>
          </span>
          <Badge tone="purple">85%</Badge>
        </div>
        <div>
          <span>
            <strong>Release approval</strong>
            <p>Every suggestion decided, every finding resolved, every document reviewed.</p>
          </span>
          <Badge tone="green">Required</Badge>
        </div>
        <div>
          <span>
            <strong>Integrity freshness</strong>
            <p>Changes to the candidate release invalidate previous integrity checks.</p>
          </span>
          <Badge tone="green">Enforced</Badge>
        </div>
        <div>
          <span>
            <strong>Requester access</strong>
            <p>Only the requester’s own approved releases can be retrieved.</p>
          </span>
          <Badge tone="green">Server enforced</Badge>
        </div>
      </div>
      {configure && (
        <Modal
          title={`Connect ${configure}`}
          subtitle="Keep credentials on the server, outside the browser."
          onClose={() => setConfigure(null)}
        >
          <p className="configuration-copy">
            Copy <code>.env.example</code> to <code>.env</code> in the project root. Set these
            values, then restart the server. See README.md for setup details and role configuration.
          </p>
          <pre className="env-block">{integrations.find((i) => i.name === configure)?.env}</pre>
          {configure === 'Auth0' && (
            <div className="form-note">
              Create a Regular Web Application with callback URL{' '}
              <code>http://localhost:5173/callback</code>. Add an Auth0 Action that writes assigned
              roles to the namespaced ID-token claim. The role named <code>officer</code> grants
              officer access; other authenticated users are requesters.
            </div>
          )}
          {configure === 'Gemini' && (
            <div className="form-note">
              Once connected, document content is sent to Gemini. Reindex the reference library to
              use the same embedding model.
            </div>
          )}
          {configure === 'Tiger Data' && (
            <div className="form-note">
              The database account needs permission to enable the vector extension. A new database
              starts independently from the local SQLite workspace.
            </div>
          )}
          <div className="modal-actions">
            <button className="button primary" onClick={() => setConfigure(null)}>
              Got it
              <Check size={15} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function RequesterPortal({
  requests,
  onNew,
  notify,
  search,
}: {
  requests: RequestSummary[];
  onNew: () => void;
  notify: Notify;
  search: string;
}) {
  const [selected, setSelected] = useState<RequestRecord | null>(null),
    [busy, setBusy] = useState(false);
  async function open(id: string) {
    setBusy(true);
    try {
      setSelected(await api<RequestRecord>(`/requests/${id}`));
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const visible = requests.filter((r) =>
    `${r.id} ${r.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR RIGHT TO KNOW</div>
          <h1>
            Information, a little more accessible<span className="heading-dot">.</span>
          </h1>
          <p>Follow your requests and access records when they’re ready.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={17} />
          Make a request
        </button>
      </div>
      <div className="portal-banner">
        <ParliamentHill />
        <div>
          <ShieldCheck size={27} />
          <h2>A clear view of what happens next.</h2>
          <p>
            Your request moves from receipt to officer review to release. Withheld information is
            identified by its applicable legal section.
          </p>
        </div>
        <div className="portal-steps">
          <span>
            <FileText size={19} />
            Received
          </span>
          <ArrowRight size={18} />
          <span>
            <Search size={19} />
            In review
          </span>
          <ArrowRight size={18} />
          <span>
            <Check size={19} />
            Released
          </span>
        </div>
      </div>
      <SectionHeading
        title="Your access requests"
        description={`${requests.length} requests in your portal`}
      />{' '}
      {visible.length === 0 ? (
        <div className="panel">
          <Empty
            title="Start with a question"
            description="Create your first request for records."
            action={
              <button className="button primary" onClick={onNew}>
                Make a request
              </button>
            }
          />
        </div>
      ) : (
        <div className="portal-grid">
          {visible.map((r) => (
            <div className="panel portal-request" key={r.id}>
              <div>
                <Badge>{r.id}</Badge>
                <Status status={r.status} />
              </div>
              <h2>{r.title}</h2>
              <p>{r.department}</p>
              <div className="portal-timeline">
                {['received', 'in_review', 'released'].map((s, i) => (
                  <span
                    key={s}
                    className={
                      r.status === 'released' ||
                      (r.status === 'in_review' && i < 2) ||
                      (r.status === 'received' && i === 0)
                        ? 'active'
                        : ''
                    }
                  >
                    <i />
                    {s === 'received'
                      ? 'Received'
                      : s === 'in_review'
                        ? 'Officer review'
                        : 'Released'}
                  </span>
                ))}
              </div>
              <div className="portal-request-bottom">
                <span>
                  {r.status === 'released'
                    ? `Released ${date(r.releasedAt!)}`
                    : `Target ${date(r.dueAt)}`}
                </span>
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => open(r.id)}
                >
                  {r.status === 'released' ? 'View release' : 'View request'}
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <Modal
          title={selected.title}
          subtitle={`${selected.id} · ${selected.department}`}
          onClose={() => setSelected(null)}
          wide
        >
          <Status status={selected.status} />
          <p className="portal-description">{selected.description}</p>
          {selected.status === 'released' ? (
            <>
              <div className="released-records">
                {selected.documents.map((d) => (
                  <div key={d.id}>
                    <h3>
                      <FileText size={17} />
                      {d.name}
                    </h3>
                    <pre>{d.text}</pre>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <a className="button secondary" href={`/api/requests/${selected.id}/export/txt`}>
                  <Download size={16} />
                  Download text
                </a>
                <a className="button primary" href={`/api/requests/${selected.id}/export/pdf`}>
                  <Download size={16} />
                  Download PDF
                </a>
              </div>
            </>
          ) : (
            <div className="request-pending">
              <Clock3 size={30} />
              <h3>Your records are being prepared.</h3>
              <p>
                Documents appear here after an officer reviews and approves the release. Your target
                date is {date(selected.dueAt)}.
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
// Parliament Hill silhouette: Centre Block, Peace Tower and the Library rotunda.
export function ParliamentHill() {
  return (
    <svg
      className="parliament-hill"
      viewBox="0 0 1200 132"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#0b0906">
        <path d="M16 132v-22h30V92l14-16 14 16v18h30v22z" />
        <path d="M96 132v-24h72v24z" />
        <path d="M156 132V78l15-16 15 16v54z" />
        <path d="M180 132v-28h118v28z" />
        <path d="M292 132V96h68V82h136v14h68v36z" />
        <path d="M398 96V34h60v62z" />
        <path d="M428 2l34 32h-68z" />
        <path d="M700 132V78l15-16 15 16v54z" />
        <path d="M628 132v-28h84v28z" />
        <path d="M740 132v-36l60-34 60 34v36z" />
        <path d="M800 50l20 12h-40z" />
        <path d="M860 132v-26h122v26z" />
        <path d="M998 132V84l14-15 14 15v48z" />
        <path d="M1022 132v-24h108v24z" />
        <path d="M1108 132v-22h26V92l14-16 14 16v18h22v22z" />
      </g>
      <g fill="#e3d5b8" opacity="0.2">
        <circle cx="428" cy="52" r="9" />
      </g>
      <g fill="#e3d5b8" opacity="0.1">
        <rect x="330" y="104" width="8" height="20" rx="4" />
        <rect x="352" y="104" width="8" height="20" rx="4" />
        <rect x="520" y="104" width="8" height="20" rx="4" />
        <rect x="542" y="104" width="8" height="20" rx="4" />
        <rect x="778" y="104" width="9" height="22" rx="4.5" />
        <rect x="812" y="104" width="9" height="22" rx="4.5" />
        <rect x="210" y="112" width="8" height="18" rx="4" />
        <rect x="238" y="112" width="8" height="18" rx="4" />
        <rect x="900" y="114" width="8" height="18" rx="4" />
        <rect x="930" y="114" width="8" height="18" rx="4" />
        <rect x="1060" y="114" width="8" height="18" rx="4" />
      </g>
    </svg>
  );
}
