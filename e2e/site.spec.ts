import { expect, test } from '@playwright/test'

test('navigation, languages, themes, and preferences work on desktop and touch', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('CZECH')
  await expect(page.getByText('Termín brzy oznámíme')).toBeVisible()
  const toggle = page.locator('.rail-toggle')
  const originalLeft = await page
    .locator('main')
    .evaluate((element) => element.getBoundingClientRect().left)
  if (isMobile) await toggle.tap()
  else await toggle.click()
  await expect(page.getByRole('navigation')).toBeVisible()
  expect(
    await page.locator('main').evaluate((element) => element.getBoundingClientRect().left),
  ).toBe(originalLeft)
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Dates coming soon')).toBeVisible()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await toggle.click()
  await page.getByRole('button', { name: 'Čeština', exact: true }).click()
  await page.getByRole('button', { name: 'Tmavý', exact: true }).click()
  await page.getByRole('link', { name: /Místo konání/ }).click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#venue')).toBeFocused()
  expect(errors).toEqual([])
})

test('both languages and themes fit without horizontal overflow and fonts load', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  for (const language of ['Čeština', 'English']) {
    await page.locator('.rail-toggle').click()
    await page.getByRole('button', { name: language, exact: true }).click()
    for (const theme of ['light', 'dark']) {
      const label =
        language === 'English'
          ? theme === 'light'
            ? 'Light'
            : 'Dark'
          : theme === 'light'
            ? 'Světlý'
            : 'Tmavý'
      await page.getByRole('button', { name: label, exact: true }).click()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
    }
    await page.keyboard.press('Escape')
  }
  expect(
    await page.evaluate(() =>
      document.fonts.check('32px "Bitcount Single Variable"', 'České vzpírání'),
    ),
  ).toBe(true)
})

test('reduced motion disables navigation animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.rail-toggle').click()
  expect(
    await page
      .locator('.sidebar')
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe('0s')
})

test('a narrow screen has no overflow and navigation closes on toggle and outside', async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  if (isMobile) await page.locator('.rail-toggle').tap()
  else await page.locator('.rail-toggle').click()
  await expect(page.getByRole('navigation')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.rail-toggle').click()
  await expect(page.locator('.rail-toggle')).toHaveAttribute('aria-expanded', 'false')
  await page.locator('.rail-toggle').click()
  if (isMobile) await page.touchscreen.tap(315, 500)
  else await page.mouse.click(315, 500)
  await expect(page.locator('.rail-toggle')).toHaveAttribute('aria-expanded', 'false')
})

test('mouse hover is temporary, click pins, and Escape stays closed', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Mouse-only interaction')
  await page.goto('/')
  const toggle = page.locator('.rail-toggle')
  await page.mouse.move(20, 35)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.mouse.move(900, 35)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await page.mouse.move(20, 35)
  await toggle.click({ position: { x: 20, y: 35 } })
  await page.mouse.move(900, 35)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: /Úvod/ })).toBeFocused()
})
