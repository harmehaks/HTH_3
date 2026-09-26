import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { localClassify } from '../server/engine.js';

const fixtures = JSON.parse(readFileSync('samples/span-benchmark.json', 'utf8'));
let expectedCharacters = 0,
  predictedCharacters = 0,
  matchedCharacters = 0;
const results = fixtures.map((f) => {
  const expected = new Set();
  for (const quote of f.sensitive) {
    const start = f.text.indexOf(quote);
    if (start < 0) throw new Error(`Unmatched benchmark label: ${f.id}`);
    for (let i = start; i < start + quote.length; i++) expected.add(i);
  }
  const predicted = new Set();
  for (const span of localClassify(f.text))
    for (let i = span.start; i < span.end; i++) predicted.add(i);
  const matched = [...expected].filter((i) => predicted.has(i)).length;
  expectedCharacters += expected.size;
  predictedCharacters += predicted.size;
  matchedCharacters += matched;
  return {
    id: f.id,
    expectedCharacters: expected.size,
    detectedCharacters: matched,
    missedCharacters: expected.size - matched,
    extraCharacters: predicted.size - matched,
  };
});
const report = {
  engine: 'Local pattern rules',
  scope:
    'Small synthetic engineering benchmark with deliberately difficult cases. Labels express fixture intent, not legal determinations. Not independent validation and not a Gemini evaluation.',
  recall: expectedCharacters ? matchedCharacters / expectedCharacters : null,
  precision: predictedCharacters ? matchedCharacters / predictedCharacters : null,
  results,
};
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/span-benchmark.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
