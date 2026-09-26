import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBriefing } from '../server/briefing.js';
test('briefing names priority requests and unresolved references without sending source content', () => {
  const record = (id, extras = {}) => ({
    id,
    status: 'in_review',
    dueAt: '2099-01-01',
    documents: [],
    ...extras,
  });
  const transcript = buildBriefing([
    record('A-3'),
    record('A-2', { dueAt: '2000-01-01' }),
    record('A-1', {
      synthetic: true,
      title: 'PRIVATE TITLE',
      documents: [
        {
          text: 'SECRET SOURCE',
          spans: [{ decision: 'pending' }],
          integrity: {
            leaks: [{ resolved: false, clue: 'SECRET CLUE' }],
            conflicts: [{ resolved: false, requestRef: 'A-2024-004', excerpt: 'PRIVATE EXCERPT' }],
          },
        },
      ],
    }),
    record('A-4', { status: 'released' }),
  ]);
  assert.match(transcript, /Request A-2/);
  assert.match(transcript, /Demo request A-1/);
  assert.match(transcript, /reference A-2024-004/);
  assert.doesNotMatch(transcript, /A-3:|A-4|PRIVATE|SECRET/);
  assert.match(buildBriefing([]), /queue is clear/);
});
