import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 900})
        page = await context.new_page()

        await page.goto('http://localhost:3000', wait_until='networkidle')

        # If admin modal is open, click login or close
        try:
            admin_btn = page.locator('button:has-text("Iniciar Sesión Admin")')
            if await admin_btn.count() > 0 and await admin_btn.is_visible():
                await admin_btn.click()
                await page.wait_for_timeout(500)
        except Exception as e:
            print("Admin login error/skip:", e)

        # Click on Ajustes/Config in sidebar or header
        try:
            # Check for Ajustes button
            ajustes_btn = page.locator('text=Ajustes').or_(page.locator('text=Configuración'))
            if await ajustes_btn.count() > 0:
                await ajustes_btn.first.click()
                await page.wait_for_timeout(500)
        except Exception as e:
            print("Ajustes click error:", e)

        # Click on Motor Central IA tab
        try:
            motor_tab = page.locator('text=Motor Central IA (BYOK)')
            if await motor_tab.count() > 0:
                await motor_tab.first.click()
                await page.wait_for_timeout(500)
        except Exception as e:
            print("Motor tab click error:", e)

        await page.screenshot(path='/home/jules/verification/screenshots/verification_motor_ia_tab.png')
        await browser.close()

asyncio.run(run())
