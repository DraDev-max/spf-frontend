import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import chromedriver from 'chromedriver';

const BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:4000';
const DEFAULT_TIMEOUT = Number(process.env.SELENIUM_TIMEOUT_MS || 15000);
const SECTION_DELAY_MS = Number(process.env.SELENIUM_SECTION_DELAY_MS || 30000);
const ADMIN_USER = process.env.SELENIUM_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.SELENIUM_ADMIN_PASSWORD || '123456';
const MOD_USER = process.env.SELENIUM_MOD_USER || 'mod';
const MOD_PASSWORD = process.env.SELENIUM_MOD_PASSWORD || '123456';
const DEFAULT_CHROME_BINARY = process.env.CHROME_BINARY_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export async function createDriver() {
  const profileDir = await mkdtemp(join(tmpdir(), 'selenium-chrome-'));
  const options = new chrome.Options()
    .setChromeBinaryPath(DEFAULT_CHROME_BINARY)
    .addArguments('--headless=new')
    .addArguments('--disable-gpu')
    .addArguments('--disable-software-rasterizer')
    .addArguments('--disable-extensions')
    .addArguments('--disable-background-networking')
    .addArguments('--no-first-run')
    .addArguments('--no-default-browser-check')
    .addArguments('--remote-debugging-port=0')
    .addArguments(`--user-data-dir=${profileDir}`)
    .addArguments('--window-size=1920,1080');
  const service = new chrome.ServiceBuilder(chromedriver.path);
  return new Builder().forBrowser('chrome').setChromeOptions(options).setChromeService(service).build();
}

export async function openLoginPage(driver) {
  await driver.get(`${BASE_URL}/login`);
  await driver.wait(until.titleContains('Login'), DEFAULT_TIMEOUT);
}

export async function loginAs(driver, usuario, password) {
  await openLoginPage(driver);
  await driver.findElement(By.id('usuario')).clear();
  await driver.findElement(By.id('usuario')).sendKeys(usuario);
  await driver.findElement(By.id('password')).clear();
  await driver.findElement(By.id('password')).sendKeys(password);
  await driver.findElement(By.css('button[type="submit"]')).click();
  await driver.wait(until.urlContains('/menu'), DEFAULT_TIMEOUT);
}

export function loginAsAdmin(driver) {
  return loginAs(driver, ADMIN_USER, ADMIN_PASSWORD);
}

export function loginAsMod(driver) {
  return loginAs(driver, MOD_USER, MOD_PASSWORD);
}

export async function cleanupDriver(driver) {
  if (!driver) {
    return;
  }

  try {
    await driver.quit();
  } catch (error) {
    console.error('Failed to close browser:', error);
  }
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function buildFakeProduct(overrides = {}) {
  const stamp = Date.now().toString(36);
  return {
    categoria_id: '',
    nombre: 'air',
    descripcion: 'selenium fake product',
    marca: 'Air Labs',
    sku: `AIR-${stamp}`,
    precio: 1,
    stock: 300000000,
    imagen_url: 'https://images.pexels.com/photos/32047220/pexels-photo-32047220.jpeg?_gl=1*2jk6mr*_ga*MjEyMjU3ODQxMy4xNzg3MzM2MTY5*_ga_8JE65Q40S6*czE3ODczMzYxNjgkbzEkZzEkdDE3ODczMzYxODEkajQ3JGwwJGgw',
    activo: 1,
    ...overrides
  };
}

export function sectionTitle(name) {
  return `\n=== ${name} ===`;
}

export function pause(ms = SECTION_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getBackendJson(path) {
  const response = await fetch(`${process.env.BACKEND_API_URL || 'http://localhost:3000/api'}${path}`);

  if (!response.ok) {
    throw new Error(`Backend request failed: HTTP ${response.status}`);
  }

  return response.json();
}

export { BASE_URL, By, until, DEFAULT_TIMEOUT, SECTION_DELAY_MS, ADMIN_USER, ADMIN_PASSWORD, MOD_USER, MOD_PASSWORD };
