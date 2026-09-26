import {
  ArrowUpRight,
  ArrowRight,
  Files,
  Clock3,
  ShieldCheck,
  ScanLine,
  Headphones,
  ChevronRight,
  Activity,
  Sparkles,
  Check,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { ArrowLink, Badge, RequestTable, SectionHeading, daysLeft } from './components';
import type { Audit, RequestSummary, Page } from './types';
type Props = {
  requests: RequestSummary[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onPage: (p: Page) => void;
  onBriefing: () => void;
  name: string;
};
export default function Dashboard({ requests, onOpen, onNew, onPage, onBriefing, name }: Props) {
  const [events, setEvents] = useState<Audit[]>([]);
  useEffect(() => {
    api<{ events: Audit[] }>('/audit')
      .then((d) => setEvents(d.events.slice(0, 3)))
      .catch(() => {});
  }, [requests]);
  const open = requests.filter((r) => r.status !== 'released'),
    released = requests.filter((r) => r.status === 'released'),
    pending = open.reduce((s, r) => s + r.pending, 0),
    overdue = open.filter((r) => daysLeft(r.dueAt) < 0),
    safe = open.filter((r) => daysLeft(r.dueAt) >= 0).length;
  const compliance = open.length ? Math.round((safe / open.length) * 100) : 100,
    conflicts = open.reduce((s, r) => s + r.conflicts, 0),
    leaks = open.reduce((s, r) => s + r.leaks, 0);
  const priority = [...open].sort(
    (a, b) => b.leaks + b.conflicts + b.pending - (a.leaks + a.conflicts + a.pending),
  )[0];
  const recent = [...requests]
    .sort(
      (a, b) =>
        (b.status !== 'released' ? 1 : 0) - (a.status !== 'released' ? 1 : 0) ||
        a.dueAt.localeCompare(b.dueAt),
    )
    .slice(0, 5);
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = Date.now() - (6 - i) * 7 * 86400000,
      end = start + 7 * 86400000;
    return {
      label: new Date(end).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
      received: requests.filter(
        (r) => Date.parse(r.createdAt) >= start && Date.parse(r.createdAt) < end,
      ).length,
      released: requests.filter(
        (r) => r.releasedAt && Date.parse(r.releasedAt) >= start && Date.parse(r.releasedAt) < end,
      ).length,
    };
  });
  const max = Math.max(2, ...weeks.map((w) => Math.max(w.received, w.released)));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, AT A GLANCE</div>
          <h1>
            A clearer path to disclosure<span className="heading-dot">.</span>
          </h1>
          <p>Welcome back, {name.split(' ')[0]}. Let’s keep information moving.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <ScanLine size={17} /> New request <span className="keycap">N</span>
        </button>
      </div>
      <div className="welcome-card">
        <div className="welcome-copy">
          <div className="welcome-label">
            <span className="live-dot" /> HUMAN JUDGMENT. AI ASSISTANCE.
          </div>
          <h2>
            More transparency.
            <br />
            Less busywork.
          </h2>
          <p>
            Your review stays in your hands. We help you find sensitive information, catch hidden
            risks, and make consistent decisions.
          </p>
          <button
            className="button lime"
            onClick={() => (priority ? onOpen(priority.id) : onNew())}
          >
            {priority ? 'Continue your review' : 'Create your first request'}
            <ArrowRight size={17} />
          </button>
          <span className="welcome-meta">
            <ShieldCheck size={13} /> Built for thoughtful access to information
          </span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-grid" />
          <div className="art-paper back-paper">
            <div className="paper-mini-label">DISCLOSURE RECORD</div>
            <div className="art-line" />
            <div className="art-line short" />
          </div>
          <div className="art-paper front-paper">
            <div className="art-paper-top">
              <span className="art-logo">R</span>
              <span>REVIEWED WITH CARE</span>
              <span className="art-dot" />
            </div>
            <div className="art-title-line" />
            <div className="art-line" />
            <div className="art-line" />
            <div className="art-redaction purple" />
            <div className="art-line short" />
            <div className="art-redaction gold" />
            <div className="art-line" />
            <div className="art-line short" />
            <div className="art-bottom">
              <ShieldCheck size={18} />
              <span>Ready for a human decision</span>
            </div>
          </div>
          <div className="floating-check">
            <ShieldCheck size={20} />
            <div>
              <strong>Integrity, built in</strong>
              <span>Every decision has a reason.</span>
            </div>
          </div>
          <div className="art-spark spark-one">✧</div>
          <div className="art-spark spark-two">+</div>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          icon={<Files size={19} />}
          label="Open requests"
          value={open.length}
          footer={`${requests.length} requests in your workspace`}
          tag="ACTIVE"
        />
        <Stat
          icon={<ScanLine size={19} />}
          label="Redactions to review"
          value={pending}
          footer="Suggestions awaiting your judgment"
          tone="purple"
          tag="HUMAN REVIEW"
        />
        <Stat
          icon={<ShieldCheck size={19} />}
          label="Released requests"
          value={released.length}
          footer={`${released.reduce((s, r) => s + r.documentCount, 0)} documents made accessible`}
          tone="green"
          tag="COMPLETED"
        />
        <Stat
          icon={<Clock3 size={19} />}
          label="Past target date"
          value={overdue.length}
          footer={
            overdue.length
              ? 'Prioritize these requests next'
              : 'Every open request is within target'
          }
          tone="orange"
          tag="30-DAY TARGET"
        />
      </div>
      <div className="dashboard-main">
        <div className="panel queue-panel">
          <SectionHeading
            title="Your review queue"
            description="A little attention here makes a big difference."
            action={<ArrowLink onClick={() => onPage('requests')}>View all requests</ArrowLink>}
          />
          <RequestTable items={recent} onOpen={onOpen} compact />
          <div className="table-footer">
            <span>
              <span className="tiny-dot" /> Updates are saved to your workspace
            </span>
            <span>{open.length} requests in progress</span>
          </div>
        </div>
        <div className="panel attention-panel">
          <div className="attention-heading">
            <span className="icon-tile amber">
              <Sparkles size={18} />
            </span>
            <Badge tone="amber">Your next move</Badge>
          </div>
          <h2>
            A second look
            <br />
            goes a long way.
          </h2>
          <p>
            {leaks + conflicts > 0
              ? 'Your integrity checks found a few things worth a closer look before disclosure.'
              : 'Your workspace is ready. Start reviewing the next request.'}
          </p>
          <button className="attention-item" onClick={() => onPage('integrity')}>
            <span className="finding-icon orange">
              <AlertTriangle size={16} />
            </span>
            <span>
              <strong>
                {leaks} leak {leaks === 1 ? 'finding' : 'findings'}
              </strong>
              <small>Context can reveal more than you think</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <button className="attention-item" onClick={() => onPage('integrity')}>
            <span className="finding-icon purple">
              <BookOpen size={16} />
            </span>
            <span>
              <strong>
                {conflicts} consistency {conflicts === 1 ? 'conflict' : 'conflicts'}
              </strong>
              <small>Learn from previous disclosure decisions</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <button className="button secondary full-width" onClick={() => onPage('integrity')}>
            Open integrity lab
            <ArrowUpRight size={16} />
          </button>
          <div className="attention-foot">
            <ShieldCheck size={13} /> An extra layer of confidence.
          </div>
        </div>
      </div>
      <div className="dashboard-bottom">
        <div className="panel throughput-panel">
          <SectionHeading
            title="Requests in motion"
            description="Received and released over the last six weeks."
            action={<span className="small-tag">LAST 6 WEEKS</span>}
          />
          <div className="chart-legend">
            <span>
              <i className="chart-dot dark" />
              Received
            </span>
            <span>
              <i className="chart-dot pale" />
              Released
            </span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={weeks
              .map((w) => `${w.label}: ${w.received} received, ${w.released} released`)
              .join('. ')}
          >
            <div className="chart-y">
              <span>{max}</span>
              <span>{Math.round(max / 2)}</span>
              <span>0</span>
            </div>
            <div className="chart-grid-lines">
              <i />
              <i />
              <i />
            </div>
            {weeks.map((w) => (
              <div className="chart-column" key={w.label}>
                <div className="chart-bars">
                  <div
                    className="chart-bar received"
                    style={{ height: `${(w.received / max) * 100}%` }}
                    title={`${w.received} received`}
                  />
                  <div
                    className="chart-bar completed"
                    style={{ height: `${(w.released / max) * 100}%` }}
                    title={`${w.released} released`}
                  />
                </div>
                <span>{w.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel target-panel">
          <SectionHeading
            title="Keep the clock on your side"
            description="Open requests within the 30-day target."
          />
          <div className="target-content">
            <div
              className="donut"
              style={{
                background: `conic-gradient(var(--forest) 0 ${compliance}%,var(--line) ${compliance}% 100%)`,
              }}
            >
              <div>
                <strong>
                  {compliance}
                  <span>%</span>
                </strong>
                <small>WITHIN TARGET</small>
              </div>
            </div>
            <div className="target-legend">
              <span>
                <i className="chart-dot dark" />
                {safe} within target
              </span>
              <span>
                <i className="chart-dot light" />
                {overdue.length} past target
              </span>
              <button className="text-link" onClick={() => onPage('requests')}>
                Manage queue
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <p className="target-note">
            Target dates are indicative. Statutory extensions require separate assessment.
          </p>
        </div>
      </div>
      <div className="briefing-strip">
        <div className="briefing-icon">
          <Headphones size={22} />
        </div>
        <div>
          <h3>Your morning briefing, minus the reading.</h3>
          <p>A quick spoken rundown of your queue, risks, and decisions waiting on you.</p>
        </div>
        <button className="button secondary" onClick={onBriefing}>
          <Headphones size={15} /> Listen to briefing <ArrowUpRight size={15} />
        </button>
      </div>
      {events.length > 0 && (
        <div className="recent-activity">
          <SectionHeading
            title="Recently in your workspace"
            action={<ArrowLink onClick={() => onPage('activity')}>View activity log</ArrowLink>}
          />
          <div className="recent-events">
            {events.map((e) => (
              <div key={e.id}>
                <span className="recent-event-icon">
                  <Activity size={16} />
                </span>
                <span>
                  <strong>{e.action}</strong>
                  <small>
                    {e.actor} ·{' '}
                    {new Date(e.at).toLocaleTimeString('en-CA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </span>
                <Check size={14} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
function Stat({
  icon,
  label,
  value,
  footer,
  tone = '',
  tag,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  footer: string;
  tone?: string;
  tag: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className={`icon-tile ${tone}`}>{icon}</span>
        <span className="stat-tag">{tag}</span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value.toString().padStart(2, '0')}</div>
      <div className="stat-footer">{footer}</div>
    </div>
  );
}
