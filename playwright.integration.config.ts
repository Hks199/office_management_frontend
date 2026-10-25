import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './integration',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  use: { baseURL: 'http://localhost:5183', trace: 'retain-on-failure' },
  projects: [{ name: 'real-backend', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node tools/integration-server.mjs',
      url: 'http://127.0.0.1:3101/api/v1/health/ready',
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 5183',
      url: 'http://localhost:5183',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3101' },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
