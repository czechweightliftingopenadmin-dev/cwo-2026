import { registrationWindows, universities } from '../../src/config/registration.js'
import type { Registration } from '../../src/lib/registration/schema.js'
import type { EmailMessage } from './mailer.js'
import type { StoredAthlete, StoredRegistration } from './store.js'

type Language = 'cs' | 'en'

const copy = {
  cs: {
    registrationSubject: 'Potvrzení registrace CWO 2026',
    updateSubject: 'Změna registrace CWO 2026',
    registrationIntro:
      'děkujeme za registraci na Czech Weightlifting Open 2026. Níže najdeš údaje, které jsme uložili. Zkontroluj je prosím.',
    updateIntro:
      'v registraci na Czech Weightlifting Open 2026 proběhla změna. Pokud o změně nevíš, odpověz prosím na tento e-mail.',
    greeting: 'Ahoj',
    accessTitle: 'Přístup ke změnám',
    access: (identifier: string, opens: string, closes: string) =>
      `Od ${opens} do ${closes} můžeš na webu změnit hmotnostní kategorii a dvojboj. Zadej ${identifier} a e-mail, na který přišla tato zpráva.`,
    invoiceIdentifier: (invoice: string) => `číslo faktury ${invoice}`,
    codeIdentifier: (code: string) => `kód registrace ${code}`,
    otherChanges: 'Jiné změny ti zařídí organizátoři, stačí odpovědět na tento e-mail.',
    signature: 'Tým CWO',
    kind: 'Typ registrace',
    individual: 'Jednotlivec',
    team: 'Tým',
    teamName: 'Název týmu',
    invoiceNumber: 'Číslo faktury',
    accessCode: 'Kód registrace',
    name: 'Jméno',
    birthDate: 'Datum narození',
    sex: 'Pohlaví',
    M: 'Muž',
    F: 'Žena',
    weightClass: 'Hmotnostní kategorie',
    total: 'Dvojboj',
    email: 'E-mail',
    phone: 'Telefon',
    tshirtSize: 'Tričko',
    competitions: 'Soutěž',
    university: 'Škola',
    linkLabel: 'Registrace na webu',
  },
  en: {
    registrationSubject: 'CWO 2026 registration confirmation',
    updateSubject: 'CWO 2026 registration change',
    registrationIntro:
      'thank you for registering for Czech Weightlifting Open 2026. Below are the details we saved. Please check them.',
    updateIntro:
      'your Czech Weightlifting Open 2026 registration has been changed. If you did not make this change, please reply to this e-mail.',
    greeting: 'Hi',
    accessTitle: 'Making changes',
    access: (identifier: string, opens: string, closes: string) =>
      `From ${opens} to ${closes}, you can change your bodyweight category and total on the website. Enter ${identifier} and the e-mail address this message was sent to.`,
    invoiceIdentifier: (invoice: string) => `invoice number ${invoice}`,
    codeIdentifier: (code: string) => `registration code ${code}`,
    otherChanges: 'For any other change, reply to this e-mail and the organisers will help.',
    signature: 'The CWO team',
    kind: 'Registration type',
    individual: 'Individual',
    team: 'Team',
    teamName: 'Team name',
    invoiceNumber: 'Invoice number',
    accessCode: 'Registration code',
    name: 'Name',
    birthDate: 'Date of birth',
    sex: 'Sex',
    M: 'Male',
    F: 'Female',
    weightClass: 'Bodyweight category',
    total: 'Total',
    email: 'E-mail',
    phone: 'Phone',
    tshirtSize: 'T-shirt',
    competitions: 'Competition',
    university: 'University',
    linkLabel: 'Registration on the website',
  },
} as const

const siteUrl = () => `${process.env.SITE_URL ?? 'https://czechweightliftingopen.cz'}/#registration`

function escape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
}

function formatDate(iso: string, language: Language): string {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  return new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : 'en-GB', {
    day: 'numeric',
    month: language === 'cs' ? 'numeric' : 'long',
    year: iso.length === 10 ? 'numeric' : undefined,
    timeZone: 'Europe/Prague',
  }).format(date)
}

const kg = (weightClass: string) => `${weightClass} kg`

type Rows = [label: string, value: string][]

interface Section {
  title?: string
  rows: Rows
}

function render(
  language: Language,
  subject: string,
  intro: string,
  sections: Section[],
  footer: string[],
) {
  const t = copy[language]
  const htmlSections = sections
    .map(
      (section) => `
      ${section.title ? `<h2 style="font-size:16px;margin:28px 0 8px">${escape(section.title)}</h2>` : ''}
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${section.rows
          .map(
            ([label, value]) => `<tr>
          <td style="padding:6px 12px 6px 0;color:#635c6a;vertical-align:top;width:40%">${escape(label)}</td>
          <td style="padding:6px 0;vertical-align:top"><strong>${escape(value)}</strong></td>
        </tr>`,
          )
          .join('')}
      </table>`,
    )
    .join('')
  const html = `<!doctype html>
<html lang="${language}">
  <body style="margin:0;padding:24px;background:#f7f5ef;color:#22202a;font-family:Arial,Helvetica,sans-serif;line-height:1.6">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:28px;border:1px solid #bfb5ca">
      <p style="margin:0 0 4px;color:#00677d;font-weight:bold;letter-spacing:0.08em">CWO 2026</p>
      <h1 style="font-size:22px;margin:0 0 20px">${escape(subject)}</h1>
      <p>${escape(t.greeting)},<br />${escape(intro)}</p>
      ${htmlSections}
      ${footer.map((line) => `<p style="margin-top:20px">${escape(line)}</p>`).join('')}
      <p style="margin-top:20px"><a href="${escape(siteUrl())}" style="color:#00677d">${escape(t.linkLabel)}</a></p>
      <p style="margin-top:28px">${escape(t.signature)}</p>
    </div>
  </body>
</html>`
  const text = [
    `${t.greeting},`,
    intro,
    ...sections.flatMap((section) => [
      '',
      ...(section.title ? [section.title.toUpperCase()] : []),
      ...section.rows.map(([label, value]) => `${label}: ${value}`),
    ]),
    '',
    ...footer,
    '',
    `${t.linkLabel}: ${siteUrl()}`,
    '',
    t.signature,
  ].join('\n')
  return { subject, html, text }
}

function accessFooter(language: Language, invoiceNumber: string | null, accessCode: string) {
  const t = copy[language]
  const identifier = invoiceNumber
    ? t.invoiceIdentifier(invoiceNumber)
    : t.codeIdentifier(accessCode)
  const closes = new Date(new Date(registrationWindows.edits.closesAt).getTime() - 1)
  return [
    t.access(
      identifier,
      formatDate(registrationWindows.edits.opensAt, language),
      formatDate(closes.toISOString(), language),
    ),
    t.otherChanges,
  ]
}

export function registrationEmail(registration: Registration, accessCode: string): EmailMessage {
  const language = registration.language
  const t = copy[language]
  const summary: Rows = [[t.kind, t[registration.kind]]]
  if (registration.teamName) summary.push([t.teamName, registration.teamName])
  if (registration.invoiceNumber) summary.push([t.invoiceNumber, registration.invoiceNumber])
  summary.push([t.accessCode, accessCode])

  const athletes = registration.athletes.map((athlete): Section => {
    const competitions = [athlete.cwo && 'CWO', athlete.amcr && 'AM ČR'].filter(Boolean).join(' + ')
    const rows: Rows = [
      [t.birthDate, formatDate(athlete.birthDate, language)],
      [t.sex, t[athlete.sex]],
      [t.weightClass, kg(athlete.weightClass)],
      [t.total, kg(String(athlete.total))],
      [t.email, athlete.email],
      [t.phone, athlete.phone],
      [t.competitions, competitions],
    ]
    if (athlete.tshirtSize) rows.push([t.tshirtSize, athlete.tshirtSize])
    if (athlete.university) {
      const university = universities.find((item) => item.code === athlete.university)
      rows.push([t.university, university?.name ?? athlete.university])
    }
    return { title: `${athlete.firstName} ${athlete.lastName}`, rows }
  })

  return {
    to: recipients(registration.athletes),
    ...render(
      language,
      t.registrationSubject,
      t.registrationIntro,
      [{ rows: summary }, ...athletes],
      [...accessFooter(language, registration.invoiceNumber, accessCode)],
    ),
  }
}

export interface AthleteChange {
  before: StoredAthlete
  weightClass: string
  total: number
}

export function updateEmail(
  registration: StoredRegistration,
  changes: AthleteChange[],
  language: Language,
): EmailMessage {
  const t = copy[language]
  const sections = changes.map(({ before, weightClass, total }): Section => {
    const rows: Rows = []
    if (before.weightClass !== weightClass)
      rows.push([t.weightClass, `${kg(before.weightClass)} → ${kg(weightClass)}`])
    if (before.total !== total)
      rows.push([t.total, `${kg(String(before.total))} → ${kg(String(total))}`])
    return { title: `${before.firstName} ${before.lastName}`, rows }
  })
  const summary: Rows = []
  if (registration.teamName) summary.push([t.teamName, registration.teamName])
  if (registration.invoiceNumber) summary.push([t.invoiceNumber, registration.invoiceNumber])
  else summary.push([t.accessCode, registration.accessCode])

  return {
    to: recipients(registration.athletes),
    ...render(
      language,
      t.updateSubject,
      t.updateIntro,
      [{ rows: summary }, ...sections],
      [...accessFooter(language, registration.invoiceNumber, registration.accessCode)],
    ),
  }
}

function recipients(athletes: { email: string }[]): string[] {
  return [...new Set(athletes.map((athlete) => athlete.email))]
}
