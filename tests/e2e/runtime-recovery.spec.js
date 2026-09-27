import { test, expect } from '@playwright/test';

test('an unavailable backend explains recovery and retry opens sign-in after it returns', async ({ page }) => {
  let available = false;
  await page.route('**/api/session', route => route.fulfill(available ? {
    json: { user: null, demo: true, authEnabled: false },
  } : { status: 502, contentType: 'text/plain', body: 'ECONNREFUSED' }));
  await page.goto('/');
  await expect(page.getByText('The API server is unavailable. Check the terminal startup message, then retry after the server starts.')).toBeVisible();
  available = true;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
