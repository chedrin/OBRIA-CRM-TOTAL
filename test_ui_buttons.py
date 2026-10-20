import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        print("Navigating to http://localhost:3000...")
        await page.goto("http://localhost:3000", wait_until="networkidle")

        # Click "Iniciar Sesión Admin" if modal is present
        login_btn = page.locator("button:has-text('Iniciar Sesión Admin')")
        if await login_btn.count() > 0:
            print("Clicking Iniciar Sesión Admin...")
            await login_btn.first.click()
            await page.wait_for_timeout(1000)

        await page.screenshot(path="/tmp/after_login.png")

        # Now click Presupuestos IA
        print("Clicking Presupuestos IA...")
        await page.click("text=Presupuestos IA")
        await page.wait_for_timeout(1000)

        # Check for buttons
        btn1 = page.locator("button:has-text('Presupuesto IA 360°')")
        print("Btn 1 count:", await btn1.count())

        btn2 = page.locator("button:has-text('Iniciar Asistente IA 360°')")
        print("Btn 2 count:", await btn2.count())

        # Click Btn 1
        if await btn1.count() > 0:
            print("Clicking Btn 1 (Presupuesto IA 360°)...")
            await btn1.first.click()
            await page.wait_for_timeout(1000)

            modal = page.locator("text=Asistente de Presupuestación IA 360°")
            print("Modal visible after Btn 1 click:", await modal.is_visible())
            await page.screenshot(path="/tmp/modal_open_btn1.png")

            # Close modal using top-right X button
            close_btn = page.locator("div.fixed button").filter(has=page.locator("svg"))
            # or locator for x button
            close_x = page.locator("button:has-text('✕')").or_(page.locator("button").filter(has_text="✕"))
            print("Close btn count:", await close_x.count())
            if await close_x.count() > 0:
                await close_x.first.click()
                await page.wait_for_timeout(500)
            else:
                # click backdrop or press escape
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(500)

        # Click Btn 2
        if await btn2.count() > 0:
            print("Clicking Btn 2 (Iniciar Asistente IA 360°)...")
            await btn2.first.click()
            await page.wait_for_timeout(1000)

            modal = page.locator("text=Asistente de Presupuestación IA 360°")
            print("Modal visible after Btn 2 click:", await modal.is_visible())
            await page.screenshot(path="/tmp/modal_open_btn2.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
