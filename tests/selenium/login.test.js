import { By, assert, cleanupDriver, createDriver, openLoginPage } from './test-utils.js';

async function run() {
  const driver = await createDriver();

  try {
    await openLoginPage(driver);

    assert(await driver.findElement(By.id('usuario')), 'Login input not found');
    assert(await driver.findElement(By.id('password')), 'Password input not found');

    const title = await driver.getTitle();
    assert(title.includes('Login'), `Unexpected login title: ${title}`);

    console.log('Ticket-01: login screen opened successfully');
    await new Promise((resolve) => setTimeout(resolve, 50000));
  } finally {
    await cleanupDriver(driver);
  }
}

run().catch((error) => {
  console.error('Ticket-01 failed:', error);
  process.exitCode = 1;
});