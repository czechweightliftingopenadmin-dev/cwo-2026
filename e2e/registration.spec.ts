import { expect, test } from '@playwright/test'
import type { Locator, Page, Route } from '@playwright/test'
import { editFormState, isVisible, registrationFormState } from '../src/config/features'

// Expectations follow src/config/features.ts, so flipping a switch never breaks the tests.
const duringRegistration = new Date('2026-11-20T12:00:00+01:00')
const duringEdits = new Date('2026-12-10T12:00:00+01:00')
const afterEdits = new Date('2026-12-17T12:00:00+01:00')
const formOpen = registrationFormState(duringRegistration) === 'open'

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function open(page: Page, date: Date) {
  await page.clock.setFixedTime(date)
  await page.goto('/#registration')
}

const section = (page: Page) => page.locator('#registration')

/** Picks an option in the custom select; the list renders at the end of the page. */
async function choose(field: Locator, option: string) {
  await field.click()
  await field.page().getByRole('option', { name: option, exact: true }).click()
}

test('sections and navigation follow the switches', async ({ page }) => {
  const october = new Date('2026-10-25T12:00:00+02:00')
  await page.clock.setFixedTime(october)
  await page.goto('/')
  for (const id of ['registration', 'startlist'] as const) {
    await expect(page.locator(`#${id}`)).toHaveCount(isVisible(id, october) ? 1 : 0)
    await expect(page.locator(`.nav-link[href="#${id}"]`)).toHaveCount(
      isVisible(id, october) ? 1 : 0,
    )
  }
  await expect(page.locator('#about .section-label > span')).toHaveText('01 /')
})

test('an individual registers after fixing errors and reviewing the data', async ({ page }) => {
  test.skip(!formOpen, 'Registration form is switched off')
  let sent: Record<string, unknown> | undefined
  await page.route('**/api/register', (route) => {
    sent = route.request().postDataJSON() as Record<string, unknown>
    return json(route, 201, {
      accessCode: 'CW-ABCD-EFGH',
      invoiceNumber: '12345678',
      emailSent: true,
    })
  })
  await open(page, duringRegistration)
  const form = section(page)

  await form.getByRole('button', { name: 'Pokračovat ke kontrole' }).click()
  await expect(form.getByText(/Oprav prosím \d+ chyb/)).toBeVisible()
  await expect(form.getByLabel('Číslo faktury')).toBeFocused()

  await form.getByLabel('Číslo faktury').fill('1234 5678')
  await form.getByRole('radio', { name: 'Žena' }).check()
  await form.getByLabel('Jméno', { exact: true }).fill('Jana')
  await form.getByLabel('Příjmení').fill('Nováková')
  await form.getByLabel('Datum narození').pressSequentially('01052000')
  await expect(form.getByLabel('Datum narození')).toHaveValue('01. 05. 2000')
  await choose(form.getByLabel('Hmotnostní kategorie'), '61 kg')
  await form.getByLabel('Dvojboj (kg)').fill('150')
  await form.getByLabel('E-mail').fill('Jana@Example.cz')
  await form.getByLabel('Telefon').fill('+420 777 123 456')
  await choose(form.getByLabel('Velikost trička (unisex)'), 'M')
  await form.getByText('Souhlasím se zpracováním').click()
  await form.getByRole('button', { name: 'Pokračovat ke kontrole' }).click()

  await expect(form.getByRole('heading', { name: 'Zkontroluj údaje' })).toBeVisible()
  await expect(form).toContainText('12345678')
  await expect(form).toContainText('jana@example.cz')
  await form.getByRole('button', { name: 'Odeslat registraci' }).click()

  await expect(form.getByRole('heading', { name: 'Registrace je hotová' })).toBeVisible()
  await expect(form).toContainText('CW-ABCD-EFGH')
  expect(sent).toMatchObject({ kind: 'individual', invoiceNumber: '12345678', website: '' })

  // The draft is cleared after a successful registration.
  await page.reload()
  await expect(section(page).getByLabel('Číslo faktury')).toHaveValue('')
})

test('a team keeps the typed data, takes a 4th member and sees a taken invoice', async ({
  page,
}) => {
  await page.route('**/api/register', (route) => json(route, 409, { error: 'invoiceFull' }))
  await open(page, duringRegistration)
  const form = section(page)
  await form.getByLabel('Jméno', { exact: true }).fill('Jana')
  await form.getByRole('radio', { name: 'Tým' }).check()
  await expect(form.locator('.athlete-card')).toHaveCount(3)
  await expect(form.locator('#registration-athletes-0-firstName')).toHaveValue('Jana')
  await form.getByRole('button', { name: 'Přidat 4. člena' }).click()
  await expect(form.locator('.athlete-card')).toHaveCount(4)
  await form.getByRole('button', { name: 'Odebrat 4. člena' }).click()

  await form.getByLabel('Název týmu').fill('Brno Barbell')
  await form.getByLabel('Číslo faktury').fill('12345678')
  const people = [
    ['Jana', 'F', '61'],
    ['Petr', 'M', '75'],
    ['Eva', 'F', '57'],
  ] as const
  for (const [index, [name, sex, weightClass]] of people.entries()) {
    const card = form.locator('.athlete-card').nth(index)
    await card.getByRole('radio', { name: sex === 'F' ? 'Žena' : 'Muž' }).check()
    await card.getByLabel('Jméno', { exact: true }).fill(name)
    await card.getByLabel('Příjmení').fill('Testová')
    await card.getByLabel('Datum narození').fill('1.1.1999')
    await choose(card.getByLabel('Hmotnostní kategorie'), `${weightClass} kg`)
    await card.getByLabel('Dvojboj (kg)').fill('180')
    await card.getByLabel('E-mail').fill(`${name.toLowerCase()}@example.cz`)
    await card.getByLabel('Telefon').fill('777123456')
    await choose(card.getByLabel('Velikost trička (unisex)'), 'L')
  }
  await form.getByText('Souhlasím se zpracováním').click()
  await form.getByRole('button', { name: 'Pokračovat ke kontrole' }).click()
  await form.getByRole('button', { name: 'Odeslat registraci' }).click()

  await expect(form.getByLabel('Číslo faktury')).toBeFocused()
  await expect(form).toContainText('Na toto číslo faktury jsou už registrovaní 4 lidé.')
})

test('the birth date can be picked in the calendar', async ({ page }) => {
  test.skip(!formOpen, 'Registration form is switched off')
  await open(page, duringRegistration)
  const form = section(page)
  await form.getByRole('button', { name: 'Vybrat datum v kalendáři' }).click()
  const calendar = page.locator('.calendar-panel')
  await choose(calendar.getByLabel('Vyberte rok'), '1998')
  await choose(calendar.getByLabel('Vyberte měsíc'), 'březen')
  await calendar.getByRole('button', { name: /14\. března 1998/ }).click()
  await expect(form.getByLabel('Datum narození')).toHaveValue('14. 03. 1998')
  await expect(calendar).toBeHidden()
})

test('an AM ČR athlete registers without an invoice', async ({ page }) => {
  test.skip(!formOpen, 'Registration form is switched off')
  await open(page, duringRegistration)
  const form = section(page)
  await form.getByText('Czech Weightlifting Open', { exact: true }).click()
  await form.getByText('Akademické mistrovství ČR').click()
  await expect(form.getByLabel('Číslo faktury')).toHaveCount(0)
  await expect(form.getByLabel('Velikost trička (unisex)')).toHaveCount(0)
  await expect(form.getByLabel('Vysoká škola')).toBeVisible()
})

test('results change from 7 December with the invoice and e-mail', async ({ page }) => {
  test.skip(editFormState(duringEdits) !== 'open', 'Edit form is switched off')
  const athleteId = '6f1b8c1e-1f7a-4a8e-9c55-1d2b3c4d5e6f'
  let update: Record<string, unknown> | undefined
  await page.route('**/api/lookup', (route) =>
    json(route, 200, {
      registrations: [
        {
          kind: 'individual',
          teamName: null,
          athletes: [
            {
              id: athleteId,
              firstName: 'Jana',
              lastName: 'Nováková',
              sex: 'F',
              weightClass: '61',
              total: 150,
            },
          ],
        },
      ],
    }),
  )
  await page.route('**/api/update', (route) => {
    update = route.request().postDataJSON() as Record<string, unknown>
    return json(route, 200, { changed: 1, emailSent: true })
  })
  await page.route('**/api/startlist', (route) =>
    json(route, 200, { publishedAt: null, isFinal: false, entries: [] }),
  )
  await open(page, duringEdits)
  const form = section(page)
  // The switcher only exists while registration is open as well.
  const editTab = form.getByRole('button', { name: 'Změna registrace' })
  if (await editTab.count()) await editTab.click()
  await form.getByLabel('Číslo faktury nebo kód registrace').fill('12345678')
  await form.getByLabel('E-mail z registrace').fill('jana@example.cz')
  await form.getByRole('button', { name: 'Najít registraci' }).click()

  await expect(form.getByText('Jana Nováková')).toBeVisible()
  await choose(form.getByLabel('Hmotnostní kategorie'), '69 kg')
  await form.getByLabel('Dvojboj (kg)').fill('155')
  await form.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(form.getByRole('heading', { name: /Změny jsou uložené/ })).toBeVisible()
  expect(update).toMatchObject({ changes: [{ athleteId, weightClass: '69', total: 155 }] })
})

test('the start list shows the latest snapshot by category', async ({ page }) => {
  test.skip(!isVisible('startlist', afterEdits), 'Start list is switched off')
  const entry = {
    kind: 'individual',
    teamName: null,
    birthYear: 2000,
    cwo: true,
    amcr: false,
    university: null,
  }
  await page.route('**/api/startlist', (route) =>
    json(route, 200, {
      publishedAt: '2026-12-16T22:59:00Z',
      isFinal: true,
      entries: [
        {
          ...entry,
          firstName: 'Jana',
          lastName: 'Nováková',
          sex: 'F',
          weightClass: '61',
          total: 150,
        },
        { ...entry, firstName: 'Eva', lastName: 'Malá', sex: 'F', weightClass: '49', total: 120 },
        { ...entry, firstName: 'Petr', lastName: 'Novák', sex: 'M', weightClass: '75', total: 250 },
        {
          ...entry,
          kind: 'team',
          teamName: 'Brno Barbell',
          firstName: 'Tom',
          lastName: 'Silný',
          sex: 'M',
          weightClass: '95',
          total: 280,
        },
      ],
    }),
  )
  await page.clock.setFixedTime(afterEdits)
  await page.goto('/#startlist')
  const list = page.locator('#startlist')
  await expect(list.getByText('Finální')).toBeVisible()
  await expect(list).toContainText('Aktualizováno 16. 12. 2026 23:59')
  await expect(list.locator('.startlist-group h3')).toHaveText([/49 kg/, /61 kg/])
  await list.getByRole('button', { name: 'Týmy' }).click()
  await expect(list.locator('.startlist-group h3')).toHaveText([/Brno Barbell/])
  await expect(list).toContainText('Silný Tom')
})
