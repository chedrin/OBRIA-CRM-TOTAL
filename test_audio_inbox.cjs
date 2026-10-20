const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));

  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  console.log('--- Clicking Audio / Email IA tab ---');
  await page.click('text="Audio / Email IA"');
  await page.waitForTimeout(1500);

  console.log('--- Checking active reference budget badge ---');
  const badgeText = await page.innerText('text="Presupuestos de Ejemplo Activos"');
  console.log('Found badge text:', badgeText);

  console.log('--- Switching to Pegar Email / WhatsApp mode ---');
  await page.click('text="Pegar Email / WhatsApp"');
  await page.waitForTimeout(500);

  console.log('--- Clicking Transformar con IA a Presupuesto Técnico ---');
  await page.click('button:has-text("Transformar con IA a Presupuesto Técnico")');

  console.log('--- Waiting for AI transformation results ---');
  await page.waitForSelector('text="Resumen Ejecutivo del Alcance Detectado"', { timeout: 10000 });

  const summary = await page.innerText('text="Resumen Ejecutivo del Alcance Detectado"');
  console.log('Result card visible:', summary);

  await page.screenshot({ path: '/tmp/audio_inbox_verified.png' });
  console.log('Saved screenshot to /tmp/audio_inbox_verified.png');

  await browser.close();
})();
