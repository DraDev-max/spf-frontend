import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { By, assert, cleanupDriver, createDriver, pause } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const evidencePath = resolve(__dirname, 'evidence', 'ticket-004-empty-login.png');

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
    const submit = await driver.findElement(By.css('button[type="submit"]'));

    await usuario.clear();
    await password.clear();
    await submit.click();

    const url = await driver.getCurrentUrl();
    assert(url.includes('/login'), `Expected to remain on /login, got: ${url}`);

    const validity = await driver.executeScript(() => {
      const usuarioInput = document.querySelector('#usuario');
      const passwordInput = document.querySelector('#password');
      return {
        usuarioMissing: Boolean(usuarioInput?.validity?.valueMissing),
        passwordMissing: Boolean(passwordInput?.validity?.valueMissing),
        usuarioMessage: usuarioInput?.validationMessage || '',
        passwordMessage: passwordInput?.validationMessage || ''
      };
    });

    assert(validity.usuarioMissing || validity.passwordMissing, 'Expected required-field validation to trigger');
    assert(
      validity.usuarioMessage.length > 0 || validity.passwordMessage.length > 0,
      'Expected a native validation message for the empty login fields'
    );

    await saveScreenshot(driver, evidencePath);
    console.log(`Ticket-04: empty login blocked, screenshot saved to ${evidencePath}`);
    await pause(50000);
  } finally {
    await cleanupDriver(driver);
  }
}

run().catch((error) => {
  console.error('Ticket-04 failed:', error);
  process.exitCode = 1;
});