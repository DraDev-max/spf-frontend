import { By, assert, cleanupDriver, createDriver, loginAsAdmin, DEFAULT_TIMEOUT } from './test-utils.js';

async function run() {
  const driver = await createDriver();

  try {
    await loginAsAdmin(driver);

    const title = await driver.getTitle();
    assert(title.includes('Dashboard'), `Unexpected dashboard title: ${title}`);

    const inventoryCard = await driver.findElement(By.css('a[href="/admin/productos"]'));
    await inventoryCard.click();
    await driver.wait(async () => (await driver.getCurrentUrl()).includes('/admin/productos'), DEFAULT_TIMEOUT);
    await driver.wait(async () => (await driver.getTitle()).includes('Productos'), DEFAULT_TIMEOUT);

    const productsTitle = await driver.getTitle();
    assert(productsTitle.includes('Productos'), `Unexpected products page title: ${productsTitle}`);

    console.log('[menu] dashboard and inventory navigation are working');
  } finally {
    await cleanupDriver(driver);
  }
}

run().catch((error) => {
  console.error('[menu] failed:', error);
  process.exitCode = 1;
});
