const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');

const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const localLaunchOptions = fs.existsSync(macChrome) ? { executablePath: macChrome } : {};

module.exports = defineConfig({
  testDir: './tests',
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || './test-results',
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: localLaunchOptions,
    trace: process.env.PW_TRACE || 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    port: 4173,
    reuseExistingServer: true
  }
});
