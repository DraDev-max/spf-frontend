import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { By, assert, buildFakeProduct, cleanupDriver, createDriver, getBackendJson, loginAsAdmin, pause } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const evidencePath = resolve(__dirname, 'evidence', 'ticket-006-product-creation.png');

async function saveScreenshot(driver, path) {
  const png = await driver.takeScreenshot();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(png, 'base64'));
}

async function selectFirstCategory() {
  const categories = await getBackendJson('/categorias?activo=1');
  const firstCategory = Array.isArray(categories) ? categories.find((category) => Number(category.id) > 0) : null;

  if (!firstCategory) {
    throw new Error('No active category was available for Ticket-06');
  }

  return String(firstCategory.id);
}

async function waitForBackendProduct(sku, timeoutMs = 15000, pollMs = 1000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const backendProducts = await getBackendJson('/productos');
    const match = Array.isArray(backendProducts)
      ? backendProducts.find((item) => String(item.sku) === String(sku))
      : null;

    if (match) {
      return match;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Expected the created product to exist in the backend: ${sku}`);
}

async function run() {
  const driver = await createDriver();
  const product = buildFakeProduct();

  try {
    await loginAsAdmin(driver);
    await driver.get('http://localhost:4000/admin/productos/nuevo');

    const categoryId = await selectFirstCategory();
    const categorySelect = await driver.findElement(By.id('categoria_id'));
    await driver.executeScript(
      'arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event("change", { bubbles: true }));',
      categorySelect,
      categoryId
    );

    const selectedValue = await categorySelect.getAttribute('value');
    assert(String(selectedValue) === categoryId, `Expected category ${categoryId} to be selected, got: ${selectedValue}`);

    await driver.findElement(By.id('nombre')).clear();
    await driver.findElement(By.id('nombre')).sendKeys(product.nombre);
    await driver.findElement(By.id('descripcion')).clear();
    await driver.findElement(By.id('descripcion')).sendKeys(product.descripcion);
    await driver.findElement(By.id('marca')).clear();
    await driver.findElement(By.id('marca')).sendKeys(product.marca);
    await driver.findElement(By.id('sku')).clear();
    await driver.findElement(By.id('sku')).sendKeys(product.sku);
    await driver.findElement(By.id('precio')).clear();
    await driver.findElement(By.id('precio')).sendKeys(String(product.precio));
    await driver.findElement(By.id('stock')).clear();
    await driver.findElement(By.id('stock')).sendKeys(String(product.stock));
    await driver.findElement(By.id('imagen_url')).clear();
    await driver.findElement(By.id('imagen_url')).sendKeys(product.imagen_url);

    const beforeCreateUrl = await driver.getCurrentUrl();
    assert(beforeCreateUrl.includes('/admin/productos/nuevo'), `Expected to stay on the create form before submit, got: ${beforeCreateUrl}`);

    await driver.findElement(By.css('button[type="submit"]')).click();

    await driver.wait(async () => {
      const currentUrl = await driver.getCurrentUrl();
      return currentUrl.endsWith('/admin/productos');
    }, 15000, 'Expected redirect to the product list after create');

    const createdProduct = await waitForBackendProduct(product.sku);
    console.log(`Ticket-06 backend confirmed ${createdProduct.nombre} with stock ${createdProduct.stock}`);

    await driver.get('http://localhost:4000/admin/productos');
    await driver.wait(async () => (await driver.getPageSource()).includes(product.sku), 15000, 'Expected the created product to appear in the list');

    const pageSource = await driver.getPageSource();
    assert(pageSource.includes(product.nombre), 'Created product name not found in list');
    assert(pageSource.includes(product.sku), 'Created product SKU not found in list');
    assert(pageSource.includes(String(product.stock)), 'Created product stock not found in list');

    await saveScreenshot(driver, evidencePath);
    console.log(`Ticket-06: product created and listed, screenshot saved to ${evidencePath}`);
    await pause(50000);
  } finally {
    await cleanupDriver(driver);
  }
}

run().catch((error) => {
  console.error('Ticket-06 failed:', error);
  process.exitCode = 1;
});
