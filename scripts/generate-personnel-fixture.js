import { readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { localClassify, renderRedacted, leakTester } from '../server/engine.js';

// This generator always validates the offline fixture, regardless of live account settings.
delete process.env.GEMINI_API_KEY;
const stem = 'samples/air-canada-personnel';
const text = readFileSync(`${stem}-fictional.txt`, 'utf8');
const pdf = new PDFDocument({
  size: 'A4',
  margin: 48,
  info: {
    Title: 'FICTIONAL TRAINING - Air Canada personnel scenario',
    Author: 'Redactor demo',
    Subject: 'Synthetic personnel privacy fixture; no real employees',
  },
});
const output = createWriteStream(`${stem}-fictional.pdf`);
const finished = once(output, 'finish');
pdf.pipe(output);
for (const line of text.split('\n')) {
  if (!line.trim()) {
    pdf.moveDown(0.35);
    continue;
  }
  const heading = /^\d+\. |^FICTIONAL TRAINING DOCUMENT|^AIR CANADA SCENARIO:/.test(line);
  pdf
    .font(heading ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(heading ? 12 : 10)
    .fillColor(heading ? '#215643' : '#263c34')
    .text(line, { lineGap: 3 });
}
pdf.end();
await finished;

const loadingTask = getDocument({
  data: new Uint8Array(readFileSync(`${stem}-fictional.pdf`)),
  isEvalSupported: false,
  useSystemFonts: true,
  standardFontDataUrl: resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
});
let pages;
let pdfText = '';
try {
  const loaded = await loadingTask.promise;
  pages = loaded.numPages;
  for (let p = 1; p <= pages; p++) {
    const content = await (await loaded.getPage(p)).getTextContent();
    for (const item of content.items)
      if ('str' in item) pdfText += item.str + (item.hasEOL ? '\n' : ' ');
    pdfText += '\n\n';
  }
  for (const value of [
    'Avery Testperson',
    'avery.testperson@example.invalid',
    'TEST-BANK-ACCOUNT-0001',
    '1993-04-16',
    '94%',
    'FICTIONAL TRAINING DOCUMENT',
  ])
    if (!pdfText.includes(value))
      throw new Error(`Generated PDF extraction lost a fixture value: ${value}`);
} finally {
  await loadingTask.destroy();
}

const spans = localClassify(text);
const candidate = renderRedacted(text, spans);
const leaks = await leakTester(candidate);
const pdfSpans = localClassify(pdfText);
const pdfCandidate = renderRedacted(pdfText, pdfSpans);
const pdfLeaks = await leakTester(pdfCandidate);
if (
  pdfCandidate.includes('avery.testperson@example.invalid') ||
  pdfCandidate.includes('Avery Testperson')
)
  throw new Error('PDF identity redaction failed.');
if (!pdfLeaks.some((f) => f.clue.includes('Aurora access pilot')))
  throw new Error('PDF mosaic clue was not flagged.');
const counts = Object.fromEntries(
  [...new Set(spans.map((s) => s.category))].map((category) => [
    category,
    spans.filter((s) => s.category === category).length,
  ]),
);
if (!leaks.some((f) => f.clue.includes('Aurora access pilot')))
  throw new Error('Expected mosaic clue was not flagged.');
const clue =
  "The only employee assigned to the fictional Aurora access pilot at the mock Toronto station received the 2026 Lantern training award and can be identified in the scenario's staff directory.";
const start = text.indexOf(clue);
const mitigated = renderRedacted(text, [
  ...spans,
  { start, end: start + clue.length, category: 'personal', confidence: 1, decision: 'approved' },
]);
if ((await leakTester(mitigated)).some((f) => f.clue.includes('Aurora access pilot')))
  throw new Error('Withheld mosaic clue remained visible.');
if (
  candidate.includes('avery.testperson@example.invalid') ||
  candidate.includes('Avery Testperson')
)
  throw new Error('Baseline identity redaction failed.');
if (!candidate.includes('1993-04-16') || !candidate.includes('TEST-BANK-ACCOUNT-0001'))
  throw new Error('Expected manual-review fields changed.');
const report = {
  fixture: 'Entirely fictional Air Canada personnel training scenario',
  source: `${stem}-fictional.txt`,
  pdf: `${stem}-fictional.pdf`,
  pdfPages: pages,
  characters: text.length,
  localSuggestions: spans.length,
  categories: counts,
  pdfLocalSuggestions: pdfSpans.length,
  pdfContextualFindings: pdfLeaks.length,
  lowConfidenceSuggestions: spans.filter((s) => s.confidence < 0.85).length,
  contextualFindings: leaks.length,
  pdfExtractionChecked: true,
  baselineIdentityRemoved: true,
  manualReviewRequired: true,
  mosaicClueMitigationChecked: true,
  note: 'Fixture checks only; not real-world accuracy or a legal assessment.',
};
writeFileSync(`${stem}-local-check.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
