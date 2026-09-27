import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Files,
  ScanLine,
  ShieldCheck,
  BookOpen,
  Activity,
  Settings2,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  HelpCircle,
  Sun,
  Moon,
  Menu,
  X,
  Plus,
  LogOut,
  ArrowRight,
  Command,
  Check,
  LoaderCircle,
  AlertCircle,
  UserRound,
  KeyRound,
} from 'lucide-react';
import { api, send } from './api';
import { Badge, IconButton, Loading, Modal, Empty } from './components';
import Dashboard from './Dashboard';
import Workspace from './Workspace';
import {
  RequestsPage,
  IntegrityPage,
  LibraryPage,
  ActivityPage,
  SettingsPage,
  RequesterPortal,
} from './Pages';
import { NewRequestDialog, UploadDialog, BriefingDialog } from './Dialogs';
import Login from './Login';
import type { Category, Page, RequestSummary, User, RequestRecord } from './types';
const navItems: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { page: 'requests', label: 'Requests', icon: <Files size={18} /> },
  { page: 'workspace', label: 'Redaction workspace', icon: <ScanLine size={18} /> },
  { page: 'integrity', label: 'Integrity lab', icon: <ShieldCheck size={18} /> },
  { page: 'library', label: 'Release library', icon: <BookOpen size={18} /> },
  { page: 'activity', label: 'Activity log', icon: <Activity size={18} /> },
];
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [demo, setDemo] = useState(true),
    [auth, setAuth] = useState(false),
    [page, setPage] = useState<Page>('overview'),
    [requests, setRequests] = useState<RequestSummary[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [selected, setSelected] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [modal, setModal] = useState<string | null>(null),
    [uploadId, setUploadId] = useState(''),
    [mobile, setMobile] = useState(false),
    [profile, setProfile] = useState(false),
    [version, setVersion] = useState(0),
    [toast, setToast] = useState<{ message: string; error: boolean } | null>(null),
    [theme, setTheme] = useState(
      () =>
        localStorage.getItem('mr-redactor-theme') ||
        localStorage.getItem('redactor-theme') ||
        'light',
    ),
    // Demo sessions are always populated server-side, so the landing gate is client-held.
    [entered, setEntered] = useState(() => sessionStorage.getItem('mr-redactor-entered') === '1');
  const searchRef = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string, isError = false) => {
    setToast({ message, error: isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), isError ? 9000 : 4500);
  }, []);
  const refresh = useCallback(async () => {
    const rs = await api<RequestSummary[]>('/requests');
    setRequests(rs);
    setSelected((prev) => prev || rs.find((r) => r.status !== 'released')?.id || rs[0]?.id || '');
  }, []);
  useEffect(() => {
    async function load() {
      try {
        const session = await api<{ user: User | null; demo: boolean; authEnabled: boolean }>(
          '/session',
        );
        setUser(session.user);
        setDemo(session.demo);
        setAuth(session.authEnabled);
        if (session.user) {
          await refresh();
          setCategories(await api<Category[]>('/categories'));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => clearTimeout(toastTimer.current);
  }, [refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mr-redactor-theme', theme);
  }, [theme]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const input = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if ((e.key === '/' && !input) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key.toLowerCase() === 'n' && !input && !modal) setModal('new');
      if (e.key === 'Escape') {
        setProfile(false);
        setMobile(false);
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [modal]);
  const go = (next: Page) => {
    setPage(next);
    setSearch('');
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const open = (id: string) => {
    setSelected(id);
    go('workspace');
    setModal(null);
  };
  const changed = () => {
    refresh().catch((e) => notify(e.message, true));
  };
  const newCreated = (r: RequestRecord) => {
    setModal(null);
    setSelected(r.id);
    changed();
    if (user?.role === 'officer') {
      setPage('workspace');
      setVersion((v) => v + 1);
      setUploadId(r.id);
      setModal('upload');
    }
  };
  async function changeRole(role: string) {
    try {
      await api('/session/role', send({ role }));
      const s = await api<{ user: User }>('/session');
      setUser(s.user);
      setProfile(false);
      setPage('overview');
      setSelected('');
      setSearch('');
      await refresh();
      notify(
        role === 'officer'
          ? 'Officer workspace opened.'
          : 'Requester portal opened. Only approved releases are visible.',
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  // Demo mode has no server-side logout; this only clears the client-held landing gate.
  function signOut() {
    setProfile(false);
    sessionStorage.removeItem('mr-redactor-entered');
    setEntered(false);
    setPage('overview');
    setSelected('');
    setSearch('');
  }
  const totalFindings = requests
      .filter((r) => r.status !== 'released')
      .reduce((s, r) => s + (r.leaks || 0) + (r.conflicts || 0), 0),
    pending = requests
      .filter((r) => r.status !== 'released')
      .reduce((s, r) => s + (r.pending || 0), 0);
  const isOfficer = user?.role === 'officer';
  const visiblePage =
    search && isOfficer && ['overview', 'workspace', 'settings'].includes(page) ? 'requests' : page;
  if (!loading && !error && (!user || (demo && !auth && !entered)))
    return (
      <Login
        demo={demo}
        authEnabled={auth}
        notify={notify}
        onSignedIn={async () => {
          sessionStorage.setItem('mr-redactor-entered', '1');
          try {
            const s = await api<{ user: User }>('/session');
            setUser(s.user);
            await refresh();
            setCategories(await api<Category[]>('/categories'));
          } catch (e) {
            notify((e as Error).message, true);
          }
          setEntered(true);
        }}
      />
    );
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <button className="brand" onClick={() => go('overview')} aria-label="Mr. Redactor home">
          <img src="/favicon.svg" alt="" />
          <span>
            Mr. Redactor<span className="brand-period">.</span>
          </span>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(isOfficer ? navItems : navItems.filter((n) => n.page === 'overview')).map((item) => (
            <button
              key={item.page}
              aria-label={isOfficer ? item.label : 'My requests'}
              className={`nav-item ${visiblePage === item.page ? 'active' : ''}`}
              onClick={() => go(item.page)}
            >
              {item.icon}
              <span>{!isOfficer ? 'My requests' : item.label}</span>
              {item.page === 'requests' && (
                <span className="nav-count">
                  {requests.filter((r) => r.status !== 'released').length}
                </span>
              )}
              {item.page === 'integrity' && totalFindings > 0 && (
                <span className="nav-count alert">{totalFindings}</span>
              )}
            </button>
          ))}
        </nav>
        {isOfficer && (
          <>
            <div className="sidebar-divider" />
            <div className="nav-label">WORKSPACE TOOLS</div>
            <button
              className={`nav-item ${page === 'settings' ? 'active' : ''}`}
              onClick={() => go('settings')}
            >
              <Settings2 size={18} />
              <span>Settings & integrations</span>
            </button>
            <button className="nav-item" onClick={() => setModal('help')}>
              <HelpCircle size={18} />
              <span>Help & getting started</span>
              <ArrowUpRight size={15} />
            </button>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="trust-card">
            <span className="trust-icon">
              <ShieldCheck size={22} />
            </span>
            <strong>Transparency starts here.</strong>
            <p>
              A little less friction.
              <br />A little more trust.
            </p>
            <button className="text-link" onClick={() => setModal('help')}>
              See how it works
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="environment-label">
            <span className={`tiny-dot ${demo ? 'amber-dot' : ''}`} />
            {demo ? 'DEMONSTRATION WORKSPACE' : 'AUTHENTICATED WORKSPACE'}
          </div>
          <div className="sidebar-footer">
            <span>Thoughtful disclosure.</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton label="Open navigation" onClick={() => setMobile(true)}>
              <Menu size={19} />
            </IconButton>
            <div className="breadcrumb">
              <span>{isOfficer ? 'Workspace' : 'Your portal'}</span>
              <span>/</span>
              <strong>
                {!isOfficer
                  ? 'My requests'
                  : navItems.find((n) => n.page === visiblePage)?.label || 'Settings'}
              </strong>
            </div>
          </div>
          <div className="topbar-right">
            <div className="global-search">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Search workspace"
                placeholder={isOfficer ? 'Search workspace…' : 'Search your requests…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button aria-label="Clear search" onClick={() => setSearch('')}>
                  <X size={14} />
                </button>
              ) : (
                <kbd>/</kbd>
              )}
            </div>
            <IconButton
              label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            {isOfficer && (
              <button
                className="notification-button icon-button"
                aria-label="Review notifications"
                onClick={() => setModal('notifications')}
              >
                <Bell size={18} />
                {totalFindings > 0 && <span />}
              </button>
            )}
            <div className="topbar-divider" />
            <div className="profile-wrapper">
              <button
                className="profile-button"
                aria-label="Open profile menu"
                onClick={() => setProfile((p) => !p)}
                aria-expanded={profile}
              >
                <span className="user-avatar">
                  {user?.name
                    .split(' ')
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join('') || '?'}
                </span>
                <span className="profile-text">
                  <strong>{user?.name || 'Welcome'}</strong>
                  <small>{isOfficer ? 'ATIP Officer' : 'Requester'}</small>
                </span>
                <ChevronDown size={14} />
              </button>
              {profile && (
                <>
                  <button
                    className="profile-dismiss"
                    aria-label="Close profile menu"
                    onClick={() => setProfile(false)}
                  />
                  <div className="profile-menu">
                    {demo && (
                      <>
                        <div>DEMO ROLE</div>
                        <button onClick={() => changeRole('officer')}>
                          <ShieldCheck size={16} />
                          Officer workspace{isOfficer && <Check size={14} />}
                        </button>
                        <button onClick={() => changeRole('requester')}>
                          <UserRound size={16} />
                          Requester portal{!isOfficer && <Check size={14} />}
                        </button>
                      </>
                    )}
                    {auth ? (
                      <a href="/logout">
                        <LogOut size={16} />
                        Sign out
                      </a>
                    ) : (
                      <button onClick={signOut}>
                        <LogOut size={16} />
                        Sign out
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setProfile(false);
                        setModal('help');
                      }}
                    >
                      <HelpCircle size={16} />
                      Getting started
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className={`main-content ${visiblePage === 'workspace' ? 'workspace-content' : ''}`}>
          {loading ? (
            <Loading />
          ) : error ? (
            <div className="panel">
              <Empty
                title="The workspace couldn’t connect"
                description={`${error} Start the backend with npm run dev and reload this page.`}
                action={
                  <button className="button primary" onClick={() => location.reload()}>
                    Try again
                  </button>
                }
              />
            </div>
          ) : !user ? (
            <div className="sign-in panel">
              <img src="/favicon.svg" alt="Mr. Redactor" />
              <div className="eyebrow">ACCESS WITH CONFIDENCE</div>
              <h1>
                A thoughtful workspace
                <br />
                for information access.
              </h1>
              <p>Sign in to review requests or access your approved records.</p>
              <a className="button primary" href="/login">
                <KeyRound size={18} />
                Sign in securely
              </a>
            </div>
          ) : !isOfficer ? (
            <RequesterPortal
              requests={requests}
              onNew={() => setModal('new')}
              notify={notify}
              search={search}
            />
          ) : visiblePage === 'overview' ? (
            <Dashboard
              requests={requests}
              onOpen={open}
              onNew={() => setModal('new')}
              onPage={go}
              onBriefing={() => setModal('briefing')}
              name={user.name}
            />
          ) : visiblePage === 'requests' ? (
            <RequestsPage
              requests={requests}
              onOpen={open}
              onNew={() => setModal('new')}
              search={search}
            />
          ) : visiblePage === 'workspace' ? (
            selected ? (
              <Workspace
                key={`${selected}-${version}`}
                id={selected}
                categories={categories}
                onBack={() => go('requests')}
                notify={notify}
                onChanged={changed}
                onUpload={(id) => {
                  setUploadId(id);
                  setModal('upload');
                }}
              />
            ) : (
              <div className="panel">
                <Empty
                  title="Your next review starts here"
                  description="Create a request and add a document to begin."
                  action={
                    <button className="button primary" onClick={() => setModal('new')}>
                      <Plus size={16} />
                      Create request
                    </button>
                  }
                />
              </div>
            )
          ) : visiblePage === 'integrity' ? (
            <IntegrityPage
              requests={requests}
              onOpen={open}
              notify={notify}
              onChanged={changed}
              search={search}
            />
          ) : visiblePage === 'library' ? (
            <LibraryPage categories={categories} notify={notify} search={search} />
          ) : visiblePage === 'activity' ? (
            <ActivityPage search={search} onOpen={open} notify={notify} />
          ) : (
            <SettingsPage notify={notify} />
          )}
          <footer className="main-footer">
            <span>
              <ShieldCheck size={12} />
              Human reviewed. Thoughtfully disclosed.
            </span>
            <span>Mr. Redactor · Every line accounted for.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <AlertCircle size={19} /> : <Check size={19} />}
          <span>{toast.message}</span>
          <IconButton label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={15} />
          </IconButton>
        </div>
      )}
      {modal === 'new' && (
        <NewRequestDialog
          onClose={() => setModal(null)}
          onCreated={newCreated}
          notify={notify}
          requester={!isOfficer}
          demo={demo}
        />
      )}
      {modal === 'upload' && (
        <UploadDialog
          id={uploadId}
          onClose={() => setModal(null)}
          notify={notify}
          onUploaded={() => {
            setModal(null);
            changed();
            setVersion((v) => v + 1);
          }}
        />
      )}
      {modal === 'briefing' && isOfficer && (
        <BriefingDialog onClose={() => setModal(null)} notify={notify} />
      )}
      {modal === 'notifications' && (
        <Modal
          title="A few things need your attention"
          subtitle="Your outstanding reviews and integrity findings."
          onClose={() => setModal(null)}
        >
          <div className="notification-summary">
            <Badge tone="amber">{pending} suggestions awaiting review</Badge>
            <Badge tone="purple">{totalFindings} integrity findings</Badge>
          </div>
          {requests
            .filter((r) => r.status !== 'released' && (r.pending || r.conflicts || r.leaks))
            .map((r) => (
              <button key={r.id} className="notification-row" onClick={() => open(r.id)}>
                <FileIcon />
                <span>
                  <strong>{r.title}</strong>
                  <small>
                    {r.pending} suggestions · {(r.conflicts || 0) + (r.leaks || 0)} findings
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          {!pending && !totalFindings && <p className="muted">You’re all caught up.</p>}
        </Modal>
      )}
      {modal === 'help' && (
        <Modal
          title={isOfficer ? 'A clearer path, step by step' : 'How your request is handled'}
          subtitle={
            isOfficer
              ? 'Your judgment stays at the centre of every release.'
              : 'What happens between asking and receiving.'
          }
          onClose={() => setModal(null)}
          wide
        >
          <div className="help-steps">
            {(isOfficer
              ? [
                  [
                    <Files size={22} />,
                    'Start with a request',
                    'Create a request, choose the institution, and upload a text-based PDF or paste a record.',
                  ],
                  [
                    <ScanLine size={22} />,
                    'Review with context',
                    'Click highlighted spans to read the suggested category, confidence and justification. Approve withholding, disclose with a reason, or add a manual redaction.',
                  ],
                  [
                    <ShieldCheck size={22} />,
                    'Take a second look',
                    'The independent leak tester sees only the candidate output. Consistency checks compare it with released excerpts. Address each finding and rerun after text changes.',
                  ],
                  [
                    <Check size={22} />,
                    'Release with confidence',
                    'Confirm a full-document review and approve the release. The requester sees only approved redacted records. Download PDF, text, or an officer decision log.',
                  ],
                ]
              : [
                  [
                    <Files size={22} />,
                    'Make your request',
                    'Tell us which records you are looking for and which federal institution holds them. You will get a request number straight away.',
                  ],
                  [
                    <ScanLine size={22} />,
                    'An officer reads the record',
                    'A trained ATIP officer reviews it line by line against the Access to Information Act. Nothing is withheld without a specific statutory reason.',
                  ],
                  [
                    <ShieldCheck size={22} />,
                    'An independent check runs',
                    'Before anything reaches you, a separate pass tests whether the remaining context could still reveal what was withheld.',
                  ],
                  [
                    <Check size={22} />,
                    'Collect your records',
                    'Once the release is approved it appears here. Read it in your browser or download the redacted PDF or text.',
                  ],
                ]
            ).map(([icon, title, description], i) => (
              <div key={i}>
                <span>{icon}</span>
                <div>
                  <h3>
                    {i + 1}. {title}
                  </h3>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="help-demo">
            <Badge tone="amber">Demonstration mode</Badge>
            <p>
              {isOfficer
                ? 'The seeded people, requests, documents and reference excerpts are fictional. Use the profile menu to try the requester portal. Configure live services in Settings, and import real public ATI excerpts into the reference library.'
                : 'The requests and records shown here are fictional samples. This is a working prototype, not a government submission portal.'}
            </p>
          </div>
          <div className="help-shortcuts">
            {isOfficer && (
              <span>
                <kbd>N</kbd>New request
              </span>
            )}
            <span>
              <kbd>/</kbd>
              {isOfficer ? 'Search workspace' : 'Search your requests'}
            </span>
            <span>
              <kbd>Esc</kbd>Close dialog
            </span>
          </div>
          <div className="modal-actions">
            <button className="button primary" onClick={() => setModal(null)}>
              {isOfficer ? 'Let’s get started' : 'Got it'}
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function FileIcon() {
  return (
    <span className="icon-tile purple">
      <Files size={17} />
    </span>
  );
}
