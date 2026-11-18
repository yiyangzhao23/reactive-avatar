import { test, expect } from '@playwright/test';

const LIVE = Boolean(process.env.BASE_URL);

test.describe('@live deployed smoke', () => {
  test.skip(!LIVE, 'set BASE_URL (e.g. https://reactive-avatar.pages.dev) to run');

  test('loads the deployed site, model, and proxy guard', async ({ page, request }) => {
    test.setTimeout(240000);
    const loaded = [];
    const errors = [];
    const badResponses = [];

    page.on('console', (m) => {
      if (m.text().includes('已加载 model.vrm')) loaded.push(true);
      if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      const path = new URL(r.url()).pathname;
      if (r.status() >= 400 && path !== '/favicon.ico') badResponses.push(`${r.status()} ${path}`);
    });

    await page.goto('/');
    await expect(page.locator('#scene')).toBeVisible();
    await expect.poll(() => loaded.length, { timeout: 180000 }).toBeGreaterThan(0);

    expect(badResponses).toEqual([]);
    expect(errors).toEqual([]);

    const res = await request.post('/llm', {
      headers: { Authorization: 'Bearer test' },
      data: { model: 'gemini-3.5-flash-lite', messages: [{ role: 'user', content: 'hi' }] },
    });
    expect(res.status()).toBe(401);
  });
});
