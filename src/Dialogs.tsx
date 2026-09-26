import { useState, useEffect, type FormEvent } from 'react';
import {
  UploadCloud,
  FileText,
  LoaderCircle,
  ArrowRight,
  Check,
  Headphones,
  Volume2,
  Square,
  ShieldCheck,
  BookOpen,
  Search,
  ArrowUpRight,
} from 'lucide-react';
import { api, send } from './api';
import { Modal, Badge } from './components';
import type { Category, RequestRecord, Finding, Doc } from './types';
type Notify = (message: string, error?: boolean) => void;
export const departments = [
  'Canada Border Services Agency',
  'Treasury Board Secretariat',
  'Infrastructure Canada',
  'Transport Canada',
  'Shared Services Canada',
  'Environment and Climate Change Canada',
  'Employment and Social Development Canada',
  'Canadian Heritage',
  'Other federal institution',
];
export function NewRequestDialog({
  onClose,
  onCreated,
  notify,
  requester = false,
  demo = true,
}: {
  onClose: () => void;
  onCreated: (r: RequestRecord) => void;
  notify: Notify;
  requester?: boolean;
  demo?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await api<RequestRecord>(
        '/requests',
        send({
          title: form.get('title'),
          department: form.get('department'),
          description: form.get('description'),
          requesterId: form.get('requesterId'),
        }),
      );
      onCreated(r);
      notify('Request created. Your reference number is ' + r.id);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={requester ? 'What would you like to know?' : 'Create an access request'}
      subtitle="Give your request a clear name and a little context."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Request title
          <input
            name="title"
            required
            maxLength={250}
            placeholder="e.g. Border services modernization"
            autoFocus
          />
        </label>
        <label>
          Federal institution
          <select name="department" required>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Records requested
          <textarea
            name="description"
            required
            maxLength={5000}
            rows={4}
            placeholder="Describe the records, date range, and program you’re interested in."
          />
        </label>
        {!requester && !demo && (
          <label>
            Requester Auth0 subject ID
            <input name="requesterId" required placeholder="auth0|…" />
            <small>
              Assign records to the authenticated requester who should receive the release.
            </small>
          </label>
        )}
        <div className="form-note">
          <ShieldCheck size={16} />
          <span>
            {requester && demo
              ? 'This workspace creates a demonstration request. It does not submit to a government institution.'
              : 'The workspace starts an indicative 30-day target when the request is created. This app is not connected to the Government of Canada submission portal.'}
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}Create
            request
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function UploadDialog({
  id,
  onClose,
  onUploaded,
  notify,
}: {
  id: string;
  onClose: () => void;
  onUploaded: (r: RequestRecord) => void;
  notify: Notify;
}) {
  const [file, setFile] = useState<File | null>(null),
    [text, setText] = useState(''),
    [mode, setMode] = useState('file'),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false);
  const choose = (f: File) => {
    if (f.size > 15 * 1024 * 1024) return notify('Please choose a file under 15 MB.', true);
    setFile(f);
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    const data = new FormData();
    if (mode === 'file' && file) data.append('file', file);
    else if (mode === 'text' && text.trim()) {
      data.append('text', text);
      data.append('name', 'pasted-record.txt');
    } else return notify('Choose a document or paste its text.', true);
    setBusy(true);
    try {
      const r = await api<RequestRecord>(`/requests/${id}/documents`, {
        method: 'POST',
        body: data,
      });
      onUploaded(r);
      notify('Document analyzed. Your suggestions and integrity checks are ready.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Bring a record into focus"
      subtitle={`Upload and analyze a document for ${id}.`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <div className="segmented">
          <button
            type="button"
            className={mode === 'file' ? 'active' : ''}
            onClick={() => setMode('file')}
          >
            Upload a file
          </button>
          <button
            type="button"
            className={mode === 'text' ? 'active' : ''}
            onClick={() => setMode('text')}
          >
            Paste document text
          </button>
        </div>
        {mode === 'file' ? (
          <label
            className={`dropzone ${drag ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (e.dataTransfer.files[0]) choose(e.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              accept=".pdf,.txt,.md,.csv"
              onChange={(e) => e.target.files?.[0] && choose(e.target.files[0])}
            />
            <span className="upload-circle">
              {file ? <FileText size={27} /> : <UploadCloud size={29} />}
            </span>
            <strong>{file ? file.name : 'Drop your document here'}</strong>
            <span>
              {file
                ? `${(file.size / 1024).toFixed(0)} KB · Click to choose another`
                : 'or click to browse your files'}
            </span>
            <small>Text-based PDF, TXT, Markdown, CSV · Up to 15 MB</small>
          </label>
        ) : (
          <label>
            Document text
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              maxLength={120000}
              placeholder="Paste the complete record here…"
              required
            />
          </label>
        )}
        <div className="pipeline-preview">
          <span>
            <Search size={16} />
            Classify
          </span>
          <ArrowRight size={13} />
          <span>
            <ShieldCheck size={16} />
            Test for leaks
          </span>
          <ArrowRight size={13} />
          <span>
            <BookOpen size={16} />
            Check consistency
          </span>
        </div>
        <div className="form-note">
          <span>
            Scanned PDFs need OCR first. With Gemini configured, document text is sent to Google for
            analysis; otherwise local pattern rules run.
          </span>
        </div>
        {busy && (
          <div className="processing-message">
            <LoaderCircle className="spin" size={17} />
            <span>Analyzing the record and running integrity checks. This can take a minute.</span>
          </div>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || (mode === 'file' && !file) || (mode === 'text' && !text.trim())}
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : <UploadCloud size={16} />}Analyze
            document
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function FindingDialog({
  finding,
  id,
  docId,
  onClose,
  onResolved,
  notify,
}: {
  finding: Finding;
  id: string;
  docId: string;
  onClose: () => void;
  onResolved: (r: RequestRecord) => void;
  notify: Notify;
}) {
  const [busy, setBusy] = useState(false),
    [note, setNote] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<RequestRecord>(
        `/requests/${id}/documents/${docId}/findings/${finding.id}`,
        send({ note }, 'PATCH'),
      );
      onResolved(r);
      notify('Finding resolved with your rationale.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={finding.clue ? 'Review a contextual leak' : 'Review a consistency conflict'}
      subtitle="Make a deliberate decision and leave a clear rationale."
      onClose={onClose}
    >
      <div className="finding-summary">
        <Badge tone={finding.clue ? 'amber' : 'purple'}>
          {finding.clue ? 'Mosaic effect' : 'Cross-request check'}
        </Badge>
        <p>{finding.inference}</p>
        <blockquote>{finding.clue || finding.excerpt}</blockquote>
        {finding.requestRef && (
          <small>
            Reference {finding.requestRef} · {Math.round((finding.similarity || 0) * 100)}%
            similarity {finding.synthetic ? '· Synthetic demo reference' : ''}
          </small>
        )}
        {finding.sourceUrl && (
          <a className="text-link" target="_blank" rel="noreferrer" href={finding.sourceUrl}>
            Open public source
            <ArrowUpRight size={14} />
          </a>
        )}
        {finding.guess && (
          <p>
            Tester’s proposed reconstruction: <strong>{finding.guess}</strong>
            <br />
            <small>Scoring result: {finding.reconstruction}</small>
          </p>
        )}
      </div>
      <form onSubmit={submit}>
        <label>
          Officer rationale
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            maxLength={2000}
            rows={4}
            placeholder="Explain the mitigation, contextual difference, or basis for accepting the remaining risk."
          />
        </label>
        <div className="form-note">
          To hide identifying context, add a manual redaction in the document viewer. Integrity
          checks rerun automatically when the candidate changes.
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !note.trim()}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Resolve
            finding
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ManualDialog({
  doc,
  id,
  categories,
  selectedText,
  onClose,
  onSaved,
  notify,
}: {
  doc: Doc;
  id: string;
  categories: Category[];
  selectedText: string;
  onClose: () => void;
  onSaved: (r: RequestRecord) => void;
  notify: Notify;
}) {
  const [quote, setQuote] = useState(selectedText),
    [cat, setCat] = useState('personal'),
    [note, setNote] = useState(''),
    [occurrence, setOccurrence] = useState(0),
    [replaceOverlaps, setReplaceOverlaps] = useState(false),
    [busy, setBusy] = useState(false);
  const matches: number[] = [];
  if (quote) {
    let start = doc.text.indexOf(quote);
    while (start >= 0) {
      matches.push(start);
      start = doc.text.indexOf(quote, start + Math.max(1, quote.length));
    }
  }
  const start = matches[occurrence];
  const overlaps = doc.spans.filter(
    (s) => start !== undefined && start < s.end && start + quote.length > s.start,
  );
  const fullyCovers = overlaps.every((s) => start <= s.start && start + quote.length >= s.end);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<RequestRecord>(
        `/requests/${id}/documents/${doc.id}/spans`,
        send({ start, end: start + quote.length, category: cat, note, replaceOverlaps }),
      );
      onSaved(r);
      const checkError = r.documents.find((d) => d.id === doc.id)?.integrityError;
      notify(
        checkError
          ? `Redaction saved. ${checkError}`
          : 'Manual redaction added. Integrity checks refreshed.',
        Boolean(checkError),
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Add a manual redaction"
      subtitle="Select the exact text and ground your decision in the Act."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Exact text to withhold
          <textarea
            value={quote}
            onChange={(e) => {
              setQuote(e.target.value);
              setOccurrence(0);
              setReplaceOverlaps(false);
            }}
            required
            rows={3}
            placeholder="Select text in the original document, or paste an exact excerpt."
          />
        </label>
        {matches.length > 1 && (
          <label>
            Occurrence
            <select
              value={occurrence}
              onChange={(e) => {
                setOccurrence(Number(e.target.value));
                setReplaceOverlaps(false);
              }}
            >
              {matches.map((s, i) => (
                <option value={i} key={s}>
                  Occurrence {i + 1} — character {s + 1}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={`match-note ${matches.length ? 'valid' : 'invalid'}`}>
          {matches.length
            ? `${matches.length} exact ${matches.length === 1 ? 'match' : 'matches'} in the document`
            : 'No exact match. Copy the text as it appears in the record.'}
        </div>
        {overlaps.length > 0 && (
          <div className="overlap-notice" role="status">
            <strong>
              {overlaps.length} existing{' '}
              {overlaps.length === 1 ? 'suggestion overlaps' : 'suggestions overlap'} this
              selection.
            </strong>
            {fullyCovers ? (
              <label className="replacement-check">
                <input
                  type="checkbox"
                  checked={replaceOverlaps}
                  onChange={(e) => setReplaceOverlaps(e.target.checked)}
                />{' '}
                Replace these suggestions and preserve their history
              </label>
            ) : (
              <p>
                Expand your selection to fully cover the overlapping suggestions. This prevents
                accidentally exposing part of a withheld passage.
              </p>
            )}
          </div>
        )}
        <label>
          Legal category
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · s. {c.section}
              </option>
            ))}
          </select>
        </label>
        <label>
          Justification
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            rows={3}
            placeholder="Explain the statutory conditions and why this span should be withheld."
          />
        </label>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              start === undefined ||
              !note.trim() ||
              (overlaps.length > 0 && (!fullyCovers || !replaceOverlaps))
            }
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}Add
            redaction
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function BriefingDialog({ onClose, notify }: { onClose: () => void; notify: Notify }) {
  const [text, setText] = useState(''),
    [provider, setProvider] = useState(''),
    [playing, setPlaying] = useState(false),
    [busy, setBusy] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  useEffect(() => {
    let active = true;
    api<{ text: string; provider: string }>('/briefing')
      .then((d) => {
        if (active) {
          setText(d.text);
          setProvider(d.provider);
        }
      })
      .catch((e) => notify(e.message, true));
    return () => {
      active = false;
    };
  }, [notify]);
  const stop = () => {
    window.speechSynthesis?.cancel();
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
    }
    setPlaying(false);
  };
  const close = () => {
    stop();
    onClose();
  };
  async function play() {
    if (playing) return stop();
    setBusy(true);
    try {
      if (provider === 'ElevenLabs') {
        const r = await fetch('/api/briefing/audio', {
          method: 'POST',
          headers: { 'X-Redactor-Client': 'workspace' },
        });
        if (!r.ok) throw new Error((await r.json()).error);
        const a = new Audio(URL.createObjectURL(await r.blob()));
        setAudio(a);
        a.onended = () => {
          setPlaying(false);
          URL.revokeObjectURL(a.src);
        };
        await a.play();
        setPlaying(true);
      } else {
        if (!window.speechSynthesis)
          throw new Error(
            'Speech playback is unavailable in this browser. You can read the briefing below.',
          );
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(text);
        speech.lang = 'en-CA';
        speech.rate = 0.95;
        speech.onend = () => setPlaying(false);
        speech.onerror = () => setPlaying(false);
        window.speechSynthesis.speak(speech);
        setPlaying(true);
      }
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Your workspace briefing"
      subtitle="A few moments to get your bearings."
      onClose={close}
    >
      <div className="briefing-player">
        <div className={`player-orb ${playing ? 'playing' : ''}`}>
          <Headphones size={38} />
        </div>
        <div className="audio-bars" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <i
              className={playing ? 'animate' : ''}
              key={i}
              style={{ height: `${14 + ((i * 17) % 34)}px`, animationDelay: `${i * 0.07}s` }}
            />
          ))}
        </div>
        <Badge tone="green">{provider || 'Preparing briefing'}</Badge>
        <p>{text || 'Loading your briefing…'}</p>
        <button className="button primary" disabled={busy || !text} onClick={play}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : playing ? (
            <Square size={15} />
          ) : (
            <Volume2 size={18} />
          )}{' '}
          {playing ? 'Stop briefing' : 'Play briefing'}
        </button>
      </div>
    </Modal>
  );
}
