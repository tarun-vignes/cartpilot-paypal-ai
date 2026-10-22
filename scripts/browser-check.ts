import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const executablePath =
  process.env.BROWSER_EXECUTABLE ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);
if (!executablePath)
  throw new Error(
    'Set BROWSER_EXECUTABLE to your installed Chromium, Chrome or Edge executable.',
  );
mkdirSync('artifacts/screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(
    process.env.APP_ORIGIN || 'http://localhost:3000',
  );
  assert.equal(response?.status(), 200);
  await page
    .getByText('Demo recommendation logic is active.', { exact: false })
    .waitFor();
  await page.screenshot({ path: 'artifacts/screenshots/01-welcome.png' });
  await page.getByRole('button', { name: 'Find my fit', exact: false }).click();
  await page
    .getByRole('heading', { name: 'A shortlist with reasons.' })
    .waitFor();
  await page
    .getByRole('button', { name: 'Add to cart · $39.00', exact: false })
    .click();
  await page.getByText('$43.95', { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Continue to PayPal sandbox', exact: false })
      .isDisabled(),
    true,
  );
  await page
    .getByRole('button', { name: 'Increase Everyday wireless keyboard' })
    .click();
  await page.getByText('$78.00', { exact: true }).first().waitFor();
  await page
    .getByRole('button', { name: 'Decrease Everyday wireless keyboard' })
    .click();
  await page.getByText('$43.95', { exact: true }).waitFor();
  await page
    .getByRole('heading', { name: 'A shortlist with reasons.' })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/screenshots/02-shortlist.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('body').evaluate(() => window.scrollTo(0, 0));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    'Mobile layout overflows horizontally',
  );
  await page.screenshot({ path: 'artifacts/screenshots/03-mobile.png' });
  await page
    .getByLabel('Your shopping request', { exact: true })
    .fill('A reusable bottle under $20, fast delivery.');
  await page.getByRole('button', { name: 'Find my fit', exact: false }).click();
  await page
    .getByRole('heading', { name: 'Nothing checks every box.' })
    .waitFor();
  await page.route('**/api/recommend', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'AI unavailable — browser test fixture.' }),
    }),
  );
  await page.getByRole('button', { name: 'Find my fit', exact: false }).click();
  await page.getByRole('alert').filter({ hasText: 'AI unavailable' }).waitFor();
  await page.unroute('**/api/recommend');
  await page
    .getByRole('button', { name: 'Use demo recommendation logic', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Nothing checks every box.' })
    .waitFor();
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(
    'PASS: desktop welcome, demo recommendation, cart totals/quantity, disabled unavailable checkout, mobile overflow check, no-match, API failure and explicit fallback.',
  );
  console.log(`Screenshots: ${resolve('artifacts/screenshots')}`);
} finally {
  await browser.close();
}
