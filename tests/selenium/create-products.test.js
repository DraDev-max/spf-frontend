import { By, assert, cleanupDriver, createDriver, loginAsAdmin } from './test-utils.js';

async function run() {
  const driver = await createDriver();

  try {
    await loginAsAdmin(driver);

    await driver.get('http://localhost:4000/admin/productos/nuevo');

    const title = await driver.getTitle();
    assert(title.includes('Nuevo Producto'), `Unexpected create-product title: ${title}`);

    assert(await driver.findElement(By.id('categoria_id')), 'Category select not found');
    assert(await driver.findElement(By.id('nombre')), 'Name input not found');
    assert(await driver.findElement(By.id('stock')), 'Stock input not found');

    console.log('[create-products] create-product form opened and fields are present');
  } finally {
    await cleanupDriver(driver);
  }
}

run().catch((error) => {
  console.error('[create-products] failed:', error);
  process.exitCode = 1;
});
