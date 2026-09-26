import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localClassify,
  renderRedacted,
  validateSpans,
  leakTester,
  scoreGuesses,
  localEmbedding,
  consistencyCheck,
  classify,
  geminiJSON,
} from '../server/engine.js';
import { auditHash, verifyAudit } from '../server/audit.js';
import { createStore } from '../server/store.js';
delete process.env.GEMINI_API_KEY;
test('Gemini daily quota failures are distinguishable without exposing provider payloads', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          details: [
            { violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] },
          ],
          message: 'sensitive provider payload',
        },
      }),
      { status: 429 },
    );
  try {
    await assert.rejects(geminiJSON('public fixture', {}), (error) => {
      assert.equal(error.providerStatus, 429);
      assert.equal(error.dailyQuotaExhausted, true);
      assert.doesNotMatch(error.message, /sensitive provider payload/);
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});
const sample =
  'Public pilot progress.\nEmployee name: Alex Morgan\nEmail: alex.morgan@example.net\nWe recommend expanding the internal pilot.\nThe only officer leading the pilot can be identified in the contact directory.';

test('mixed lines retain contextual warnings after another part is redacted', async () => {
  const text =
    'The only officer leading the pilot can be identified in the contact directory; email alex@example.net.';
  const output = renderRedacted(text, localClassify(text));
  assert.ok(output.includes('[REDACTED'));
  const findings = await leakTester(output);
  assert.equal(findings.length, 1);
  assert.ok(findings[0].clue.includes('only officer'));
  assert.equal((await leakTester('[REDACTED · s. 19(1)]')).length, 0);
});

test('Gemini accepts real mixed evidence and rejects fabricated findings instead of reporting a clean pass', async () => {
  const originalFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'contract-test-key';
  const output = 'The only officer is [REDACTED · s. 19(1)] and won the public award.';
  let clue = output;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      findings: [
                        {
                          clue,
                          inference: 'The award may identify the officer.',
                          guess: '',
                          severity: 'high',
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    assert.equal((await leakTester(output)).length, 1);
    clue = 'fabricated evidence';
    await assert.rejects(() => leakTester(output), /unsupported evidence/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test('classification returns valid, non-overlapping spans across relevant categories', () => {
  const spans = localClassify(sample);
  assert.equal(spans.length, 3);
  assert.ok(spans.some((s) => s.category === 'advice' && s.confidence < 0.85));
  assert.deepEqual(validateSpans(sample, spans), spans);
  assert.ok(spans.every((s) => s.decision === 'pending'));
});
test('candidate output physically removes original secret text', () => {
  const output = renderRedacted(sample, localClassify(sample));
  assert.ok(!output.includes('Alex Morgan'));
  assert.ok(!output.includes('alex.morgan@example.net'));
  assert.ok(output.includes('Public pilot progress.'));
  assert.ok(output.includes('[REDACTED · s. 19(1)]'));
});
test('dismissed suggestions disclose only the intended text', () => {
  const spans = localClassify(sample);
  spans.find((s) => sample.slice(s.start, s.end) === 'Alex Morgan').decision = 'dismissed';
  const output = renderRedacted(sample, spans);
  assert.ok(output.includes('Alex Morgan'));
  assert.ok(!output.includes('alex.morgan@example.net'));
});
test('invalid bounds, overlap, category, and confidence are rejected', () => {
  for (const s of [
    { start: -1, end: 3 },
    { start: 3, end: 3 },
    { start: 0, end: 500 },
    { start: 1.2, end: 4 },
    { start: 0, end: 3, category: 'invalid' },
    { start: 0, end: 3, confidence: NaN },
  ])
    assert.throws(() => validateSpans(sample, [{ category: 'personal', confidence: 0.9, ...s }]));
  assert.throws(() =>
    validateSpans(sample, [
      { start: 0, end: 8, category: 'personal', confidence: 0.9 },
      { start: 5, end: 10, category: 'personal', confidence: 0.9 },
    ]),
  );
});
test('local leak tester identifies concrete visible identifying context', async () => {
  const output = renderRedacted(sample, localClassify(sample)),
    findings = await leakTester(output);
  assert.equal(findings.length, 1);
  assert.ok(output.includes(findings[0].clue));
  assert.equal(findings[0].guess, '');
  assert.equal(findings[0].resolved, false);
});
test('reconstruction scoring distinguishes exact, partial, and unverified guesses', () => {
  const findings = ['Alex Morgan', 'Alex', 'Other Person', ''].map((guess) => ({ guess }));
  assert.deepEqual(
    scoreGuesses(findings, sample, localClassify(sample)).map((f) => f.reconstruction),
    ['exact', 'partial', 'unverified', 'untested'],
  );
});
test('word embeddings are normalized, deterministic, and fixed dimensionality', () => {
  const e = localEmbedding('regional pilot services');
  assert.equal(e.length, 768);
  assert.ok(Math.abs(Math.hypot(...e) - 1) < 1e-10);
  assert.deepEqual(e, localEmbedding('regional pilot services'));
});
test('consistency check flags conflicting disclosed text with a precise reference', async () => {
  const store = await createStore({ path: ':memory:', url: '' });
  try {
    const text = 'We recommend a phased rollout.',
      span = localClassify(text)[0],
      corpus = [
        {
          id: 'reference',
          text,
          requestRef: 'A-2025-4521',
          treatment: 'released',
          category: null,
          synthetic: true,
          embedding: localEmbedding(text),
          embeddingModel: 'local-hashed-words-v1',
        },
      ];
    const findings = await consistencyCheck(text, [span], corpus, store);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].requestRef, 'A-2025-4521');
    assert.equal(findings[0].similarity, 1);
  } finally {
    await store.close();
  }
});
test('audit verification survives JSON key reordering and detects tampering or removal', () => {
  const one = { id: '1', sequence: 1, action: 'Created', previousHash: 'genesis' };
  one.hash = auditHash(one);
  const two = { id: '2', sequence: 2, action: 'Reviewed', previousHash: one.hash };
  two.hash = auditHash(two);
  assert.ok(verifyAudit([two, one]));
  assert.ok(verifyAudit([Object.fromEntries(Object.entries(one).reverse()), two]));
  assert.equal(verifyAudit([one, { ...two, action: 'Tampered' }]), false);
  assert.equal(verifyAudit([two]), false);
});
test('Gemini tester receives only candidate output, never original secrets', async () => {
  const oldFetch = globalThis.fetch,
    oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  const redacted = renderRedacted(sample, localClassify(sample));
  try {
    globalThis.fetch = async (url, options) => {
      const input = JSON.parse(options.body).contents[0].parts[0].text;
      assert.ok(input.includes(JSON.stringify(redacted)));
      assert.ok(!input.includes('Alex Morgan'));
      assert.ok(!input.includes('alex.morgan@example.net'));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ findings: [] }) }] } }],
        }),
        { status: 200 },
      );
    };
    assert.deepEqual(await leakTester(redacted), []);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});
test('Gemini classification validates exact quotes rather than accepting invented offsets', async () => {
  const oldFetch = globalThis.fetch,
    oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      spans: [
                        {
                          quote: 'invented content',
                          category: 'personal',
                          confidence: 0.99,
                          justification: 'test',
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    await assert.rejects(() => classify(sample), /could not be matched/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});
