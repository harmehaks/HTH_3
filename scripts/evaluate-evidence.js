import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { classify, localClassify, leakTester, embed, renderRedacted } from '../server/engine.js';
import { atiCorpus } from '../server/public-corpus.js';

const engine = process.argv.find((arg) => arg.startsWith('--engine='))?.split('=')[1] || 'local';
if (!['local', 'gemini'].includes(engine))
  throw new Error('Choose --engine=local or --engine=gemini.');
const path = `artifacts/evidence-evaluation-${engine}.json`;
mkdirSync('artifacts', { recursive: true });
const report = {
  at: new Date().toISOString(),
  engine,
  model:
    engine === 'gemini' ? process.env.GEMINI_MODEL || 'gemini-2.5-flash' : 'local-pattern-rules',
  status: 'running',
  scope:
    'Eight real ATI released excerpts test unnecessary redaction of visible published text. Six synthetic fixtures separately test sensitive-character coverage. These are small engineering checks, not legal accuracy or independent validation. Released PDFs cannot provide gold labels for their hidden text. The public excerpts also appear in the reference library; classification does not retrieve that library.',
  publicReleased: [],
  synthetic: [],
  errors: [],
};
const save = () => writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
if (engine === 'gemini' && !process.env.GEMINI_API_KEY?.trim()) {
  report.status = 'blocked';
  report.errors.push({
    stage: 'configuration',
    message: 'GEMINI_API_KEY is missing. No live requests were made; no fallback was evaluated.',
  });
  save();
  console.error(`${report.errors[0].message}\nReport: ${path}`);
  process.exitCode = 2;
} else {
  if (engine === 'local') delete process.env.GEMINI_API_KEY;
  let lastCall = 0,
    providerUnavailable = false;
  const interval = Math.max(0, Number(process.env.GEMINI_EVAL_INTERVAL_MS) || 15000);
  const pace = async () => {
    if (engine !== 'gemini') return;
    const wait = Math.max(0, interval - (Date.now() - lastCall));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCall = Date.now();
  };
  const liveCall = async (call) => {
    await pace();
    try {
      return await call();
    } catch (error) {
      if ([400, 401, 403, 404].includes(error.providerStatus)) {
        providerUnavailable = true;
        console.log('Gemini rejected the model or configuration; stopping remaining calls.');
        throw error;
      }
      if (!error.message.includes('(429)')) throw error;
      if (error.dailyQuotaExhausted) {
        providerUnavailable = true;
        console.log('Gemini daily quota exhausted; stopping without retry or fallback.');
        throw error;
      }
      console.log('Gemini rate limit reached; waiting 60 seconds before one retry.');
      await new Promise((resolve) => setTimeout(resolve, 60000));
      await pace();
      try {
        return await call();
      } catch (retryError) {
        if (retryError.message.includes('(429)')) providerUnavailable = true;
        throw retryError;
      }
    }
  };
  const predict = async (text) =>
    engine === 'local' ? localClassify(text) : (await liveCall(() => classify(text))).spans;
  for (const c of atiCorpus) {
    if (providerUnavailable) break;
    console.log(`Evaluating released excerpt ${c.requestRef}…`);
    const started = Date.now();
    try {
      const spans = await predict(c.text);
      const flaggedCharacters = spans.reduce((n, s) => n + s.end - s.start, 0);
      report.publicReleased.push({
        id: c.id,
        requestRef: c.requestRef,
        source: c.sourceUrl,
        pdfPage: c.sourcePage,
        label: 'visible in actual released package',
        expectedAdditionalRedactionCharacters: 0,
        totalCharacters: c.text.length,
        flaggedCharacters,
        suggestions: spans.length,
        matchedObservedTreatment: spans.length === 0,
        latencyMs: Date.now() - started,
      });
    } catch (e) {
      report.errors.push({ id: c.id, stage: 'public-classification', message: e.message });
    }
    save();
  }
  const fixtures = JSON.parse(
    readFileSync(new URL('../samples/span-benchmark.json', import.meta.url), 'utf8'),
  );
  let expected = 0,
    predicted = 0,
    matched = 0;
  for (const f of fixtures) {
    if (providerUnavailable) break;
    console.log(`Evaluating synthetic fixture ${f.id}…`);
    try {
      const gold = new Set(),
        found = new Set();
      for (const quote of f.sensitive) {
        const start = f.text.indexOf(quote);
        if (start < 0) throw new Error(`Invalid fixture label: ${f.id}`);
        for (let i = start; i < start + quote.length; i++) gold.add(i);
      }
      for (const span of await predict(f.text))
        for (let i = span.start; i < span.end; i++) found.add(i);
      const hits = [...gold].filter((i) => found.has(i)).length;
      expected += gold.size;
      predicted += found.size;
      matched += hits;
      report.synthetic.push({
        id: f.id,
        expectedCharacters: gold.size,
        detectedCharacters: hits,
        missedCharacters: gold.size - hits,
        extraCharacters: found.size - hits,
      });
    } catch (e) {
      report.errors.push({ id: f.id, stage: 'synthetic-classification', message: e.message });
    }
    save();
  }
  report.syntheticMetrics = {
    recall: expected ? matched / expected : null,
    precision: predicted ? matched / predicted : null,
  };
  const publicCharacters = report.publicReleased.reduce((n, r) => n + r.totalCharacters, 0);
  report.publicMetrics = {
    evaluated: report.publicReleased.length,
    expected: atiCorpus.length,
    excerptsWithExtraSuggestions: report.publicReleased.filter((r) => r.suggestions > 0).length,
    extraRedactionCharacterRate: publicCharacters
      ? report.publicReleased.reduce((n, r) => n + r.flaggedCharacters, 0) / publicCharacters
      : null,
    sensitiveSpanRecall: null,
  };
  if (engine === 'gemini' && !providerUnavailable) {
    try {
      const text =
        'Personal contact: alex@example.net\nThe only officer leading the Northern Region pilot can be identified in the contact directory.';
      const spans = await predict(text);
      const candidate = renderRedacted(text, spans);
      const findings = await liveCall(() => leakTester(candidate));
      const embedding = await liveCall(() => embed('Published project status update.'));
      report.livePipeline = {
        classification: true,
        emailWithheld: !candidate.includes('alex@example.net'),
        leakTester: true,
        leakFindings: findings.length,
        embeddingModel: embedding.model,
        dimensions: embedding.values.length,
      };
      if (candidate.includes('alex@example.net') || embedding.values.length !== 768)
        throw new Error(
          'Live pipeline quality check failed: inspect email withholding or embedding dimensions.',
        );
    } catch (e) {
      report.errors.push({ stage: 'live-pipeline', message: e.message });
    }
  }
  report.status = report.errors.length ? 'failed' : 'completed';
  save();
  console.log(
    JSON.stringify(
      {
        status: report.status,
        engine,
        publicMetrics: report.publicMetrics,
        syntheticMetrics: report.syntheticMetrics,
        scope: report.scope,
        report: path,
      },
      null,
      2,
    ),
  );
  if (report.errors.length) process.exitCode = 1;
}
