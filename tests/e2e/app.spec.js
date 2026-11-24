import { test, expect } from '@playwright/test';

const LOCAL = !process.env.BASE_URL;
const IGNORED_404 = ['/favicon.ico', '/apple-touch-icon.png'];

function watch(page) {
  const errors = [];
  const badResponses = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
  });
  page.on('response', (r) => {
    const path = new URL(r.url()).pathname;
    if (r.status() >= 400 && !IGNORED_404.includes(path)) badResponses.push(`${r.status()} ${path}`);
  });
  return { errors, badResponses };
}

test('loads the app and the 3D model', async ({ page }) => {
  test.setTimeout(180000);
  const loaded = [];
  page.on('console', (m) => {
    if (m.text().includes('已加载 model.vrm')) loaded.push(true);
  });

  await page.goto('/');
  await expect(page.locator('#scene')).toBeVisible();
  await expect.poll(() => loaded.length, { timeout: 120000 }).toBeGreaterThan(0);

  const box = await page.locator('#scene').boundingBox();
  expect(box.width).toBeGreaterThan(300);
});

test('serves all assets without 404s or page errors', async ({ page }) => {
  test.setTimeout(180000);
  const { errors, badResponses } = watch(page);
  await page.goto('/');
  await expect(page.locator('#scene')).toBeVisible();
  await page.waitForTimeout(5000);
  expect(badResponses).toEqual([]);
  expect(errors).toEqual([]);
});

test('typing chat gets a local fallback reply', async ({ page }) => {
  await page.goto('/');
  await page.locator('#chatInput').fill('你好');
  await page.locator('#chatSend').click();
  await expect(page.locator('#log')).toContainText('你好呀', { timeout: 10000 });
});

test('language switch updates the UI', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#lang', 'en');
  await expect(page.locator('#camBtn')).toHaveText('Start camera');
  await expect(page.locator('#chatInput')).toHaveAttribute('placeholder', 'Type something to me…');
  await page.selectOption('#lang', 'zh');
  await expect(page.locator('#camBtn')).toHaveText('开启摄像头');
});

test('analyze without screen share prompts for it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#analyzeBtn').click();
  await expect(page.locator('#log')).toContainText('共享屏幕');
});

test('camera toggles on and off (fake device)', async ({ page }) => {
  test.skip(!LOCAL, 'camera toggle covered on local dev');
  await page.goto('/');
  await page.locator('#camBtn').click();
  await expect(page.locator('#camBtn')).toHaveText('摄像头已开启');
  await expect(page.locator('#camDot')).toHaveClass(/on/);
  await page.locator('#camBtn').click();
  await expect(page.locator('#camBtn')).toHaveText('开启摄像头');
  await expect(page.locator('#camDot')).not.toHaveClass(/on/);
});

test('model settings save in memory and clear on reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#modelDialog')).toHaveAttribute('open', '');
  await page.selectOption('#modelProvider', 'custom');
  await page.fill('#modelName', 'fake');
  await page.fill('#modelKey', 'secret');
  await page.fill('#modelBase', 'http://127.0.0.1:9999/v1/chat/completions');
  await page.click('#modelSave');
  await expect(page.locator('#modelStatus')).toContainText('custom');

  await page.reload();
  await expect(page.locator('#modelDialog')).toHaveAttribute('open', '');
  await expect(page.locator('#modelStatus')).toContainText('离线');
});

test('first-time quick start explains permissions and can be dismissed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#quickStart')).toBeVisible();
  await expect(page.locator('#quickStart')).toContainText('30 秒开始');
  await expect(page.locator('#quickStart')).toContainText('摄像头');
  await page.click('#quickStartClose');
  await expect(page.locator('#quickStart')).toBeHidden();
  await page.reload();
  await expect(page.locator('#quickStart')).toBeHidden();
});

test('camera in-use state and stop-media control', async ({ page }) => {
  await page.goto('/');
  await page.click('#quickStartClose');
  await page.click('#camBtn');
  await expect(page.locator('#mediaState')).toContainText('摄像头：使用中');
  await page.click('#stopMediaBtn');
  await expect(page.locator('#mediaState')).toContainText('摄像头：关');
});

test('mute shows a muted state and restores idle', async ({ page }) => {
  await page.goto('/');
  await page.click('#quickStartClose');
  await page.click('#muteBtn');
  await expect(page.locator('#voiceState')).toHaveText('已静音');
  await page.click('#muteBtn');
  await expect(page.locator('#voiceState')).toHaveText('待机');
});
