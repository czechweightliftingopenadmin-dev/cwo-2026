import { expect, test } from '@playwright/test'

// Tests do not depend on, or repeatedly download tiles from, the public provider.
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      headers: { 'access-control-allow-origin': '*' },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#ddd"/></svg>',
    }),
  )
})

test('navigation, languages, themes, and preferences work on desktop and touch', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('CZECH')
  await expect(page.locator('.date-announcement')).toContainText(/21.*22.*2026/)
  await expect(page.getByRole('timer')).toBeVisible()
  const digit = page.getByRole('timer').locator('.fcc__digit_block').first()
  expect(await digit.evaluate((element) => getComputedStyle(element).fontFamily)).toContain(
    'Bitcount Single',
  )
  const digitSize = await digit.evaluate((element) =>
    parseFloat(getComputedStyle(element).fontSize),
  )
  const titleSize = await page
    .locator('h1')
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
  expect(digitSize).toBeGreaterThan(titleSize * 2)
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
  await expect(page.locator('.date-announcement')).toContainText(/21.*22.*2026/)
  await expect(page.getByRole('timer', { name: 'Until 21 December' })).toBeVisible()
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
  await expect(page.locator('.venue-map')).toHaveAttribute('data-map-status', 'ready')
  expect(errors).toEqual([])
})

test('desktop lettering and header keep their geometry when navigation opens', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Desktop column geometry')
  await page.goto('/')
  const railWidth = await page
    .locator('.sidebar')
    .evaluate((element) => element.getBoundingClientRect().width)
  const headerHeight = await page
    .locator('.rail-toggle')
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(railWidth).toBeGreaterThanOrEqual(300)
  const initialSize = await page
    .locator('.rail-initial')
    .first()
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
  const otherSize = await page
    .locator('.rail-word > span:nth-child(2)')
    .first()
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
  expect(initialSize / otherSize).toBeCloseTo(1.2)
  await page.locator('.rail-toggle').click()
  expect(
    await page.locator('.sidebar').evaluate((element) => element.getBoundingClientRect().width),
  ).toBe(railWidth)
  expect(
    await page
      .locator('.rail-toggle')
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(headerHeight)
})

test('tap on the large title opens and pins the navigation', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'On desktop the title is replaced by navigation on hover')
  await page.goto('/')
  if (isMobile) await page.locator('.rail-brand').tap()
  else await page.locator('.rail-brand').click()
  await expect(page.getByRole('navigation')).toBeVisible()
  await expect(page.locator('.rail-toggle')).toHaveAttribute('aria-label', 'Zavřít navigaci')
  await page.keyboard.press('Escape')
  await expect(page.locator('.rail-toggle')).toHaveAttribute('aria-expanded', 'false')
})

test('flip clock updates at midnight and handles the end of the competition', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-20T22:59:58Z') })
  await page.goto('/')
  await expect(page.getByRole('timer')).toBeVisible()
  await expect(page.getByText('Sekundy', { exact: true })).toBeVisible()
  await page.clock.fastForward(3000)
  await expect(page.getByText('Soutěž probíhá', { exact: true })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveCount(0)
  await page.clock.fastForward(48 * 60 * 60 * 1000)
  await expect(page.getByText('Soutěž skončila', { exact: true })).toBeVisible()
})

test('map failure keeps the address and external map link available', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
  await page.goto('/')
  await page.locator('#venue').scrollIntoViewIfNeeded()
  await expect(page.locator('.venue-map')).toHaveAttribute('data-map-status', 'error')
  await expect(page.getByText('Kamenice 753/5, 625 00 Brno')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Otevřít mapu ↗' })).toHaveAttribute(
    'href',
    /mlat=49\.1785&mlon=16\.5687/,
  )
  await expect(page.locator('.map-attribution')).toBeVisible()
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

test('weigh-in reference reaches rules and the linked ČSV PDF is available', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.rules-reference').click()
  await expect(page).toHaveURL(/#rules$/)
  await expect(page.locator('#rules')).toBeFocused()
  const document = page.getByRole('link', { name: /Technická a soutěžní pravidla a předpisy ČSV/ })
  await expect(document).toBeVisible()
  await expect(document).toContainText('vydání 2019')
  await expect(document).toHaveAttribute('target', '_blank')
  const href = await document.getAttribute('href')
  expect(href).toBeTruthy()
  const response = await request.get(href!)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('application/pdf')
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-')
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

test('a map chunk that fails to load leaves the rest of the page working', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/assets/VenueMap-*.js', (route) => route.abort())
  await page.goto('/')
  await page.locator('#venue').scrollIntoViewIfNeeded()
  await expect(page.locator('#venue')).toContainText('Mapu se nepodařilo načíst')
  await expect(page.locator('#venue').getByRole('link', { name: /Otevřít mapu/ })).toBeVisible()
  await expect(page.locator('#about')).toBeVisible()
  expect(errors).toEqual([])
})
