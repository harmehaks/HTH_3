import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
test('dashboard, all navigation, search, theme and responsive layout work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A clearer path to disclosure.' })).toBeVisible();
  await expect(page.getByText('More transparency.')).toBeVisible();
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true });
  for (const [label, heading] of [
    ['Requests', 'One queue. A clearer view.'],
    ['Integrity lab', 'Confidence is a team effort.'],
    ['Release library', 'Better decisions start with context.'],
    ['Activity log', 'A record you can follow.'],
    ['Settings & integrations', 'Thoughtfully connected.'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search workspace' }).fill('Border');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Border services modernization', exact: false }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'artifacts/dashboard-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Redaction workspace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Original', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/review-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('document review views, manual selection and legal explanation are usable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue your review' }).click();
  await expect(
    page.getByRole('heading', { name: 'Border services modernization', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Suggestion confidence')).toBeVisible();
  await page.screenshot({ path: 'artifacts/review-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Redacted', exact: true }).click();
  await expect(page.locator('.document-text')).not.toContainText('alex.morgan@example.net');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.getByText('ORIGINAL RECORD', { exact: true })).toBeVisible();
  await expect(page.getByText('CANDIDATE RELEASE', { exact: true }).first()).toBeVisible();
  await page
    .getByRole('button', { name: 'Integrity', exact: false })
    .filter({ hasText: 'Integrity' })
    .last()
    .click();
  await expect(page.getByText('Contextual leak risk')).toBeVisible();
});
test('a new record can be analyzed, reviewed, safely exported and released to requester', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New request' }).first().click();
  await page
    .getByRole('textbox', { name: 'Request title' })
    .fill('End-to-end release verification');
  await page
    .getByRole('textbox', { name: 'Records requested' })
    .fill('Public pilot results and contact details.');
  await page.getByRole('button', { name: 'Create request', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bring a record into focus' })).toBeVisible();
  await page.getByRole('button', { name: 'Paste document text', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Document text' })
    .fill(
      'PILOT RESULTS\n\nThe pilot reduced processing time by 18%.\nEmployee name: Private Person\nPersonal contact: private.person@example.net',
    );
  await page.getByRole('button', { name: 'Analyze document', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Suggestion 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Approve withholding', exact: true }).click();
  await page.getByRole('button', { name: 'Next suggestion' }).click();
  await page.getByRole('button', { name: 'Approve withholding', exact: true }).click();
  await page.getByRole('checkbox', { name: 'I have reviewed the entire record' }).check();
  await expect(page.getByRole('button', { name: 'Approve release', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Approve release', exact: true }).click();
  await page.getByRole('button', { name: 'Approve & release', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download release', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Sarah Mitchell/ }).click();
  await page.getByRole('button', { name: 'Requester portal', exact: false }).click();
  await expect(
    page.getByRole('heading', { name: 'Information, a little more accessible.' }),
  ).toBeVisible();
  const card = page
    .locator('.portal-request')
    .filter({ hasText: 'End-to-end release verification' });
  await card.getByRole('button', { name: 'View release' }).click();
  await expect(page.locator('.released-records')).toContainText('18%');
  await expect(page.locator('.released-records')).not.toContainText('Private Person');
  await expect(page.locator('.released-records')).not.toContainText('private.person@example.net');
  await page.screenshot({ path: 'artifacts/requester-release.png', fullPage: true });
});
test('requester permissions and request submission are enforced', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Sarah Mitchell/ }).click();
  await page.getByRole('button', { name: 'Requester portal', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Integrity lab', exact: true })).toHaveCount(0);
  const response = await page.request.get('/api/audit');
  expect(response.status()).toBe(403);
  await page.getByRole('button', { name: 'Make a request', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Request title' })
    .fill('Requester submitted record request');
  await page
    .getByRole('textbox', { name: 'Records requested' })
    .fill('Please provide the public program progress update.');
  await page.getByRole('button', { name: 'Create request', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Requester submitted record request' }),
  ).toBeVisible();
});
test('published reference comparison, manual redaction and officer export choices work', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue your review' }).click();
  await page.getByRole('button', { name: 'Attach reference', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Public source URL' })
    .fill('https://example.gov/published-release');
  await page
    .getByRole('textbox', { name: 'Published record text' })
    .fill('PUBLIC RELEASE\nAggregate results remain public.\nEmployee name: [REDACTED]');
  await page.getByRole('button', { name: 'Attach comparison' }).click();
  await expect(page.locator('.published-comparison')).toBeVisible();
  await expect(page.locator('.published-comparison')).toContainText(
    'Aggregate results remain public.',
  );
  await page.screenshot({ path: 'artifacts/published-comparison.png', fullPage: true });
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await page.getByRole('button', { name: 'Manual redaction', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Exact text to withhold' })
    .fill(
      'The only officer leading the Northern Region pilot received the 2025 Northstar service award and can be identified in the contact directory.',
    );
  await page
    .getByRole('textbox', { name: 'Justification', exact: true })
    .fill('Identifying context assessed under s.19(1); review public availability and consent.');
  await page.getByRole('button', { name: 'Add redaction', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redacted', exact: true }).click();
  await expect(page.locator('.document-text')).not.toContainText('Northstar service award');
  await page
    .locator('.review-tabs')
    .getByRole('button', { name: /Integrity/ })
    .click();
  await expect(page.locator('.integrity-content')).not.toContainText('Needs a fresh check');
  await expect(page.locator('.finding-card')).not.toContainText('Contextual leak');
  await page.getByRole('button', { name: 'Export draft', exact: true }).click();
  await expect(page.getByRole('link', { name: /Redacted PDF/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Redacted text/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Officer decision log/ })).toBeVisible();
});
test('public starter library, briefing transcript and presentation deck are available', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Release library', exact: true }).click();
  await page.getByRole('button', { name: /Public sources/ }).click();
  await expect(page.locator('.corpus-card')).toHaveCount(16);
  await page.locator('.corpus-card').first().click();
  await expect(page.getByRole('link', { name: 'View public source' })).toHaveAttribute(
    'href',
    /international.canada.ca/,
  );
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: /Listen to briefing/ }).click();
  await expect(page.getByRole('dialog', { name: 'Your workspace briefing' })).toContainText(
    'suggested redactions need officer review',
  );
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/pitch.html');
  await expect(page.locator('.slide.active h1')).toContainText('Access to information.');
  await page.screenshot({ path: 'artifacts/pitch-cover.png', fullPage: true });
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#counter')).toHaveText('02 / 08');
  await page.keyboard.press('End');
  await expect(page.locator('#counter')).toHaveText('08 / 08');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
