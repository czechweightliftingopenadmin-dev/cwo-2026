import { event } from '../../src/config/event.js'
import { registrationWindows, universities } from '../../src/config/registration.js'
import { formatEventDates } from '../../src/lib/countdown.js'
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

/**
 * Links and the background image point at the deployment that sends the e-mail, so dev
 * e-mails open the dev site. SITE_URL overrides both.
 */
function siteOrigin(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_BRANCH_URL)
    return `https://${process.env.VERCEL_BRANCH_URL}`
  return 'https://czechweightliftingopen.cz'
}

const siteUrl = () => `${siteOrigin()}/#registration`

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
  /** Athlete sections take the site's female and male colours. */
  sex?: 'M' | 'F'
}

interface Email {
  language: Language
  subject: string
  intro: string
  /** Shown large near the top, e.g. the registration code. */
  highlight?: [label: string, value: string]
  sections: Section[]
  access: string[]
}

// The site's light theme on a card; around it, the hero's dark violet and artwork.
const colors = {
  page: '#120b20',
  heroInk: '#fff9f1',
  heroMuted: '#d5c5e2',
  lime: '#b2dd80',
  surface: '#f7f5ef',
  surfaceAlt: '#e8e3ee',
  ink: '#22202a',
  muted: '#635c6a',
  line: '#ddd5e3',
  cyan: '#00677d',
  F: { bg: '#f6e3ec', accent: '#a8366f' },
  M: { bg: '#dcedf2', accent: '#00677d' },
}
// Bitcount loads in clients that allow web fonts (Apple Mail, iOS); others fall back.
const sans = 'Inter,Arial,Helvetica,sans-serif'
const display = "'Bitcount Single',Arial,Helvetica,sans-serif"
const mono = "'Bitcount Single','Courier New',Courier,monospace"
const table = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'

function rowsHtml(rows: Rows) {
  const cells = rows.map(([label, value], index) => {
    const divider = index ? `border-top:1px solid ${colors.line};` : ''
    return `<tr>
<td class="label" width="42%" style="padding:8px 12px 8px 0;color:${colors.muted};vertical-align:top;${divider}">${escape(label)}</td>
<td class="value" style="padding:8px 0;color:${colors.ink};font-weight:600;vertical-align:top;word-break:break-word;${divider}">${escape(value)}</td>
</tr>`
  })
  return `<table ${table} style="border-collapse:collapse;font-size:14px;line-height:1.5">
${cells.join('\n')}
</table>`
}

const heading = (text: string, margin = '0 0 6px') =>
  `<p style="margin:${margin};font:500 18px/1.3 ${display};color:${colors.ink}">${escape(text)}</p>`

function sectionHtml(section: Section) {
  const title = section.title ? heading(section.title) : ''
  if (!section.sex)
    return `<tr><td style="padding:0 0 20px">${title}${rowsHtml(section.rows)}</td></tr>`
  const { bg, accent } = colors[section.sex]
  return `<tr><td style="padding:0 0 16px">
<table ${table} bgcolor="${bg}" style="background-color:${bg};border-top:4px solid ${accent}">
<tr><td style="padding:16px 18px 10px">${title}${rowsHtml(section.rows)}</td></tr>
</table>
</td></tr>`
}

function render({ language, subject, intro, highlight, sections, access }: Email) {
  const t = copy[language]
  const origin = siteOrigin()
  const background = escape(`${origin}/email/background.jpg`)
  const when = [
    event.dates && formatEventDates(event.dates, language),
    event.venue[language],
    event.city,
  ]
    .filter(Boolean)
    .join(' · ')
  const preheader = highlight ? `${highlight[0]}: ${highlight[1]}` : intro
  const highlightHtml = highlight
    ? `<table ${table} bgcolor="${colors.surfaceAlt}" style="background-color:${colors.surfaceAlt};border-left:4px solid ${colors.cyan};margin:0 0 28px">
<tr><td style="padding:16px 20px">
<p style="margin:0 0 4px;font:400 13px/1.4 ${sans};color:${colors.muted}">${escape(highlight[0])}</p>
<p style="margin:0;font:600 32px/1.15 ${mono};letter-spacing:0.06em;color:${colors.cyan}">${escape(highlight[1])}</p>
</td></tr>
</table>`
    : ''

  // Tables and inline styles, because that is what e-mail clients render reliably.
  // Clients without background images (Outlook on Windows) show the solid violet.
  const html = `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escape(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bitcount+Single&amp;family=Inter:wght@400;600;700&amp;display=swap" rel="stylesheet" />
<style>
@media (max-width: 620px) {
  .frame { padding: 28px 10px 16px !important; }
  .masthead { padding: 0 10px 72px !important; }
  .card { padding: 26px 20px !important; }
  .label, .value { display: block !important; width: auto !important; }
  .label { padding-bottom: 0 !important; }
  .value { padding-top: 2px !important; border-top: 0 !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${colors.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(preheader)}</div>
<table ${table} bgcolor="${colors.page}" style="background-color:${colors.page}">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td class="frame" background="${background}" bgcolor="${colors.page}" style="padding:44px 16px 24px;background-color:${colors.page};background-image:url('${background}');background-position:center top;background-size:100% auto;background-repeat:no-repeat;font-family:${sans}">

<table ${table}>
<tr><td class="masthead" style="padding:0 16px 132px;color:${colors.heroInk}">
<p style="margin:0 0 18px;font:600 11px/1 ${sans};letter-spacing:0.12em;text-transform:uppercase;color:${colors.lime}">CWO ${event.year}</p>
<p style="margin:0;font:500 30px/1.1 ${display};letter-spacing:-0.02em;color:${colors.heroInk}">${escape(event.name.toUpperCase())}</p>
<p style="margin:14px 0 0;font:400 14px/1.5 ${sans};color:${colors.heroMuted}">${escape(when)}</p>
</td></tr>
</table>

<table ${table} bgcolor="${colors.surface}" style="background-color:${colors.surface}">
<tr><td class="card" style="padding:36px 32px 32px;color:${colors.ink};font:400 15px/1.6 ${sans}">
<h1 style="margin:0 0 18px;font:500 26px/1.2 ${display};color:${colors.ink}">${escape(subject)}</h1>
<p style="margin:0 0 24px">${escape(t.greeting)},<br />${escape(intro)}</p>
${highlightHtml}
<table ${table}>
${sections.map(sectionHtml).join('\n')}
</table>
${heading(t.accessTitle, '12px 0 6px')}
${access.map((line) => `<p style="margin:0 0 10px">${escape(line)}</p>`).join('\n')}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 28px">
<tr><td bgcolor="${colors.cyan}" style="background-color:${colors.cyan};border-radius:3px">
<a href="${escape(siteUrl())}" style="display:inline-block;padding:13px 22px;font:700 15px/1 ${sans};color:#ffffff;text-decoration:none">${escape(t.linkLabel)} &rarr;</a>
</td></tr>
</table>
<p style="margin:0">${escape(t.signature)}</p>
</td></tr>
</table>

<p style="margin:0;padding:22px 16px 0;font:400 12px/1.6 ${sans};color:${colors.heroMuted}">
${escape(`${event.name} ${event.year} · ${event.venue[language]}, ${event.address}`)}<br />
<a href="${escape(origin)}" style="color:${colors.heroMuted}">${escape(origin.replace(/^https?:\/\//, ''))}</a>
</p>

</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
  const text = [
    `${t.greeting},`,
    intro,
    ...(highlight ? ['', `${highlight[0]}: ${highlight[1]}`] : []),
    ...sections.flatMap((section) => [
      '',
      ...(section.title ? [section.title.toUpperCase()] : []),
      ...section.rows.map(([label, value]) => `${label}: ${value}`),
    ]),
    '',
    t.accessTitle.toUpperCase(),
    ...access,
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
    return { title: `${athlete.firstName} ${athlete.lastName}`, rows, sex: athlete.sex }
  })

  return {
    to: recipients(registration.athletes),
    ...render({
      language,
      subject: t.registrationSubject,
      intro: t.registrationIntro,
      highlight: [t.accessCode, accessCode],
      sections: [{ rows: summary }, ...athletes],
      access: accessFooter(language, registration.invoiceNumber, accessCode),
    }),
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
    return { title: `${before.firstName} ${before.lastName}`, rows, sex: before.sex }
  })
  const summary: Rows = []
  if (registration.teamName) summary.push([t.teamName, registration.teamName])
  if (registration.invoiceNumber) summary.push([t.invoiceNumber, registration.invoiceNumber])
  else summary.push([t.accessCode, registration.accessCode])

  return {
    to: recipients(registration.athletes),
    ...render({
      language,
      subject: t.updateSubject,
      intro: t.updateIntro,
      sections: [{ rows: summary }, ...sections],
      access: accessFooter(language, registration.invoiceNumber, registration.accessCode),
    }),
  }
}

function recipients(athletes: { email: string }[]): string[] {
  return [...new Set(athletes.map((athlete) => athlete.email))]
}
