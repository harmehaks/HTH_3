import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { localClassify } from '../server/engine.js';
import { publicCorpus } from '../server/public-corpus.js';
const cases = [
  ...JSON.parse(readFileSync('samples/labeled.json', 'utf8')),
  ...publicCorpus.map((c) => ({
    id: c.id,
    text: c.text,
    expected: [],
    synthetic: false,
    source: c.sourceUrl,
  })),
];
let tp = 0,
  fp = 0,
  fn = 0;
const results = cases.map((c) => {
  const found = [...new Set(localClassify(c.text).map((s) => s.category))];
  for (const cat of found) c.expected.includes(cat) ? tp++ : fp++;
  for (const cat of c.expected) if (!found.includes(cat)) fn++;
  return {
    id: c.id,
    synthetic: c.synthetic,
    source: c.source,
    expected: c.expected,
    predicted: found,
    pass: JSON.stringify([...found].sort()) === JSON.stringify([...c.expected].sort()),
  };
});
const report = {
  at: new Date().toISOString(),
  engine: 'Local pattern rules',
  scope:
    'Category-level smoke evaluation on 16 synthetic fixtures and 16 short public proactive-publication excerpts. This is not a validated legal benchmark or a span-recall measurement.',
  cases: cases.length,
  passed: results.filter((r) => r.pass).length,
  truePositives: tp,
  falsePositives: fp,
  falseNegatives: fn,
  precision: tp / (tp + fp || 1),
  recall: tp / (tp + fn || 1),
  results,
};
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/evaluation.json', JSON.stringify(report, null, 2));
console.log(
  `${report.passed}/${report.cases} smoke fixtures matched their category labels. Precision ${report.precision.toFixed(2)}, recall ${report.recall.toFixed(2)}.\n${report.scope}\nFull report: artifacts/evaluation.json`,
);
if (report.passed !== report.cases) process.exitCode = 1;
