import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.js';
import { seed } from '../server/seed.js';
import { atiCorpus } from '../server/public-corpus.js';
delete process.env.GEMINI_API_KEY;
test('existing demo workspaces receive a sourced comparison without overwriting officer decisions', async () => {
  const store = await createStore({ url: '', path: ':memory:' });
  try {
    await store.put('request', { id: 'existing', documents: [] });
    await seed(store);
    const r = await store.get('DEMO-ATI-00675');
    const d = r.documents[0];
    const source = atiCorpus.find((c) => c.requestRef === 'A-2026-00675');
    assert.equal(d.text, source.text);
    assert.equal(d.reference.text, source.text);
    assert.equal(d.reference.sourcePage, 3);
    assert.ok(d.spans.length > 0);
    assert.ok(
      d.integrity.conflicts.some((f) => f.requestRef === source.requestRef && !f.synthetic),
    );
    d.spans[0].decision = 'dismissed';
    await store.put('request', r);
    await seed(store);
    assert.equal((await store.get(r.id)).documents[0].spans[0].decision, 'dismissed');
    assert.equal((await store.all('request')).length, 2);
  } finally {
    await store.close();
  }
});
