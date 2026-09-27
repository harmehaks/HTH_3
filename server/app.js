import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { auth } from 'express-openid-connect';
import { createAuthSessionStore } from './auth-session-store.js';
import { authErrorPage, diagnoseAuthError } from './auth-error-page.js';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import { randomUUID, createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { auditHash, verifyAudit } from './audit.js';
import { releaseReadiness } from './readiness.js';
import { importPublicCorpus } from './public-corpus.js';
import { buildBriefing } from './briefing.js';
import { categories, category } from './legal.js';
import { classify, integrity, renderRedacted, validateSpans, embed } from './engine.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) => Object.assign(new Error(message), { status });
const clean = (s, max = 250) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const hash = (s) => createHash('sha256').update(s).digest('hex');
const presentRecord = (r) => ({ ...r, readiness: releaseReadiness(r) });
export function createApp(store, { demo = process.env.DEMO_MODE !== 'false', test = false } = {}) {
  const authOrigin = process.env.AUTH0_BASE_URL ? new URL(process.env.AUTH0_BASE_URL).origin : '';
  const app = express(),
    authEnabled = Boolean(
      process.env.AUTH0_ISSUER_BASE_URL &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET,
    );
  if (
    [
      process.env.AUTH0_ISSUER_BASE_URL,
      process.env.AUTH0_CLIENT_ID,
      process.env.AUTH0_CLIENT_SECRET,
    ].some(Boolean) &&
    !authEnabled
  )
    throw new Error(
      'Provide AUTH0_ISSUER_BASE_URL, AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET together. To use demo roles without changing saved credentials, run npm run dev:demo or npm run start:demo.',
    );
  if (!demo && !authEnabled)
    throw new Error('DEMO_MODE=false requires complete Auth0 configuration.');
  if (
    (!demo || authEnabled) &&
    (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  )
    throw new Error('A SESSION_SECRET of at least 32 characters is required.');
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          mediaSrc: ["'self'", 'blob:'],
          fontSrc: ["'self'"],
        },
      },
    }),
  );
  // Authentication redirects must never be reused from a browser/proxy cache.
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  if (authEnabled) {
    app.use(
      auth({
        authRequired: false,
        auth0Logout: true,
        secret: process.env.SESSION_SECRET,
        baseURL: process.env.AUTH0_BASE_URL || 'http://localhost:5173',
        clientID: process.env.AUTH0_CLIENT_ID,
        clientSecret: process.env.AUTH0_CLIENT_SECRET,
        clientAuthMethod: 'client_secret_post',
        issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
        authorizationParams: {
          response_type: 'code',
          response_mode: 'query',
          scope: 'openid profile email',
        },
        transactionCookie: { name: 'mr_redactor_auth_verification', sameSite: 'Lax' },
        routes: { login: false, postLogoutRedirect: '/' },
        session: {
          store: createAuthSessionStore(store),
          signSessionStoreCookie: true,
          requireSignedSessionStoreCookie: true,
          rollingDuration: 8 * 3600,
          absoluteDuration: 24 * 3600,
          cookie: { httpOnly: true, sameSite: 'Lax' },
        },
      }),
    );
    // The SDK performs the flow; these routes only supply UI hints.
    app.get(['/login', '/signup'], (req, res) => {
      const baseURL = new URL(process.env.AUTH0_BASE_URL || 'http://localhost:5173');
      if (req.get('host') !== baseURL.host) return res.redirect(new URL(req.path, baseURL).href);
      const authorizationParams = {};
      if (req.path === '/signup') authorizationParams.screen_hint = 'signup';
      const loginHint = clean(req.query.login_hint);
      if (loginHint) authorizationParams.login_hint = loginHint;
      if (['google-oauth2', 'windowslive', 'github'].includes(req.query.connection))
        authorizationParams.connection = req.query.connection;
      return res.oidc.login({ returnTo: '/', authorizationParams });
    });
  }
  // Demo sessions contain only a role and demo subject; never used when real Auth0 is active.
  if (!authEnabled)
    app.use(
      session({
        secret: process.env.SESSION_SECRET || 'local-demo-only-session-secret-32-characters',
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax', secure: !demo, maxAge: 8 * 3600000 },
      }),
    );
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (authEnabled && req.oidc?.isAuthenticated()) {
      const user = req.oidc.user,
        roles = user[process.env.AUTH0_ROLES_CLAIM || 'https://redactor.app/roles'] || [];
      req.user = {
        id: user.sub,
        name: user.name || user.email,
        role: Array.isArray(roles) && roles.includes('officer') ? 'officer' : 'requester',
      };
    } else if (demo && !authEnabled)
      req.user = {
        id: (req.session.role || 'officer') === 'officer' ? 'demo-officer' : 'demo-requester',
        name: (req.session.role || 'officer') === 'officer' ? 'Sarah Mitchell' : 'Jordan Lee',
        role: req.session.role || 'officer',
      };
    next();
  });
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin) {
        let host;
        try {
          host = new URL(origin).host;
        } catch {
          return next(fail(403, 'Invalid request origin.'));
        }
        if (
          host !== req.get('host') &&
          origin !== authOrigin &&
          !(demo && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin))
        )
          return next(fail(403, 'Cross-origin modification denied.'));
      }
      // Keep existing clients working and accept the bundled client's header too.
      if (
        req.get('x-redactor-client') !== 'workspace' &&
        req.get('x-mr-redactor-client') !== 'workspace'
      )
        return next(fail(403, 'Missing workspace request header.'));
    }
    next();
  });
  const officer = (req, res, next) =>
    req.user?.role === 'officer'
      ? next()
      : next(fail(req.user ? 403 : 401, 'Officer access required.'));
  const authenticated = (req, res, next) =>
    req.user ? next() : next(fail(401, 'Please sign in.'));
  const queue = new Map();
  const locked = (key, fn) => {
    const previous = queue.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(fn);
    queue.set(key, current);
    current
      .finally(() => {
        if (queue.get(key) === current) queue.delete(key);
      })
      .catch(() => {});
    return current;
  };
  let auditQueue = Promise.resolve();
  const audit = (req, requestId, action, detail) => {
    const task = auditQueue
      .catch(() => {})
      .then(async () => {
        const events = await store.all('audit');
        const prev = events.at(-1);
        const event = {
          id: randomUUID(),
          sequence: (prev?.sequence || 0) + 1,
          requestId,
          action,
          detail,
          actor: req.user?.name || 'System',
          at: new Date().toISOString(),
          previousHash: prev?.hash || 'genesis',
        };
        event.hash = auditHash(event);
        await store.put('audit', event);
      });
    auditQueue = task;
    return task;
  };
  const getRequest = async (id) => {
    const r = await store.get(id);
    if (!r || !Array.isArray(r.documents)) throw fail(404, 'Request not found.');
    return r;
  };
  const refreshDocument = async (req, r, d) => {
    d.integrity = null;
    delete d.integrityError;
    try {
      d.integrity = await integrity(d.text, d.spans, await store.all('corpus'), store);
    } catch (error) {
      d.integrityError = `Automatic integrity check failed. ${clean(error.message, 400)} Retry the checks before release.`;
    }
    await store.put('request', r);
    await audit(
      req,
      r.id,
      d.integrity ? 'Automatic integrity check completed' : 'Automatic integrity check failed',
      d.integrity
        ? `${d.name}: ${d.integrity.leaks.length} leak findings, ${d.integrity.conflicts.length} consistency findings.`
        : `${d.name}: review decision saved; release blocked until a successful check.`,
    );
  };
  const getDoc = (r, id) => {
    const d = r.documents.find((x) => x.id === id);
    if (!d) throw fail(404, 'Document not found.');
    return d;
  };
  const mutable = (r) => {
    if (r.status === 'released')
      throw fail(409, 'This release is locked. Reopen the request before editing.');
  };
  const summarize = (r, user) => ({
    id: r.id,
    title: r.title,
    department: r.department,
    description: r.description,
    createdAt: r.createdAt,
    dueAt: r.dueAt,
    status: r.status,
    priority: r.priority,
    synthetic: r.synthetic,
    releasedAt: r.releasedAt,
    documentCount: r.documents.length,
    pages: r.documents.reduce((s, d) => s + d.pages, 0),
    ...(user.role === 'officer'
      ? {
          pending: r.documents.reduce(
            (s, d) => s + d.spans.filter((x) => x.decision === 'pending').length,
            0,
          ),
          risk: Math.max(0, ...r.documents.map((d) => d.integrity?.risk || 0)),
          conflicts: r.documents.reduce(
            (s, d) => s + (d.integrity?.conflicts.filter((x) => !x.resolved).length || 0),
            0,
          ),
          leaks: r.documents.reduce(
            (s, d) => s + (d.integrity?.leaks.filter((x) => !x.resolved).length || 0),
            0,
          ),
        }
      : {}),
  });
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/session', (req, res) =>
    res.json({ user: req.user || null, demo: demo && !authEnabled, authEnabled }),
  );
  app.post(
    '/api/session/role',
    wrap(async (req, res) => {
      if (!demo || authEnabled)
        throw fail(403, 'Role switching is available only in the local demo.');
      if (!['officer', 'requester'].includes(req.body.role)) throw fail(400, 'Invalid role.');
      req.session.role = req.body.role;
      res.json({ ok: true });
    }),
  );
  app.get('/api/categories', authenticated, (req, res) => res.json(categories));
  app.get('/api/settings', officer, (req, res) =>
    res.json({
      demo: demo && !authEnabled,
      storage: store.backend,
      classification: process.env.GEMINI_API_KEY ? 'Gemini' : 'Local pattern rules',
      embeddings: process.env.GEMINI_API_KEY ? 'Gemini embeddings' : 'Local word-vector similarity',
      auth: authEnabled ? 'Auth0' : 'Demo sessions',
      voice: process.env.ELEVENLABS_API_KEY ? 'ElevenLabs' : 'Browser speech',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      threshold: 0.85,
    }),
  );
  app.get(
    '/api/requests',
    authenticated,
    wrap(async (req, res) => {
      const items = (await store.all('request')).filter(
        (r) => req.user.role === 'officer' || r.requesterId === req.user.id,
      );
      res.json(
        items
          .map((r) => summarize(r, req.user))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    }),
  );
  app.get(
    '/api/requests/:id',
    authenticated,
    wrap(async (req, res) => {
      const r = await getRequest(req.params.id);
      if (req.user.role !== 'officer') {
        if (r.requesterId !== req.user.id) throw fail(404, 'Request not found.');
        return res.json({
          ...summarize(r, req.user),
          documents: r.status === 'released' ? r.release.documents : [],
        });
      }
      res.json(presentRecord(r));
    }),
  );
  app.post(
    '/api/requests',
    authenticated,
    wrap(async (req, res) => {
      const title = clean(req.body.title),
        department = clean(req.body.department),
        description = clean(req.body.description, 5000);
      if (!title || !department || !description)
        throw fail(400, 'Title, department and request description are required.');
      const requesterId =
        req.user.role === 'officer'
          ? clean(req.body.requesterId) || (demo && !authEnabled ? 'demo-requester' : '')
          : req.user.id;
      if (!requesterId)
        throw fail(400, 'Provide the requester’s Auth0 subject ID to assign this request.');
      const at = new Date(),
        r = {
          id: `A-${at.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          title,
          department,
          description,
          requesterId,
          createdAt: at.toISOString(),
          dueAt: new Date(at.getTime() + 30 * 86400000).toISOString(),
          priority: 'normal',
          status: 'received',
          synthetic: demo && !authEnabled,
          documents: [],
          releasedAt: null,
        };
      await store.put('request', r);
      await audit(req, r.id, 'Request received', title);
      res.status(201).json(presentRecord(r));
    }),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 5 },
  });
  app.post(
    '/api/requests/:id/documents',
    officer,
    upload.single('file'),
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id);
        mutable(r);
        let text = typeof req.body.text === 'string' ? req.body.text : '',
          pages = 1,
          name = clean(req.body.name) || 'document.txt';
        if (req.file) {
          name = req.file.originalname.slice(0, 200);
          if (/\.pdf$/i.test(name)) {
            const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
            const loadingTask = getDocument({
              data: new Uint8Array(req.file.buffer),
              isEvalSupported: false,
              useSystemFonts: true,
              standardFontDataUrl: resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
            });
            try {
              const pdf = await loadingTask.promise;
              if (pdf.numPages > 100)
                throw fail(400, 'Please split PDFs into documents of at most 100 pages.');
              pages = pdf.numPages;
              const blocks = [];
              for (let i = 1; i <= pages; i++) {
                const page = await pdf.getPage(i),
                  content = await page.getTextContent();
                let body = '';
                for (const item of content.items)
                  if ('str' in item) body += item.str + (item.hasEOL ? '\n' : ' ');
                blocks.push(body);
              }
              text = blocks.join('\n\n');
            } catch (e) {
              if (e.status) throw e;
              throw fail(
                400,
                'Could not read this PDF. Use an unencrypted, text-based PDF or paste its text.',
              );
            } finally {
              await loadingTask.destroy();
            }
          } else if (/\.(txt|md|csv)$/i.test(name)) text = req.file.buffer.toString('utf8');
          else throw fail(400, 'Use a text-based PDF, TXT, Markdown or CSV file.');
        }
        if (!text.trim())
          throw fail(400, 'No readable text found. Scanned PDFs require OCR before import.');
        if (text.length > 120000)
          throw fail(400, 'Document exceeds 120,000 characters. Split it before importing.');
        const result = await classify(text),
          check = await integrity(text, result.spans, await store.all('corpus'), store),
          d = {
            id: randomUUID(),
            name,
            text,
            pages,
            spans: result.spans,
            integrity: check,
            engine: result.engine,
            warnings: result.warnings,
            attested: false,
            createdAt: new Date().toISOString(),
          };
        r.documents.push(d);
        r.status = 'in_review';
        await store.put('request', r);
        await audit(
          req,
          r.id,
          'Document analyzed',
          `${name}: ${d.spans.length} suggestions, ${check.leaks.length} leak findings, ${check.conflicts.length} consistency findings.`,
        );
        res.status(201).json(presentRecord(r));
      }),
    ),
  );
  app.patch(
    '/api/requests/:id/documents/:docId/spans/:spanId',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id);
        mutable(r);
        const d = getDoc(r, req.params.docId),
          s = d.spans.find((s) => s.id === req.params.spanId);
        if (!s) throw fail(404, 'Redaction not found.');
        const decision = req.body.decision,
          note = clean(req.body.note, 2000),
          cat = req.body.category || s.category;
        if (!['approved', 'dismissed', 'pending'].includes(decision) || !category(cat))
          throw fail(400, 'Invalid review decision.');
        if ((decision === 'dismissed' || cat !== s.category) && !note)
          throw fail(400, 'A rationale is required for disclosure or a category change.');
        const contentChanged =
          (s.decision === 'dismissed') !== (decision === 'dismissed') || cat !== s.category;
        s.decision = decision;
        s.reviewNote = note;
        s.category = cat;
        s.reviewedBy = req.user.name;
        s.reviewedAt = new Date().toISOString();
        d.attested = false;
        if (contentChanged) d.integrity = null;
        await store.put('request', r);
        await audit(
          req,
          r.id,
          'Redaction reviewed',
          `${d.name}: ${decision}; s. ${category(cat).section}${note ? `; ${note}` : ''}`,
        );
        if (contentChanged) await refreshDocument(req, r, d);
        res.json(presentRecord(r));
      }),
    ),
  );
  app.post(
    '/api/requests/:id/documents/:docId/spans',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id);
        mutable(r);
        const d = getDoc(r, req.params.docId),
          note = clean(req.body.note, 2000);
        if (!note) throw fail(400, 'A justification is required for a manual redaction.');
        const s = {
          id: randomUUID(),
          start: req.body.start,
          end: req.body.end,
          category: req.body.category,
          confidence: 1,
          decision: 'approved',
          justification: note,
          reviewNote: note,
          source: 'Officer',
          reviewedBy: req.user.name,
          reviewedAt: new Date().toISOString(),
        };
        try {
          const overlaps = d.spans.filter((old) => s.start < old.end && s.end > old.start);
          if (req.body.replaceOverlaps === true) {
            if (overlaps.some((old) => s.start > old.start || s.end < old.end))
              throw new Error('Replacement must fully cover each overlapping suggestion.');
            const remaining = d.spans.filter((old) => !overlaps.includes(old));
            const next = validateSpans(d.text, [...remaining, s]);
            d.supersededSpans = [
              ...(d.supersededSpans || []),
              ...overlaps.map((old) => ({
                ...old,
                replacedBy: s.id,
                replacedAt: new Date().toISOString(),
                replacementNote: note,
              })),
            ];
            d.spans = next;
          } else d.spans = validateSpans(d.text, [...d.spans, s]);
        } catch (e) {
          throw fail(400, e.message);
        }
        d.integrity = null;
        d.attested = false;
        await store.put('request', r);
        await audit(
          req,
          r.id,
          'Manual redaction added',
          `${d.name}: s. ${category(s.category).section}; ${note}`,
        );
        await refreshDocument(req, r, d);
        res.status(201).json(presentRecord(r));
      }),
    ),
  );
  app.delete(
    '/api/requests/:id/documents/:docId',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id);
        mutable(r);
        const d = getDoc(r, req.params.docId),
          note = clean(req.body.note, 2000);
        if (!note) throw fail(400, 'A reason is required to remove a document.');
        r.documents = r.documents.filter((x) => x.id !== d.id);
        if (!r.documents.length) r.status = 'received';
        await store.put('request', r);
        await audit(req, r.id, 'Document removed', `${d.name}: ${note}`);
        res.json(r);
      }),
    ),
  );
  app.post(
    '/api/requests/:id/integrity',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id);
        mutable(r);
        const corpus = await store.all('corpus');
        r.documents.forEach((d) => {
          d.integrity = null;
          d.attested = false;
        });
        await store.put('request', r);
        let checks;
        try {
          checks = await Promise.all(
            r.documents.map((d) => integrity(d.text, d.spans, corpus, store)),
          );
        } catch (error) {
          r.documents.forEach((d) => {
            d.integrityError = 'Integrity check failed. Retry before release.';
          });
          await store.put('request', r);
          await audit(req, r.id, 'Integrity checks failed', clean(error.message, 400));
          throw error;
        }
        r.documents.forEach((d, i) => {
          d.integrity = checks[i];
          delete d.integrityError;
        });
        await store.put('request', r);
        await audit(
          req,
          r.id,
          'Integrity checks completed',
          `${r.documents.length} documents checked against candidate releases.`,
        );
        res.json(presentRecord(r));
      }),
    ),
  );
  app.patch(
    '/api/requests/:id/documents/:docId/findings/:findingId',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id);
        mutable(r);
        const d = getDoc(r, req.params.docId),
          finding = [...(d.integrity?.leaks || []), ...(d.integrity?.conflicts || [])].find(
            (f) => f.id === req.params.findingId,
          ),
          note = clean(req.body.note, 2000);
        if (!finding) throw fail(404, 'Finding not found.');
        if (!note)
          throw fail(
            400,
            'Explain how the finding was addressed or why the residual risk is accepted.',
          );
        finding.resolved = true;
        finding.note = note;
        finding.reviewedBy = req.user.name;
        d.attested = false;
        await store.put('request', r);
        await audit(req, r.id, 'Integrity finding resolved', note);
        res.json(presentRecord(r));
      }),
    ),
  );
  app.patch(
    '/api/requests/:id/documents/:docId/attestation',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id);
        mutable(r);
        const d = getDoc(r, req.params.docId);
        if (req.body.attested !== true) throw fail(400, 'Full document review must be confirmed.');
        d.attested = true;
        d.attestedBy = req.user.name;
        await store.put('request', r);
        await audit(req, r.id, 'Full document review confirmed', d.name);
        res.json(presentRecord(r));
      }),
    ),
  );
  app.post(
    '/api/requests/:id/release',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id);
        mutable(r);
        const readiness = releaseReadiness(r);
        if (!readiness.ready) throw fail(409, readiness.blockers[0]);
        r.status = 'released';
        r.releasedAt = new Date().toISOString();
        r.releasedBy = req.user.name;
        r.release = {
          documents: r.documents.map((d) => ({
            id: d.id,
            name: d.name,
            pages: d.pages,
            text: renderRedacted(d.text, d.spans),
            sections: [
              ...new Set(d.spans.filter((s) => s.decision !== 'dismissed').map((s) => s.category)),
            ],
          })),
        };
        await store.put('request', r);
        await audit(
          req,
          r.id,
          'Release approved',
          `${r.documents.length} reviewed documents released to the requester.`,
        );
        res.json(presentRecord(r));
      }),
    ),
  );
  app.post(
    '/api/requests/:id/reopen',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id),
          note = clean(req.body.note, 2000);
        if (r.status !== 'released' || !note)
          throw fail(400, 'A released request and reopening rationale are required.');
        r.status = 'in_review';
        r.release = null;
        r.releasedAt = null;
        r.documents.forEach((d) => (d.attested = false));
        await store.put('request', r);
        await audit(req, r.id, 'Request reopened', note);
        res.json(presentRecord(r));
      }),
    ),
  );
  app.delete(
    '/api/requests/:id',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id),
          note = clean(req.body.note, 2000);
        mutable(r);
        if (!note) throw fail(400, 'A reason is required to delete a request.');
        await store.delete(r.id);
        await audit(req, r.id, 'Request deleted', note);
        res.json({ ok: true });
      }),
    ),
  );
  app.get(
    '/api/requests/:id/export/:format',
    authenticated,
    wrap(async (req, res) => {
      const r = await getRequest(req.params.id);
      if (req.user.role !== 'officer' && (r.requesterId !== req.user.id || r.status !== 'released'))
        throw fail(404, 'Release not available.');
      const docs =
          r.status === 'released'
            ? r.release.documents
            : r.documents.map((d) => ({ name: d.name, text: renderRedacted(d.text, d.spans) })),
        format = req.params.format;
      if (format === 'receipt') {
        if (r.status !== 'released')
          throw fail(409, 'Approve the release before downloading its receipt.');
        res.setHeader('Content-Disposition', `attachment; filename="${r.id}-receipt.json"`);
        return res.json({
          version: 1,
          requestId: r.id,
          releasedAt: r.releasedAt,
          description:
            'SHA-256 hashes cover each approved document text, not PDF bytes. This receipt is not a digital signature or a legal certification.',
          documents: r.release.documents.map((d) => ({
            id: d.id,
            name: d.name,
            sha256: hash(d.text),
          })),
        });
      }
      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${r.id}-redacted.pdf"`);
        const pdf = new PDFDocument({
          size: 'A4',
          margin: 55,
          info: { Title: `${r.id} - redacted release`, Author: 'Mr. Redactor' },
        });
        pdf.pipe(res);
        docs.forEach((d, i) => {
          if (i) pdf.addPage();
          pdf
            .font('Helvetica-Bold')
            .fontSize(11)
            .fillColor('#164c3c')
            .text('MR. REDACTOR / ACCESS TO INFORMATION');
          pdf.moveDown().fontSize(18).text(r.title);
          pdf
            .moveDown()
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#666666')
            .text(
              `${r.id} | ${r.status === 'released' ? 'Approved release' : 'DRAFT - not approved for release'} | ${d.name}`,
            );
          pdf.moveDown(2).fontSize(10).fillColor('#222222').text(d.text, { lineGap: 4 });
        });
        pdf.end();
      } else if (format === 'txt') {
        res.setHeader('Content-Disposition', `attachment; filename="${r.id}-redacted.txt"`);
        res
          .type('text')
          .send(
            `${r.id} - ${r.status === 'released' ? 'Approved release' : 'DRAFT - not approved for release'}\n\n` +
              docs.map((d) => `${d.name}\n\n${d.text}`).join('\n\n---\n\n'),
          );
      } else if (format === 'json' && req.user.role === 'officer') {
        res.setHeader('Content-Disposition', `attachment; filename="${r.id}-decisions.json"`);
        res.json({
          requestId: r.id,
          status: r.status,
          documents: r.documents.map((d) => ({
            name: d.name,
            engine: d.engine,
            redactedText: renderRedacted(d.text, d.spans),
            decisions: d.spans.map((s) => ({
              category: s.category,
              section: category(s.category).section,
              decision: s.decision,
              justification: s.justification,
              reviewNote: s.reviewNote,
              reviewedBy: s.reviewedBy,
            })),
            supersededDecisions: (d.supersededSpans || []).map((s) => ({
              id: s.id,
              category: s.category,
              decision: s.decision,
              reviewNote: s.reviewNote,
              reviewedBy: s.reviewedBy,
              replacedBy: s.replacedBy,
              replacedAt: s.replacedAt,
              replacementNote: s.replacementNote,
            })),
            integrity: d.integrity,
          })),
        });
      } else throw fail(400, 'Unsupported export format.');
    }),
  );
  app.get(
    '/api/corpus',
    officer,
    wrap(async (req, res) => res.json((await store.all('corpus')).map(({ embedding, ...c }) => c))),
  );
  app.post(
    '/api/corpus/starter',
    officer,
    wrap(async (req, res) =>
      locked('corpus', async () => {
        const count = await importPublicCorpus(store, { live: true });
        await audit(
          req,
          null,
          'Public starter library imported',
          `${count} excerpts from official proactive publications indexed.`,
        );
        res.json({ count });
      }),
    ),
  );
  app.put(
    '/api/requests/:id/documents/:docId/reference',
    officer,
    wrap(async (req, res) =>
      locked(req.params.id, async () => {
        const r = await getRequest(req.params.id);
        mutable(r);
        const d = getDoc(r, req.params.docId),
          text = typeof req.body.text === 'string' ? req.body.text : '',
          sourceUrl = clean(req.body.sourceUrl, 2000);
        let url;
        try {
          url = new URL(sourceUrl);
        } catch {
          throw fail(400, 'Provide a valid public source URL.');
        }
        if (text.length > 120000)
          throw fail(
            400,
            'Published reference exceeds 120,000 characters. Split it before importing.',
          );
        if (!text.trim() || !['https:', 'http:'].includes(url.protocol))
          throw fail(400, 'Published text and a public HTTP(S) source are required.');
        d.reference = {
          text,
          sourceUrl: url.href,
          addedBy: req.user.name,
          addedAt: new Date().toISOString(),
        };
        await store.put('request', r);
        await audit(req, r.id, 'Published comparison attached', d.name);
        res.json(presentRecord(r));
      }),
    ),
  );
  app.post(
    '/api/corpus',
    officer,
    wrap(async (req, res) => {
      const text = typeof req.body.text === 'string' ? req.body.text : '',
        requestRef = clean(req.body.requestRef),
        sourceUrl = clean(req.body.sourceUrl, 2000),
        treatment = req.body.treatment || 'released';
      if (text.length > 20000)
        throw fail(400, 'Reference excerpt exceeds 20,000 characters. Split it before importing.');
      let parsed;
      try {
        parsed = new URL(sourceUrl);
      } catch {
        throw fail(400, 'Provide a valid public source URL.');
      }
      if (
        !['https:', 'http:'].includes(parsed.protocol) ||
        !text ||
        !requestRef ||
        !['released', 'withheld'].includes(treatment) ||
        (treatment === 'withheld' && !category(req.body.category))
      )
        throw fail(400, 'A public source, excerpt, reference and valid treatment are required.');
      const e = await embed(text),
        c = {
          id: randomUUID(),
          requestRef,
          title: clean(req.body.title) || requestRef,
          text,
          sourceUrl: parsed.href,
          treatment,
          category: treatment === 'withheld' ? req.body.category : null,
          synthetic: false,
          embedding: e.values,
          embeddingModel: e.model,
          addedAt: new Date().toISOString(),
        };
      await store.put('corpus', c);
      await store.vector(c.id, e.values, e.model);
      await audit(req, null, 'Public reference added', requestRef);
      res.status(201).json({ id: c.id });
    }),
  );
  app.post(
    '/api/corpus/reindex',
    officer,
    wrap(async (req, res) =>
      locked('corpus', async () => {
        const corpus = await store.all('corpus');
        for (const c of corpus) {
          const e = await embed(c.text);
          c.embedding = e.values;
          c.embeddingModel = e.model;
          await store.put('corpus', c);
          await store.vector(c.id, e.values, e.model);
        }
        await audit(req, null, 'Reference library reindexed', `${corpus.length} excerpts indexed.`);
        res.json({ count: corpus.length });
      }),
    ),
  );
  app.get(
    '/api/audit',
    officer,
    wrap(async (req, res) => {
      const events = await store.all('audit');
      res.json({ events: [...events].reverse(), valid: verifyAudit(events) });
    }),
  );
  app.get(
    '/api/briefing',
    officer,
    wrap(async (req, res) => {
      res.json({
        text: buildBriefing(await store.all('request')),
        provider: process.env.ELEVENLABS_API_KEY ? 'ElevenLabs' : 'Browser speech',
      });
    }),
  );
  app.post(
    '/api/briefing/audio',
    officer,
    wrap(async (req, res) => {
      if (!process.env.ELEVENLABS_API_KEY)
        throw fail(409, 'ElevenLabs is not configured. Browser speech is available.');
      const text = buildBriefing(await store.all('request'));
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
          },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
        },
      );
      if (!response.ok) throw fail(502, `Voice generation failed (${response.status}).`);
      res.type('audio/mpeg').send(Buffer.from(await response.arrayBuffer()));
    }),
  );
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
  if (existsSync('dist')) {
    app.use(express.static(resolve('dist')));
    app.get('*', (req, res) => res.sendFile(join(resolve('dist'), 'index.html')));
  }
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status =
      err.status ||
      err.statusCode ||
      (['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT'].includes(err.code) ? 400 : 500);
    if (authEnabled && req.path === '/callback') {
      const diagnostic = diagnoseAuthError(err, {
        code: Boolean(req.query.code),
        providerError: Boolean(req.query.error),
      });
      console.warn(`Auth0 callback failed: ${diagnostic.code}`);
      res.status(status).set('Cache-Control', 'no-store');
      if (req.get('accept')?.includes('text/html'))
        return res
          .type('html')
          .send(
            authErrorPage({
              clientID: process.env.AUTH0_CLIENT_ID,
              baseURL: process.env.AUTH0_BASE_URL || 'http://localhost:5173',
              diagnostic,
            }),
          );
      return res.json({
        error: diagnostic.explanation,
        diagnostic: diagnostic.code,
        providerErrorCode: diagnostic.providerCode,
      });
    }
    res.status(status).json({
      error:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File exceeds 15 MB.'
          : err.message || 'Something went wrong.',
    });
  });
  return app;
}
