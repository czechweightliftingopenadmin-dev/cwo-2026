import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const athleteId = '6f1b8c1e-1f7a-4a8e-9c55-1d2b3c4d5e6f'
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const athlete = {
  id: athleteId,
  firstName: 'Jana',
  lastName: 'Nováková',
  sex: 'F',
  weightClass: '61',
  total: 150,
}

async function openChanges(page: Page, identifier: string, amOnly: boolean) {
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00+01:00'))
  await page.route('**/api/lookup', (route) =>
    json(route, 200, {
      permissions: { results: false, competitions: true },
      registrations: [
        {
          kind: 'individual',
          teamName: null,
          invoiceNumber: amOnly ? null : '12345678',
          athletes: [
            {
              ...athlete,
              cwo: !amOnly,
              amcr: amOnly,
              university: amOnly ? 'MU' : null,
              tshirtSize: amOnly ? null : 'M',
            },
          ],
        },
      ],
    }),
  )
  await page.goto('/#registration')
  const section = page.locator('#registration')
  await section.getByRole('button', { name: 'Změna registrace', exact: true }).click()
  await section.getByLabel('Číslo faktury nebo kód registrace').fill(identifier)
  await section.getByLabel('E-mail z registrace').fill('jana@example.cz')
  await section.getByRole('button', { name: 'Najít registraci' }).click()
  await expect(section.getByText('Jana Nováková', { exact: true })).toBeVisible()
  return section
}
async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('AM CR gains CWO without losing entered data after server, network or validation errors', async ({
  page,
}) => {
  let attempt = 0
  const requests: Record<string, unknown>[] = []
  await page.route('**/api/update', (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>)
    attempt++
    if (attempt === 1) return json(route, 500, { error: 'server' })
    if (attempt === 2) return route.abort('failed')
    if (attempt === 3)
      return json(route, 400, {
        error: 'validation',
        issues: [{ path: 'changes.0.addCwo.invoiceNumber', message: 'invoiceFormat' }],
      })
    return json(route, 200, { changed: 1, emailSent: false })
  })
  const section = await openChanges(page, 'AM-ABCD-EFGH', true)
  await expect(
    section.getByRole('checkbox', { name: 'Akademické mistrovství ČR', exact: true }),
  ).toBeDisabled()
  await expect(section.getByLabel('Dvojboj (kg)', { exact: true })).toHaveCount(0)
  await section.getByRole('checkbox', { name: 'Czech Weightlifting Open', exact: true }).check()
  await section.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(section.getByLabel('Číslo faktury', { exact: true })).toBeFocused()
  await expect(
    section.getByText('Číslo faktury má přesně 8 číslic.', { exact: true }),
  ).toBeVisible()
  await section.getByLabel('Číslo faktury', { exact: true }).fill('1234 5678')
  await expect(section.getByLabel('Velikost trička (unisex)', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await choose(page, 'Velikost trička (unisex)', 'L')
  for (let n = 0; n < 3; n++) {
    await section.getByRole('button', { name: 'Uložit změny' }).click()
    await expect(section.getByRole('alert')).toBeVisible()
    await expect(section.getByLabel('Číslo faktury', { exact: true })).toHaveValue('1234 5678')
    await expect(section.getByLabel('Velikost trička (unisex)', { exact: true })).toContainText('L')
    await expect(
      section.getByRole('checkbox', { name: 'Czech Weightlifting Open', exact: true }),
    ).toBeChecked()
  }
  await expect(section.getByLabel('Číslo faktury', { exact: true })).toBeFocused()
  await section.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(section.getByRole('heading', { name: 'Změny jsou uložené' })).toBeVisible()
  await expect(section).toContainText('Potvrzovací e-mail se nepodařilo odeslat')
  expect(requests).toHaveLength(4)
  for (const request of requests)
    expect(request).toMatchObject({
      identifier: 'AM-ABCD-EFGH',
      email: 'jana@example.cz',
      changes: [{ athleteId, addCwo: { invoiceNumber: '12345678', tshirtSize: 'L' } }],
    })
  expect((requests[0]!.changes as Record<string, unknown>[])[0]).not.toHaveProperty('total')
})

for (const identifier of ['12345678', 'CW-ABCD-EFGH'])
  test(`CWO gains AM CR with a university using ${identifier}`, async ({ page }) => {
    let body: Record<string, unknown> | undefined
    await page.route('**/api/update', (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>
      return json(route, 200, { changed: 1, emailSent: true })
    })
    const section = await openChanges(page, identifier, false)
    await expect(
      section.getByRole('checkbox', { name: 'Czech Weightlifting Open', exact: true }),
    ).toBeDisabled()
    await section.getByRole('checkbox', { name: 'Akademické mistrovství ČR', exact: true }).check()
    await section.getByRole('button', { name: 'Uložit změny' }).click()
    await expect(section.getByLabel('Vysoká škola', { exact: true })).toBeFocused()
    await choose(page, 'Vysoká škola', 'Masarykova univerzita')
    await section.getByRole('button', { name: 'Uložit změny' }).click()
    await expect(section.getByRole('heading', { name: 'Změny jsou uložené' })).toBeVisible()
    expect(body).toMatchObject({
      identifier,
      changes: [{ athleteId, addAmcr: { university: 'MU' } }],
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

test('a failed new AM CR registration keeps its draft and shows a usable duplicate message', async ({
  page,
}) => {
  let attempt = 0
  await page.route('**/api/register', (route) => {
    attempt++
    if (attempt === 1) return json(route, 500, { error: 'server' })
    if (attempt === 2) return route.abort('failed')
    return json(route, 409, { error: 'alreadyRegistered' })
  })
  await page.goto('/#registration')
  const section = page.locator('#registration')
  await section.getByRole('checkbox', { name: 'Czech Weightlifting Open', exact: true }).uncheck()
  await section.getByRole('checkbox', { name: 'Akademické mistrovství ČR', exact: true }).check()
  await section.getByRole('radio', { name: 'Žena', exact: true }).check()
  await section.getByLabel('Jméno', { exact: true }).fill('Jana')
  await section.getByLabel('Příjmení', { exact: true }).fill('Nováková')
  await section.getByLabel('Datum narození', { exact: true }).fill('1.5.2000')
  await choose(page, 'Hmotnostní kategorie', '61 kg')
  await section.getByLabel('Dvojboj (kg)', { exact: true }).fill('150')
  await section.getByLabel('E-mail', { exact: true }).fill('jana@example.cz')
  await section.getByLabel('Telefon', { exact: true }).fill('777123456')
  await choose(page, 'Vysoká škola', 'Masarykova univerzita')
  await section.getByText('Souhlasím se zpracováním').click()
  await section.getByRole('button', { name: 'Pokračovat ke kontrole' }).click()
  await section.getByRole('button', { name: 'Odeslat registraci', exact: true }).click()
  await expect(section.getByRole('alert')).toContainText('Na serveru se něco pokazilo')
  await section.getByRole('button', { name: 'Upravit údaje', exact: true }).click()
  await expect(section.getByLabel('Jméno', { exact: true })).toHaveValue('Jana')
  await expect(section.getByLabel('Dvojboj (kg)', { exact: true })).toHaveValue('150')
  await expect(section.getByLabel('Vysoká škola', { exact: true })).toContainText(
    'Masarykova univerzita',
  )
  await section.getByRole('button', { name: 'Pokračovat ke kontrole' }).click()
  for (const text of [
    'Nepodařilo se spojit se serverem',
    'Zadané údaje odpovídají již existující registraci',
  ]) {
    await section.getByRole('button', { name: 'Odeslat registraci', exact: true }).click()
    await expect(section.getByRole('alert')).toContainText(text)
  }
  await section.getByRole('button', { name: 'Otevřít změnu registrace', exact: true }).click()
  await expect(
    section.getByLabel('Číslo faktury nebo kód registrace', { exact: true }),
  ).toBeVisible()
  await section.getByRole('button', { name: 'Doplnění údajů', exact: true }).click()
  await expect(section.getByLabel('Jméno', { exact: true })).toHaveValue('Jana')
  await expect(section.getByLabel('E-mail', { exact: true })).toHaveValue('jana@example.cz')
})
