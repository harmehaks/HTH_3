import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('demo sign-in, keyboard focus, sign-out and requester access work without hidden controls', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Sign in', exact: true });
  await expect(trigger).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Sign in' })).toHaveCount(0);
  await trigger.focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.signin-panel'))).toBe(false);
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('textbox', { name: 'Email address' })).toBeFocused();
  const first = dialog.getByRole('button', { name: 'Close sign-in panel' });
  const last = dialog.getByRole('button', { name: 'Enter as officer' });
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await last.click();
  await expect(page.getByRole('button', { name: 'Listen to briefing' })).toBeVisible();
  await page.getByRole('button', { name: 'Open profile menu' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole('button', { name: /Requester/ }).click();
  await page
    .getByRole('textbox', { name: 'Email address' })
    .fill('fictional.requester@example.test');
  await page.getByRole('button', { name: 'Enter as requester' }).click();
  await expect(
    page.getByRole('heading', { name: 'Information, a little more accessible.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Integrity lab', exact: true })).toHaveCount(0);
});

test('a fresh authenticated Auth0 session opens the workspace after provider return', async ({
  page,
}) => {
  let authenticated = false;
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: {
        user: authenticated
          ? { id: 'auth0|fictional-officer', name: 'Test Officer', role: 'officer' }
          : null,
        demo: false,
        authEnabled: true,
      },
    }),
  );
  await page.route('**/api/requests', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/categories', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/audit', (route) => route.fulfill({ json: { events: [] } }));
  await page.route('**/login*', async (route) => {
    authenticated = true;
    await route.fulfill({ status: 302, headers: { location: '/' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: /ATIP officer/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Requester/ })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Email address' }).fill('fictional.officer@example.test');
  await page.getByRole('button', { name: 'Continue securely' }).click();
  await expect(page.getByRole('heading', { name: 'A clearer path to disclosure.' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('mr-redactor-entered'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A clearer path to disclosure.' })).toBeVisible();
});

test('landing and sign-in panel fit narrow screens and retain visible controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter as officer' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'artifacts/sign-in-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Close sign-in panel' }).click();
  await page.screenshot({ path: 'artifacts/sign-in-landing-mobile.png', fullPage: true });
});
