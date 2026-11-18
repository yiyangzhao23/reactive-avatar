import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL;
const LOCAL_URL = 'http://127.0.0.1:8017';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL || LOCAL_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  ...(BASE_URL
    ? {}
    : {
        webServer: {
          command: 'python3 server.py',
          cwd: './avatar-live',
          url: LOCAL_URL,
          reuseExistingServer: true,
          timeout: 120000,
        },
      }),
});
