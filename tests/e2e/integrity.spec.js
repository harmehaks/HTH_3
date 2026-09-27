import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  // Refuse to exercise mutations against the real app or any cloud-backed store.
  expect(baseURL).toBe('http://127.0.0.1:5174');
  const settings = await (await page.request.get('/api/settings')).json();
  expect(settings.storage).toBe('SQLite');
  expect(settings.classification).not.toBe('Gemini');
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Enter as officer', exact: true }).click();
  await page.getByRole('button', { name: 'Integrity lab', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confidence is a team effort.' })).toBeVisible();
});

test('Integrity filters, documented resolution, persistence and reruns follow the current findings', async ({
  page,
}) => {
  const summaries = await (await page.request.get('/api/requests')).json();
  const records = await Promise.all(
    summaries
      .filter((r) => r.status !== 'released')
      .map(async (r) => (await page.request.get('/api/requests/' + r.id)).json()),
  );
  const findings = records.flatMap((r) =>
    r.documents.flatMap((d) => [...(d.integrity?.leaks || []), ...(d.integrity?.conflicts || [])]),
  );
  const open = findings.filter((f) => !f.resolved),
    leaks = open.filter((f) => f.clue),
    conflicts = open.filter((f) => !f.clue);
  expect(leaks.length).toBeGreaterThan(0);
  expect(conflicts.length).toBeGreaterThan(0);
  for (const [label, count] of [
    ['All open findings', open.length],
    ['Contextual leaks', leaks.length],
    ['Consistency conflicts', conflicts.length],
    ['Resolved', findings.filter((f) => f.resolved).length],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.lab-finding')).toHaveCount(count);
  }
  const target = records.find((r) =>
    r.documents.some((d) => d.integrity?.leaks.some((f) => !f.resolved)),
  );
  const doc = target.documents.find((d) => d.integrity?.leaks.some((f) => !f.resolved));
  const leak = doc.integrity.leaks.find((f) => !f.resolved);
  await page.getByRole('button', { name: 'Contextual leaks', exact: true }).click();
  await page
    .locator('.lab-finding')
    .filter({ hasText: leak.clue })
    .getByRole('button', { name: 'Review finding', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Resolve finding', exact: true })).toBeDisabled();
  const note =
    'Isolated test: officer reviewed the synthetic context and documented the remaining risk.';
  await page.getByRole('textbox', { name: 'Officer rationale' }).fill(note);
  await page.getByRole('button', { name: 'Resolve finding', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.lab-finding')).toHaveCount(leaks.length - 1);
  await page.getByRole('button', { name: 'Resolved', exact: true }).click();
  await expect(page.locator('.lab-finding').filter({ hasText: note })).toHaveCount(1);
  const saved = await (await page.request.get('/api/requests/' + target.id)).json();
  const savedDoc = saved.documents.find((d) => d.id === doc.id);
  expect(savedDoc.integrity.leaks.find((f) => f.id === leak.id)).toMatchObject({
    resolved: true,
    note,
    reviewedBy: 'Sarah Mitchell',
  });
  expect(savedDoc.attested).toBe(false);
  expect(savedDoc.text).toBe(doc.text);
  expect(savedDoc.spans).toEqual(doc.spans);
  await page.reload();
  await page.getByRole('button', { name: 'Integrity lab', exact: true }).click();
  await page.getByRole('button', { name: 'Resolved', exact: true }).click();
  await expect(page.locator('.lab-finding').filter({ hasText: note })).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Request to test' }).selectOption(target.id);
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await expect(
    page.getByText('Independent checks completed on the current candidate release.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.lab-finding').filter({ hasText: note })).toHaveCount(0);
  await page.getByRole('button', { name: 'Contextual leaks', exact: true }).click();
  await expect(page.locator('.lab-finding').filter({ hasText: leak.clue })).toHaveCount(1);
  await page.getByRole('button', { name: 'Consistency conflicts', exact: true }).click();
  const conflictDoc = records.find((r) =>
    r.documents.some((d) => d.integrity?.conflicts.some((f) => !f.resolved)),
  );
  const conflict = conflictDoc.documents
    .flatMap((d) => d.integrity?.conflicts || [])
    .find((f) => !f.resolved);
  await page
    .locator('.lab-finding')
    .filter({ hasText: conflictDoc.title })
    .filter({ hasText: conflict.inference })
    .getByRole('button', { name: 'Review finding', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Officer rationale' })
    .fill(
      'Isolated test: the earlier release has different context; the officer reviewed the reference.',
    );
  await page.getByRole('button', { name: 'Resolve finding', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Resolved', exact: true }).click();
  await expect(
    page.locator('.lab-finding').filter({ hasText: 'earlier release has different context' }),
  ).toHaveCount(1);
});

test('failed reruns refresh invalidated findings and show that fresh checks are required', async ({
  page,
}) => {
  const summaries = await (await page.request.get('/api/requests')).json();
  const targetSummary = summaries.find((r) => r.id === 'A-2026-00841');
  const target = await (await page.request.get('/api/requests/' + targetSummary.id)).json();
  let failed = false,
    refreshed = false;
  // Simulate the API's tested failure contract without editing the shared test record.
  await page.route('**/api/requests/' + target.id, async (route) => {
    if (!failed) return route.continue();
    refreshed = true;
    await route.fulfill({
      json: {
        ...target,
        documents: target.documents.map((d) => ({
          ...d,
          integrity: null,
          integrityError: 'Integrity check failed. Retry before release.',
          attested: false,
        })),
      },
    });
  });
  await page.route('**/api/requests/' + target.id + '/integrity', async (route) => {
    failed = true;
    await route.fulfill({ status: 502, json: { error: 'Simulated integrity provider failure.' } });
  });
  await page.getByRole('combobox', { name: 'Request to test' }).selectOption(target.id);
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await expect(
    page.getByText('Simulated integrity provider failure.', { exact: true }),
  ).toBeVisible();
  await expect.poll(() => refreshed).toBe(true);
  await expect(page.locator('.lab-finding').filter({ hasText: target.title })).toHaveCount(0);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Fresh integrity checks required' }),
  ).toBeVisible();
});
