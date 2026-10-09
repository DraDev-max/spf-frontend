import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { By, assert, cleanupDriver, createDriver, loginAsAdmin, pause } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const evidencePath = resolve(__dirname, 'evidence', 'ticket-002-valid-login.png');

async function saveScreenshot(driver, path) {
  const png = await driver.takeScreenshot();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(png, 'base64'));
}

async function run() {
  const driver = await createDriver();

  try {
    await loginAsAdmin(driver);
    assert(await driver.findElement(By.css('nav, header, main, .dashboard')), 'Authenticated layout not found');

    const url = await driver.getCurrentUrl();
    assert(url.includes('/menu'), `Expected redirect to /menu, got: ${url}`);

    await saveScreenshot(driver, evidencePath);
    console.log(`Ticket-02: valid login completed, screenshot saved to ${evidencePath}`);
    await pause(50000);
  } finally {
    await cleanupDriver(driver);
  }
}

run().catch((error) => {
  console.error('Ticket-02 failed:', error);
  process.exitCode = 1;
});