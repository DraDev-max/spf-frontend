import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { By, assert, cleanupDriver, createDriver, loginAsAdmin, pause } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const evidencePath = resolve(__dirname, 'evidence', 'ticket-005-product-form.png');

async function saveScreenshot(driver, path) {
  const png = await driver.takeScreenshot();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(png, 'base64'));
}

async function run() {
  const driver = await createDriver();

  try {
    await loginAsAdmin(driver);
    await driver.get('http://localhost:4000/admin/productos/nuevo');

    const url = await driver.getCurrentUrl();
    assert(url.includes('/admin/productos/nuevo'), `Expected the product form route, got: ${url}`);

    await driver.wait(async () => {
      try {
        const nombre = await driver.findElement(By.id('nombre'));
        const stock = await driver.findElement(By.id('stock'));
        const precio = await driver.findElement(By.id('precio'));
        return Boolean(nombre && stock && precio);
      } catch {
        return false;
      }
    }, 10000, 'Expected the product creation fields to be visible');

    assert(await driver.findElement(By.id('nombre')), 'Product name field not found');
    assert(await driver.findElement(By.id('stock')), 'Product stock field not found');
    assert(await driver.findElement(By.id('precio')), 'Product price field not found');

    await saveScreenshot(driver, evidencePath);
    console.log(`Ticket-05: product creation form opened, screenshot saved to ${evidencePath}`);
    await pause(50000);
  } finally {
    await cleanupDriver(driver);
  }
}

run().catch((error) => {
  console.error('Ticket-05 failed:', error);
  process.exitCode = 1;
});