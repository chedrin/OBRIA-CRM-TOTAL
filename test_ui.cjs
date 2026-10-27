const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));

  console.log('Navigating...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  console.log('--- Clicking Presupuestos IA ---');
  await page.click('text="Presupuestos IA"');
  await page.waitForTimeout(2000);

  console.log('--- Clicking Ajustes ---');
  await page.click('text="Ajustes"');
  await page.waitForTimeout(2000);

  console.log('--- Clicking Motor Central IA tab ---');
  await page.click('text="Motor Central IA (BYOK)"');
  await page.waitForTimeout(2000);

  console.log('Done test.');
  await browser.close();
})();
