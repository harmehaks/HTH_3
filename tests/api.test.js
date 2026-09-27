import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createStore } from '../server/store.js';
import { createApp } from '../server/app.js';
import { seed } from '../server/seed.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
for (const name of [
  'GEMINI_API_KEY',
  'AUTH0_ISSUER_BASE_URL',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
  'ELEVENLABS_API_KEY',
])
  delete process.env[name];
async function fixture() {
  const store = await createStore({ url: '', path: ':memory:' });
  const app = createApp(store, { demo: true, test: true }),
    server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = 'GET', body, cookie, raw = false, headers = {} } = {}) {
    const r = await fetch(base + '/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Redactor-Client': 'workspace',
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      headers: r.headers,
      data: raw ? await r.arrayBuffer() : await r.json(),
    };
  }
  async function make() {
    const r = (
      await request('/requests', {
        method: 'POST',
        body: {
          title: 'Test access request',
          department: 'Canada Border Services Agency',
          description: 'Program records',
        },
      })
    ).data;
    return r;
  }
  return {
    store,
    request,
    make,
    base,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await store.close();
    },
  };
}
test('workspace modifications accept existing and bundled client headers but reject missing headers', async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.request('/session/role', { method: 'POST', body: { role: 'officer' } })).status,
      200,
    );
    assert.equal(
      (
        await f.request('/session/role', {
          method: 'POST',
          body: { role: 'officer' },
          headers: {
            'X-Redactor-Client': '',
            'X-Mr-Redactor-Client': 'workspace',
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.request('/session/role', {
          method: 'POST',
          body: { role: 'officer' },
          headers: {
            'X-Redactor-Client': '',
            'X-Mr-Redactor-Client': '',
          },
        })
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});

test('the configured Auth0 origin works with a trailing slash and rejects a different origin', async () => {
  const originalBase = process.env.AUTH0_BASE_URL;
  process.env.AUTH0_BASE_URL = 'https://officer.example.test/';
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.request('/session/role', {
          method: 'POST',
          body: { role: 'officer' },
          headers: { Origin: 'https://officer.example.test' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.request('/session/role', {
          method: 'POST',
          body: { role: 'officer' },
          headers: { Origin: 'https://officer.example.test.attacker.invalid' },
        })
      ).status,
      403,
    );
  } finally {
    if (originalBase === undefined) delete process.env.AUTH0_BASE_URL;
    else process.env.AUTH0_BASE_URL = originalBase;
    await f.close();
  }
});

test('complete request-to-release lifecycle preserves redaction and reviewer gates', async () => {
  const f = await fixture();
  try {
    let r = await f.make();
    assert.equal(r.status, 'received');
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      409,
    );
    let result = await f.request(`/requests/${r.id}/documents`, {
      method: 'POST',
      body: {
        text: 'Public information.\nEmployee name: Secret Person\nEmail: secret.person@example.net',
        name: 'record.txt',
      },
    });
    assert.equal(result.status, 201);
    r = result.data;
    const doc = r.documents[0];
    assert.equal(doc.spans.length, 2);
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      409,
    );
    for (const s of doc.spans)
      assert.equal(
        (
          await f.request(`/requests/${r.id}/documents/${doc.id}/spans/${s.id}`, {
            method: 'PATCH',
            body: { decision: 'approved' },
          })
        ).status,
        200,
      );
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      409,
    );
    await f.request(`/requests/${r.id}/documents/${doc.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    result = await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} });
    assert.equal(result.status, 200);
    assert.equal(result.data.status, 'released');
    assert.ok(!result.data.release.documents[0].text.includes('Secret Person'));
    assert.equal(
      (
        await f.request(`/requests/${r.id}/documents/${doc.id}/spans/${doc.spans[0].id}`, {
          method: 'PATCH',
          body: { decision: 'dismissed', note: 'public' },
        })
      ).status,
      409,
    );
    const audit = await f.request('/audit');
    assert.ok(audit.data.valid);
    assert.ok(audit.data.events.some((e) => e.action === 'Release approved'));
    const pdf = await f.request(`/requests/${r.id}/export/pdf`, { raw: true });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    const parsed = await getDocument({
      data: new Uint8Array(pdf.data),
      isEvalSupported: false,
      standardFontDataUrl: resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
    }).promise;
    let content = '';
    for (let i = 1; i <= parsed.numPages; i++)
      content += (await (await parsed.getPage(i)).getTextContent()).items
        .map((i) => i.str || '')
        .join(' ');
    assert.ok(content.includes('Public information'));
    assert.ok(!content.includes('Secret Person'));
    assert.ok(!content.includes('secret.person@example.net'));
    await parsed.loadingTask.destroy();
    assert.equal(
      (
        await f.request(`/requests/${r.id}/reopen`, {
          method: 'POST',
          body: { note: 'Additional review required.' },
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      409,
    );
  } finally {
    await f.close();
  }
});
test('requester APIs never expose originals, spans, findings, or officer-only data', async () => {
  const f = await fixture();
  try {
    await seed(f.store);
    const role = await f.request('/session/role', { method: 'POST', body: { role: 'requester' } }),
      cookie = role.headers.get('set-cookie').split(';')[0];
    const list = await f.request('/requests', { cookie });
    assert.equal(list.status, 200);
    assert.equal(list.data.length, 10);
    assert.ok(list.data.every((r) => !('pending' in r) && !('risk' in r)));
    const inReview = list.data.find((r) => r.status === 'in_review'),
      record = await f.request(`/requests/${inReview.id}`, { cookie });
    assert.deepEqual(record.data.documents, []);
    assert.equal((await f.request(`/requests/${inReview.id}/export/pdf`, { cookie })).status, 404);
    for (const path of ['/audit', '/settings', '/corpus', '/briefing'])
      assert.equal((await f.request(path, { cookie })).status, 403);
    assert.equal(
      (await f.request(`/requests/${inReview.id}/release`, { cookie, method: 'POST', body: {} }))
        .status,
      403,
    );
    const released = list.data.find((r) => r.status === 'released'),
      output = (await f.request(`/requests/${released.id}`, { cookie })).data;
    assert.ok(output.documents.every((d) => !('spans' in d) && !('integrity' in d)));
    assert.ok(!JSON.stringify(output).includes('jamie.chen@example.net'));
    const other = await f.store.get(inReview.id);
    other.requesterId = 'somebody-else';
    await f.store.put('request', other);
    assert.equal((await f.request(`/requests/${inReview.id}`, { cookie })).status, 404);
    assert.equal((await f.request('/requests', { cookie })).data.length, 9);
  } finally {
    await f.close();
  }
});
test('disclosure requires rationale, automatically refreshes integrity and resets full-review confirmation', async () => {
  const f = await fixture();
  try {
    const r = await f.make(),
      uploaded = (
        await f.request(`/requests/${r.id}/documents`, {
          method: 'POST',
          body: { text: 'Employee name: Secret Person' },
        })
      ).data,
      d = uploaded.documents[0],
      s = d.spans[0],
      path = `/requests/${r.id}/documents/${d.id}/spans/${s.id}`;
    assert.equal(
      (await f.request(path, { method: 'PATCH', body: { decision: 'dismissed' } })).status,
      400,
    );
    const result = await f.request(path, {
      method: 'PATCH',
      body: { decision: 'dismissed', note: 'Consent to disclosure verified.' },
    });
    assert.equal(result.status, 200);
    assert.ok(result.data.documents[0].integrity);
    assert.notEqual(result.data.documents[0].integrity.outputHash, d.integrity.outputHash);
    assert.equal(result.data.documents[0].attested, false);
    const stale = await f.store.get(r.id);
    stale.documents[0].integrity = d.integrity;
    await f.store.put('request', stale);
    await f.request(`/requests/${r.id}/documents/${d.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      409,
    );
    await f.request(`/requests/${r.id}/integrity`, { method: 'POST', body: {} });
    await f.request(`/requests/${r.id}/documents/${d.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      200,
    );
  } finally {
    await f.close();
  }
});
test('unresolved mosaic findings block release and require documented resolution', async () => {
  const f = await fixture();
  try {
    const r = await f.make(),
      uploaded = (
        await f.request(`/requests/${r.id}/documents`, {
          method: 'POST',
          body: {
            text: 'Employee name: Secret Person\nThe only officer in the district can be identified in the contact directory.',
          },
        })
      ).data,
      d = uploaded.documents[0];
    assert.equal(d.integrity.leaks.length, 1);
    for (const s of d.spans)
      await f.request(`/requests/${r.id}/documents/${d.id}/spans/${s.id}`, {
        method: 'PATCH',
        body: { decision: 'approved' },
      });
    await f.request(`/requests/${r.id}/documents/${d.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      409,
    );
    const path = `/requests/${r.id}/documents/${d.id}/findings/${d.integrity.leaks[0].id}`;
    assert.equal((await f.request(path, { method: 'PATCH', body: { note: '' } })).status, 400);
    assert.equal(
      (
        await f.request(path, {
          method: 'PATCH',
          body: { note: 'Residual context assessed; identity already public with consent.' },
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      409,
    );
    await f.request(`/requests/${r.id}/documents/${d.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      200,
    );
  } finally {
    await f.close();
  }
});
test('automatic check failure preserves the edit, exposes the error and blocks release until retry', async () => {
  const f = await fixture();
  const originalFetch = globalThis.fetch;
  try {
    const r = await f.make();
    const uploaded = (
      await f.request(`/requests/${r.id}/documents`, {
        method: 'POST',
        body: { text: 'Public result.\nPrivate context.' },
      })
    ).data;
    const d = uploaded.documents[0];
    process.env.GEMINI_API_KEY = 'contract-test-key';
    globalThis.fetch = (url, options) =>
      String(url).startsWith('https://generativelanguage.googleapis.com/')
        ? Promise.resolve(new Response('{}', { status: 503 }))
        : originalFetch(url, options);
    const result = await f.request(`/requests/${r.id}/documents/${d.id}/spans`, {
      method: 'POST',
      body: { start: 15, end: 31, category: 'personal', note: 'Identifying context reviewed.' },
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.documents[0].spans.length, 1);
    assert.equal(result.data.documents[0].integrity, null);
    assert.match(result.data.documents[0].integrityError, /Automatic integrity check failed/);
    await f.request(`/requests/${r.id}/documents/${d.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      409,
    );
    delete process.env.GEMINI_API_KEY;
    globalThis.fetch = originalFetch;
    const retry = await f.request(`/requests/${r.id}/integrity`, { method: 'POST', body: {} });
    assert.equal(retry.status, 200);
    assert.ok(retry.data.documents[0].integrity);
    assert.equal(retry.data.documents[0].integrityError, undefined);
    assert.equal(retry.data.documents[0].attested, false);
    await f.request(`/requests/${r.id}/documents/${d.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      200,
    );
  } finally {
    delete process.env.GEMINI_API_KEY;
    globalThis.fetch = originalFetch;
    await f.close();
  }
});

test('manual redactions remove selected text, automatically refresh checks and reject overlap', async () => {
  const f = await fixture();
  try {
    const r = await f.make(),
      uploaded = (
        await f.request(`/requests/${r.id}/documents`, {
          method: 'POST',
          body: { text: 'Visible phrase.\nSecret context.' },
        })
      ).data,
      d = uploaded.documents[0],
      path = `/requests/${r.id}/documents/${d.id}/spans`,
      body = {
        start: 16,
        end: 31,
        category: 'personal',
        note: 'Identifying context under s.19(1); consent exceptions considered.',
      };
    assert.equal((await f.request(path, { method: 'POST', body })).status, 201);
    const updated = (await f.request(`/requests/${r.id}`)).data.documents[0];
    assert.ok(updated.integrity);
    assert.notEqual(updated.integrity.outputHash, d.integrity.outputHash);
    assert.notEqual((await f.request(path, { method: 'POST', body })).status, 201);
  } finally {
    await f.close();
  }
});
test('input validation and cross-origin modification protections reject invalid operations', async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.request('/requests', { method: 'POST', body: { title: 'Missing fields' } })).status,
      400,
    );
    assert.equal(
      (await f.request('/session/role', { method: 'POST', body: { role: 'admin' } })).status,
      400,
    );
    assert.equal(
      (
        await f.request('/requests', {
          method: 'POST',
          body: {},
          headers: { Origin: 'https://malicious.example' },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request('/requests', {
          method: 'POST',
          body: {},
          headers: { 'X-Redactor-Client': '' },
        })
      ).status,
      403,
    );
    assert.equal((await f.request('/requests/nonexistent')).status, 404);
    assert.equal(
      (
        await f.request('/corpus', {
          method: 'POST',
          body: { text: 'Public data', requestRef: 'A-1', sourceUrl: 'javascript:alert(1)' },
        })
      ).status,
      400,
    );
  } finally {
    await f.close();
  }
});
test('public corpus import indexes real source metadata and detects contradictory treatment', async () => {
  const f = await fixture();
  try {
    const text = 'We recommend a phased implementation following the readiness assessment.',
      added = await f.request('/corpus', {
        method: 'POST',
        body: {
          text,
          requestRef: 'A-2025-1',
          title: 'Public pilot record',
          sourceUrl: 'https://example.gov/release',
          treatment: 'released',
        },
      });
    assert.equal(added.status, 201);
    const corpus = (await f.request('/corpus')).data;
    assert.equal(corpus[0].synthetic, false);
    assert.ok(!('embedding' in corpus[0]));
    const r = await f.make(),
      uploaded = (
        await f.request(`/requests/${r.id}/documents`, { method: 'POST', body: { text } })
      ).data;
    assert.equal(uploaded.documents[0].integrity.conflicts.length, 1);
    assert.equal(uploaded.documents[0].integrity.conflicts[0].requestRef, 'A-2025-1');
  } finally {
    await f.close();
  }
});
test('multipart text and PDF uploads are analyzed and unsupported files are rejected', async () => {
  const f = await fixture();
  try {
    const r = await f.make();
    const form = new FormData();
    form.append(
      'file',
      new Blob(['Employee name: Secret Person'], { type: 'text/plain' }),
      'test.txt',
    );
    const uploaded = await fetch(f.base + `/api/requests/${r.id}/documents`, {
      method: 'POST',
      headers: { 'X-Redactor-Client': 'workspace' },
      body: form,
    });
    assert.equal(uploaded.status, 201);
    const draft = await f.request(`/requests/${r.id}/export/pdf`, { raw: true });
    const pdfForm = new FormData();
    pdfForm.append('file', new Blob([draft.data], { type: 'application/pdf' }), 'safe.pdf');
    const imported = await fetch(f.base + `/api/requests/${r.id}/documents`, {
      method: 'POST',
      headers: { 'X-Redactor-Client': 'workspace' },
      body: pdfForm,
    });
    assert.equal(imported.status, 201);
    const exe = new FormData();
    exe.append('file', new Blob(['x']), 'test.exe');
    const rejected = await fetch(f.base + `/api/requests/${r.id}/documents`, {
      method: 'POST',
      headers: { 'X-Redactor-Client': 'workspace' },
      body: exe,
    });
    assert.equal(rejected.status, 400);
  } finally {
    await f.close();
  }
});
test('public starter references are source-linked, idempotent and not fictitious ATI responses', async () => {
  const f = await fixture();
  try {
    let result = await f.request('/corpus/starter', { method: 'POST', body: {} });
    assert.equal(result.status, 200);
    assert.equal(result.data.count, 24);
    result = await f.request('/corpus/starter', { method: 'POST', body: {} });
    assert.equal(result.data.count, 0);
    const corpus = (await f.request('/corpus')).data;
    assert.equal(corpus.length, 24);
    assert.ok(
      corpus
        .filter((c) => c.sourceType === 'proactive_publication')
        .every(
          (c) =>
            !c.synthetic &&
            c.sourceType === 'proactive_publication' &&
            c.requestRef.startsWith('PD-GAC-') &&
            new URL(c.sourceUrl).hostname === 'international.canada.ca',
        ),
    );
    const ati = corpus.filter((c) => c.sourceType === 'ati_release');
    assert.equal(ati.length, 8);
    assert.equal(new Set(ati.map((c) => c.requestRef)).size, 8);
    assert.ok(
      ati.every(
        (c) =>
          !c.synthetic &&
          c.sourcePage > 0 &&
          c.pdfSha256.length === 64 &&
          c.treatment === 'released' &&
          new URL(c.pdfUrl).hostname === 'central.bac-lac.gc.ca',
      ),
    );
    assert.equal((await f.request('/does-not-exist')).status, 404);
  } finally {
    await f.close();
  }
});
test('published comparisons require public sources and stay officer-only before release', async () => {
  const f = await fixture();
  try {
    const r = await f.make(),
      uploaded = (
        await f.request(`/requests/${r.id}/documents`, {
          method: 'POST',
          body: { text: 'Employee name: Private Person' },
        })
      ).data,
      d = uploaded.documents[0],
      path = `/requests/${r.id}/documents/${d.id}/reference`;
    assert.equal(
      (
        await f.request(path, {
          method: 'PUT',
          body: { text: 'published', sourceUrl: 'file:///private/document' },
        })
      ).status,
      400,
    );
    const result = await f.request(path, {
      method: 'PUT',
      body: { text: 'Employee name: [REDACTED]', sourceUrl: 'https://example.gov/released-record' },
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.documents[0].reference.text, 'Employee name: [REDACTED]');
    const role = await f.request('/session/role', { method: 'POST', body: { role: 'requester' } }),
      cookie = role.headers.get('set-cookie').split(';')[0];
    const owner = (await f.request(`/requests/${r.id}`, { cookie })).data;
    assert.deepEqual(owner.documents, []);
    assert.ok(!JSON.stringify(owner).includes('Private Person'));
  } finally {
    await f.close();
  }
});
test('ElevenLabs receives the exact queue transcript and no original records', async () => {
  const f = await fixture(),
    oldFetch = globalThis.fetch,
    oldKey = process.env.ELEVENLABS_API_KEY;
  try {
    await seed(f.store);
    const briefing = (await f.request('/briefing')).data.text;
    process.env.ELEVENLABS_API_KEY = 'test-voice-key';
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      if (String(url).startsWith('https://api.elevenlabs.io/')) {
        calls++;
        const data = JSON.parse(options.body);
        assert.equal(data.text, briefing);
        assert.ok(!data.text.includes('Alex Morgan'));
        assert.ok(!data.text.includes('alex.morgan@example.net'));
        assert.equal(options.headers['xi-api-key'], 'test-voice-key');
        return new Response(new Uint8Array([73, 68, 51]), {
          headers: { 'Content-Type': 'audio/mpeg' },
        });
      }
      return oldFetch(url, options);
    };
    const audio = await f.request('/briefing/audio', { method: 'POST', body: {}, raw: true });
    assert.equal(audio.status, 200);
    assert.equal(audio.headers.get('content-type'), 'audio/mpeg');
    assert.deepEqual([...new Uint8Array(audio.data)], [73, 68, 51]);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = oldKey;
    await f.close();
  }
});
test('oversized pasted records are rejected instead of silently truncating sensitive tails', async () => {
  const f = await fixture();
  try {
    const r = await f.make(),
      text = 'Public text. '.repeat(10001) + '\nEmployee name: Hidden Tail';
    const result = await f.request(`/requests/${r.id}/documents`, {
      method: 'POST',
      body: { text },
    });
    assert.equal(result.status, 400);
    assert.equal((await f.request(`/requests/${r.id}`)).data.documents.length, 0);
    const corpus = await f.request('/corpus', {
      method: 'POST',
      body: { text: 'x'.repeat(20001), requestRef: 'A-1', sourceUrl: 'https://example.gov/record' },
    });
    assert.equal(corpus.status, 400);
  } finally {
    await f.close();
  }
});

test('overlap replacement is explicit, keeps history, and never uncovers a partial old span', async () => {
  const f = await fixture();
  try {
    const r = await f.make();
    const text = 'Employee name: Alex Morgan';
    const uploaded = (
      await f.request(`/requests/${r.id}/documents`, { method: 'POST', body: { text } })
    ).data;
    const d = uploaded.documents[0],
      old = d.spans[0];
    await f.request(`/requests/${r.id}/documents/${d.id}/spans/${old.id}`, {
      method: 'PATCH',
      body: { decision: 'dismissed', note: 'Replacing with a broader contextual redaction.' },
    });
    const path = `/requests/${r.id}/documents/${d.id}/spans`;
    const body = {
      start: 0,
      end: text.length,
      category: 'personal',
      note: 'The whole line contains identifying context.',
    };
    assert.equal((await f.request(path, { method: 'POST', body })).status, 400);
    assert.equal(
      (
        await f.request(path, {
          method: 'POST',
          body: { ...body, end: text.length - 1, replaceOverlaps: true },
        })
      ).status,
      400,
    );
    const changed = await f.request(path, {
      method: 'POST',
      body: { ...body, replaceOverlaps: true },
    });
    assert.equal(changed.status, 201);
    assert.equal(changed.data.documents[0].spans.length, 1);
    assert.equal(changed.data.documents[0].supersededSpans[0].id, old.id);
    assert.equal(changed.data.readiness.withheldCharacters, text.length);
    assert.equal(changed.data.readiness.ready, false);
    await f.request(`/requests/${r.id}/documents/${d.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    const released = await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} });
    assert.equal(released.status, 200);
    const receipt = await f.request(`/requests/${r.id}/export/receipt`);
    assert.equal(receipt.status, 200);
    assert.match(receipt.data.documents[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      receipt.data.documents[0].sha256,
      createHash('sha256').update(released.data.release.documents[0].text).digest('hex'),
    );
    const decisions = await f.request(`/requests/${r.id}/export/json`);
    assert.equal(decisions.data.documents[0].supersededDecisions[0].id, old.id);
    assert.ok(!JSON.stringify(receipt.data).includes('Alex Morgan'));
    const stranger = (
      await f.request('/session/role', { method: 'POST', body: { role: 'requester' } })
    ).headers
      .get('set-cookie')
      .split(';')[0];
    const stored = await f.store.get(r.id);
    stored.requesterId = 'different-requester';
    await f.store.put('request', stored);
    assert.equal(
      (await f.request(`/requests/${r.id}/export/receipt`, { cookie: stranger })).status,
      404,
    );
  } finally {
    await f.close();
  }
});

test('failed explicit integrity rerun invalidates older checks and release readiness', async () => {
  const f = await fixture(),
    originalFetch = globalThis.fetch;
  try {
    const r = await f.make();
    const uploaded = (
      await f.request(`/requests/${r.id}/documents`, {
        method: 'POST',
        body: { text: 'Aggregate pilot results are public.' },
      })
    ).data;
    const d = uploaded.documents[0];
    await f.request(`/requests/${r.id}/documents/${d.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    assert.equal((await f.request(`/requests/${r.id}`)).data.readiness.ready, true);
    process.env.GEMINI_API_KEY = 'test-key';
    globalThis.fetch = (url, options) =>
      String(url).startsWith('https://generativelanguage.googleapis.com/')
        ? Promise.resolve(new Response('{}', { status: 503 }))
        : originalFetch(url, options);
    assert.equal(
      (await f.request(`/requests/${r.id}/integrity`, { method: 'POST', body: {} })).status,
      500,
    );
    const updated = (await f.request(`/requests/${r.id}`)).data;
    assert.equal(updated.readiness.ready, false);
    assert.equal(updated.documents[0].integrity, null);
    assert.equal(
      (await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} })).status,
      409,
    );
  } finally {
    delete process.env.GEMINI_API_KEY;
    globalThis.fetch = originalFetch;
    await f.close();
  }
});

test('a wrongly uploaded document can be removed, and a request can be deleted, with a rationale', async () => {
  const f = await fixture();
  try {
    let r = await f.make();
    const wrong = (
      await f.request(`/requests/${r.id}/documents`, {
        method: 'POST',
        body: { text: 'Wrong file entirely.', name: 'wrong.txt' },
      })
    ).data;
    const docId = wrong.documents[0].id;
    assert.equal(wrong.status, 'in_review');
    assert.equal(
      (
        await f.request(`/requests/${r.id}/documents/${docId}`, {
          method: 'DELETE',
          body: {},
        })
      ).status,
      400,
    );
    const removed = await f.request(`/requests/${r.id}/documents/${docId}`, {
      method: 'DELETE',
      body: { note: 'Wrong file uploaded in error.' },
    });
    assert.equal(removed.status, 200);
    assert.equal(removed.data.documents.length, 0);
    assert.equal(removed.data.status, 'received');
    const audit = await f.request('/audit');
    assert.ok(audit.data.events.some((e) => e.action === 'Document removed'));
    const role = await f.request('/session/role', { method: 'POST', body: { role: 'requester' } }),
      cookie = role.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (
        await f.request(`/requests/${r.id}`, {
          cookie,
          method: 'DELETE',
          body: { note: 'Not an officer.' },
        })
      ).status,
      403,
    );
    assert.equal(
      (await f.request(`/requests/${r.id}`, { method: 'DELETE', body: {} })).status,
      400,
    );
    const deleted = await f.request(`/requests/${r.id}`, {
      method: 'DELETE',
      body: { note: 'Created by mistake.' },
    });
    assert.equal(deleted.status, 200);
    assert.equal((await f.request(`/requests/${r.id}`)).status, 404);

    r = await f.make();
    const doc = (
      await f.request(`/requests/${r.id}/documents`, {
        method: 'POST',
        body: { text: 'Public information.\nEmployee name: Secret Person', name: 'record.txt' },
      })
    ).data.documents[0];
    for (const s of doc.spans)
      await f.request(`/requests/${r.id}/documents/${doc.id}/spans/${s.id}`, {
        method: 'PATCH',
        body: { decision: 'approved' },
      });
    await f.request(`/requests/${r.id}/documents/${doc.id}/attestation`, {
      method: 'PATCH',
      body: { attested: true },
    });
    await f.request(`/requests/${r.id}/release`, { method: 'POST', body: {} });
    assert.equal(
      (
        await f.request(`/requests/${r.id}`, {
          method: 'DELETE',
          body: { note: 'Attempt on a released request.' },
        })
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});
