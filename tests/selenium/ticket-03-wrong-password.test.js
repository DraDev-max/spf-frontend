import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { By, assert, cleanupDriver, createDriver, pause } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const evidencePath = resolve(__dirname, 'evidence', 'ticket-003-incorrect-password.png');

async function saveScreenshot(driver, path) {
  const png = await driver.takeScreenshot();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(png, 'base64'));
}

async function run() {
  const driver = await createDriver();

  try {
    await driver.get('http://localhost:4000/login');

    const usuario = await driver.findElement(By.id('usuario'));
    const password = await driver.findElement(By.id('password'));

    await usuario.clear();
    await usuario.sendKeys('admin');
    await password.clear();
    await password.sendKeys('wrong-password');
    await driver.findElement(By.css('button[type="submit"]')).click();

    const url = await driver.getCurrentUrl();
    assert(url.includes('/login'), `Expected to remain on /login, got: ${url}`);

    await driver.wait(async () => {
      try {
        const errorText = await driver.findElement(By.css('.error')).getText();
        return errorText.trim().length > 0;
      } catch {
        return false;
      }
    }, 10000, 'Expected a visible login error message');

    const errorBox = await driver.findElement(By.css('.error'));
    const errorText = (await errorBox.getText()).trim();
    assert(errorText.length > 0, 'Expected a visible login error message');

    await saveScreenshot(driver, evidencePath);
    console.log(`Ticket-03: invalid password rejected, screenshot saved to ${evidencePath}`);
    await pause(30000);
  } finally {
    await cleanupDriver(driver);
  }
}

run().catch((error) => {
  console.error('Ticket-03 failed:', error);
  process.exitCode = 1;
});