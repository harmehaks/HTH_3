import { useEffect, useRef, useState, type FormEvent, type CSSProperties } from 'react';
import {
  Mail,
  Lock,
  ShieldCheck,
  UserRound,
  ArrowRight,
  LoaderCircle,
  Info,
  Eye,
  EyeOff,
  ScanLine,
  BookOpen,
  KeyRound,
  X,
} from 'lucide-react';
import { api, send } from './api';
import { ParliamentHill } from './Pages';

type Props = {
  demo: boolean;
  authEnabled: boolean;
  onSignedIn: () => void;
  notify: (s: string, error?: boolean) => void;
};

const providers = [
  {
    id: 'google-oauth2',
    label: 'Google',
    path: 'M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z M5.3 14.3a7.1 7.1 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1Z M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z',
  },
  {
    id: 'windowslive',
    label: 'Microsoft',
    path: 'M2 2h9.4v9.4H2z M12.6 2H22v9.4h-9.4z M2 12.6h9.4V22H2z M12.6 12.6H22V22h-9.4z',
  },
  {
    id: 'github',
    label: 'GitHub',
    path: 'M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z',
  },
];

export default function Login({ demo, authEnabled, onSignedIn, notify }: Props) {
  const [role, setRole] = useState<'officer' | 'requester'>('officer'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [showPassword, setShowPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [showSignIn, setShowSignIn] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null),
    triggerRef = useRef<HTMLButtonElement>(null),
    panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!showSignIn) return;
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSignIn(false);
      }
      if (e.key !== 'Tab') return;
      const controls = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      triggerRef.current?.focus();
    };
  }, [showSignIn]);

  // With Auth0 configured, credentials are only ever entered on the provider's domain.
  const federated = authEnabled;
  const hostedLogin = (connection?: string) => {
    const params = new URLSearchParams();
    if (connection) params.set('connection', connection);
    if (email.trim()) params.set('login_hint', email.trim());
    location.href = `/login${params.toString() ? `?${params}` : ''}`;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (federated) return hostedLogin();
    setBusy(true);
    try {
      await api('/session/role', send({ role }));
      onSignedIn();
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <section className="login-aside" inert={showSignIn}>
        <ParliamentHill />
        <div className="login-aside-inner">
          <div className="login-brand-row fade-in-up">
            <span className="login-brand">
              <img src="/favicon.svg" alt="" />
              <span>
                Mr. Redactor<span className="brand-period">.</span>
              </span>
            </span>
          </div>
          <div className="login-aside-copy">
            <div className="login-eyebrow fade-in-up">ACCESS TO INFORMATION</div>
            <h1 className="fade-in-up" style={{ '--d': '0.08s' } as CSSProperties}>
              Every line
              <br />
              <span className="ink-reveal">accounted for</span>
              <span className="brand-period">.</span>
            </h1>
            <p className="fade-in-up" style={{ '--d': '0.16s' } as CSSProperties}>
              AI-assisted review with an independent leak test, cross-request consistency checks,
              and a human decision on every single redaction.
            </p>
            <ul className="login-points fade-in-up" style={{ '--d': '0.24s' } as CSSProperties}>
              <li>
                <ShieldCheck size={15} />
                Nothing is released without officer approval
              </li>
              <li>
                <ShieldCheck size={15} />
                Every withheld passage cites its statutory section
              </li>
              <li>
                <ShieldCheck size={15} />
                Decisions are recorded in a hash-linked audit trail
              </li>
            </ul>
            <div className="login-chips fade-in-up" style={{ '--d': '0.32s' } as CSSProperties}>
              <span className="login-chip" style={{ '--fd': '0s' } as CSSProperties}>
                <ShieldCheck size={13} />6 statutory categories
              </span>
              <span className="login-chip" style={{ '--fd': '0.5s' } as CSSProperties}>
                <ScanLine size={13} />
                Independent leak test
              </span>
              <span className="login-chip" style={{ '--fd': '1s' } as CSSProperties}>
                <BookOpen size={13} />
                Hash-linked audit trail
              </span>
            </div>
            <button
              type="button"
              ref={triggerRef}
              className="login-cta fade-in-up"
              style={{ '--d': '0.4s' } as CSSProperties}
              onClick={() => setShowSignIn(true)}
            >
              <KeyRound size={16} />
              Sign in
            </button>
          </div>
          <div className="login-aside-foot">
            <span className="stamp">OTTAWA · CANADA</span>
            <span className="stamp">PROTOTYPE BUILD v1.0</span>
          </div>
        </div>
      </section>

      <div
        className={`signin-overlay-backdrop ${showSignIn ? 'open' : ''}`}
        onClick={() => setShowSignIn(false)}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        className={`signin-panel ${showSignIn ? 'open' : ''}`}
        inert={!showSignIn}
        aria-hidden={!showSignIn}
        role="dialog"
        aria-modal={showSignIn || undefined}
        aria-labelledby="signin-title"
      >
        <div className="login-card">
          <button
            type="button"
            className="signin-close"
            aria-label="Close sign-in panel"
            onClick={() => setShowSignIn(false)}
          >
            <X size={18} />
          </button>
          <div className="login-card-head">
            <h2 id="signin-title">Sign in</h2>
            <p>
              {federated
                ? 'You will be taken to your organisation’s identity provider.'
                : 'Choose a workspace to explore the demonstration.'}
            </p>
          </div>

          <div className="login-role">
            <div className="login-label-row">
              <span className="decision-label">WORKSPACE</span>
              {federated && <span className="stamp login-role-locked">SET BY PROVIDER</span>}
            </div>
            <div className="role-toggle" role="group" aria-label="Workspace role">
              <button
                type="button"
                className={role === 'officer' ? 'active' : ''}
                aria-pressed={role === 'officer'}
                disabled={federated}
                onClick={() => setRole('officer')}
              >
                <ShieldCheck size={17} />
                <span>
                  <strong>ATIP officer</strong>
                  <small>Review records and approve releases</small>
                </span>
              </button>
              <button
                type="button"
                className={role === 'requester' ? 'active' : ''}
                aria-pressed={role === 'requester'}
                disabled={federated}
                onClick={() => setRole('requester')}
              >
                <UserRound size={17} />
                <span>
                  <strong>Requester</strong>
                  <small>Track requests and collect records</small>
                </span>
              </button>
            </div>
            {federated && (
              <p className="login-note">
                <Info size={13} />
                Your role comes from the <code>officer</code> claim on your account. It cannot be
                chosen at sign-in.
              </p>
            )}
          </div>

          <form onSubmit={submit}>
            <label className="field">
              <span>Email address</span>
              <span className="field-input">
                <Mail size={15} />
                <input
                  ref={emailRef}
                  type="email"
                  autoComplete="username"
                  required={federated}
                  placeholder="you@canada.ca"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </span>
            </label>
            <label className="field">
              <span>Password</span>
              <span className={`field-input ${federated ? 'disabled' : ''}`}>
                <Lock size={15} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={federated}
                  placeholder={
                    federated ? 'Entered on your provider’s page' : 'Not required in demo'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {!federated && (
                  <button
                    type="button"
                    className="field-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </span>
            </label>

            <button className="button primary full-width login-submit" disabled={busy}>
              {busy ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />}
              {federated
                ? 'Continue securely'
                : `Enter as ${role === 'officer' ? 'officer' : 'requester'}`}
            </button>
          </form>

          {federated && (
            <>
              <div className="login-divider">
                <span>or continue with</span>
              </div>
              <div className="oauth-row">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="oauth-button"
                    onClick={() => hostedLogin(p.id)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d={p.path} fill="currentColor" />
                    </svg>
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="login-foot">
            {demo && !authEnabled
              ? 'Demonstration workspace. Records and people shown are fictional, and no password is checked.'
              : 'Protected by Auth0. Mr. Redactor never receives your password.'}
          </p>
        </div>
      </aside>
    </div>
  );
}
