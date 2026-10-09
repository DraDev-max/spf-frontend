import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_URL,
  By,
  DEFAULT_TIMEOUT,
  assert,
  cleanupDriver,
  createDriver,
  getBackendJson,
  loginAsAdmin,
  loginAsMod,
  pause,
  until
} from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const evidenceDir = resolve(__dirname, 'evidence');
const STRESS_ITEMS = Number(process.env.SELENIUM_STRESS_ITEMS || 50);
const HOLD_MS = Number(process.env.SELENIUM_STRESS_HOLD_MS || 30000);

async function shot(driver, name) {
  const png = await driver.takeScreenshot();
  await mkdir(evidenceDir, { recursive: true });
  const path = resolve(evidenceDir, name);
  await writeFile(path, Buffer.from(png, 'base64'));
  console.log(`[stress] evidence: ${path}`);
}

async function visibleText(driver, text) {
  await driver.wait(until.elementLocated(By.xpath(`//*[contains(normalize-space(), ${JSON.stringify(text)})]`)), DEFAULT_TIMEOUT);
}

async function firstProduct() {
  const products = await getBackendJson('/productos');
  const product = Array.isArray(products) ? products.find((p) => Number(p.id) > 0 && Number(p.stock || 0) > 0) : null;
  assert(product, 'No product with stock was available');
  return product;
}

async function submitStressRating(driver) {
  console.log('\n=== stress: comment + moderation ===');
  const product = await firstProduct();
  const comment = `stress review ${Date.now().toString(36)}`;

  await driver.get(`${BASE_URL}/producto/${product.id}`);
  await driver.wait(until.elementLocated(By.id('comentario')), DEFAULT_TIMEOUT);
  await driver.findElement(By.id('puntuacion')).sendKeys('5 estrellas');
  await driver.findElement(By.id('comentario')).sendKeys(comment);
  await driver.findElement(By.css('form[action="/calificaciones"] button[type="submit"]')).click();
  await driver.wait(async () => (await driver.getPageSource()).includes(comment), DEFAULT_TIMEOUT, 'Created rating did not stay visible to its author');
  await shot(driver, 'stress-01-rating-submitted.png');

  await driver.get(`${BASE_URL}/logout`);
  await loginAsMod(driver);
  await driver.get(`${BASE_URL}/admin/calificaciones`);
  await driver.wait(async () => (await driver.getPageSource()).includes(comment), DEFAULT_TIMEOUT, 'Pending rating was not visible in moderation');
  await shot(driver, 'stress-02-rating-moderation.png');
}

async function stressShopping(driver) {
  console.log('\n=== stress: shopping 50 items + checkout ===');
  const product = await firstProduct();
  await driver.get(`${BASE_URL}/menu`);

  await driver.executeScript(async ({ id, title, price, count }) => {
    const token = window.csrfToken || document.querySelector('input[name="_csrf"]')?.value;
    for (let i = 0; i < count; i += 1) {
      const data = new URLSearchParams({ producto_id: id, nombre: title, precio: price, cantidad: '1' });
      const response = await fetch('/carrito', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': token },
        body: data
      });
      if (!response.ok) throw new Error(`Cart add failed at ${i + 1}: ${response.status}`);
    }
  }, { id: String(product.id), title: product.title || product.nombre || `Producto ${product.id}`, price: String(product.price || product.precio || 1), count: STRESS_ITEMS });

  await driver.get(`${BASE_URL}/menu`);
  await driver.wait(async () => (await driver.getPageSource()).includes('Mi Carrito de Compras'), DEFAULT_TIMEOUT);
  await shot(driver, 'stress-03-cart-50-items.png');

  await driver.get(`${BASE_URL}/checkout`);
  for (const [id, value] of Object.entries({
    postal_code: '000000',
    location: 'Stress Location',
    province: 'Stress Province',
    municipality: 'Stress Municipality',
    address: 'Stress Street 123',
    card_name: 'Stress Tester',
    card_number: '4111111111111111',
    card_expiry: '12/30',
    card_cvv: '123'
  })) {
    const input = await driver.findElement(By.id(id));
    await input.clear();
    await input.sendKeys(value);
  }
  await shot(driver, 'stress-04-checkout-before-submit.png');
  await driver.findElement(By.css('button[type="submit"]')).click();
  await visibleText(driver, 'creado correctamente');
  await shot(driver, 'stress-05-checkout-created.png');
}

async function stressStockChange(driver) {
  console.log('\n=== stress: product stock modification ===');
  await driver.get(`${BASE_URL}/admin/productos`);
  const editLink = await driver.findElement(By.css('a[href^="/admin/productos/editar/"]'));
  await editLink.click();
  await driver.wait(until.elementLocated(By.id('stock')), DEFAULT_TIMEOUT);

  const stockInput = await driver.findElement(By.id('stock'));
  const original = Number(await stockInput.getAttribute('value')) || 0;
  const next = original + 1;
  await stockInput.clear();
  await stockInput.sendKeys(String(next));
  await shot(driver, 'stress-06-stock-before-save.png');
  await driver.findElement(By.css('button[type="submit"]')).click();
  await driver.wait(until.urlContains('/admin/productos'), DEFAULT_TIMEOUT);
  await driver.wait(async () => (await driver.getPageSource()).includes(String(next)), DEFAULT_TIMEOUT, 'Updated stock did not show in product admin list');
  await shot(driver, 'stress-07-stock-after-save.png');
}

async function run() {
  const driver = await createDriver();
  try {
    await loginAsAdmin(driver);
    await submitStressRating(driver);

    await driver.get(`${BASE_URL}/logout`);
    await loginAsAdmin(driver);
    await stressShopping(driver);

    await driver.get(`${BASE_URL}/logout`);
    await loginAsAdmin(driver);
    await stressStockChange(driver);

    console.log('\n[stress] all stress checks reached the evidence screens');
    await pause(HOLD_MS);
  } finally {
    await cleanupDriver(driver);
  }
}

run().catch((error) => {
  console.error('[stress] failed:', error);
  process.exitCode = 1;
});
