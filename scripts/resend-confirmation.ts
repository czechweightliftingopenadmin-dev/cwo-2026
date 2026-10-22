// Sends the registration confirmation again, e.g. after a failed e-mail in email_log or a
// correction made in the dashboard. Each e-mail goes to every athlete in its registration.
//   npm run email:resend -- 12345678        (every registration on the invoice)
//   npm run email:resend -- AM-ABCD-EFGH    (one registration, by its code)
// Reads SUPABASE_URL, SUPABASE_SECRET_KEY and RESEND_API_KEY from .env.local, which points
// at cwo-dev; for production, run it with the cwo-prod values instead.
import { createClient } from '@supabase/supabase-js'
import { parseIdentifier } from '../src/lib/registration/schema.js'
import type { Registration } from '../src/lib/registration/schema.js'
import { createResendMailer } from '../api/_lib/mailer.js'
import { registrationEmail } from '../api/_lib/templates.js'

const identifier = parseIdentifier(process.argv[2] ?? '')
if (!identifier) {
  console.error('Give an invoice number or a registration code.')
  process.exit(1)
}

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
})
const column = 'invoiceNumber' in identifier ? 'invoice_number' : 'access_code'
const value = 'invoiceNumber' in identifier ? identifier.invoiceNumber : identifier.accessCode
const { data: rows, error } = await db
  .from('registrations')
  .select('*, athletes(*)')
  .eq(column, value)
  .eq('status', 'active')
  .order('created_at')
  .order('position', { referencedTable: 'athletes' })
if (error) throw error
if (!rows?.length) {
  console.error('No active registration found.')
  process.exit(1)
}

const mailer = createResendMailer()
for (const row of rows) {
  const registration: Registration = {
    kind: row.kind,
    teamName: row.team_name,
    invoiceNumber: row.invoice_number,
    consent: true,
    language: row.language,
    athletes: row.athletes.map((athlete: Record<string, never>) => ({
      firstName: athlete.first_name,
      lastName: athlete.last_name,
      birthDate: athlete.birth_date,
      sex: athlete.sex,
      weightClass: athlete.weight_class,
      total: athlete.total,
      email: athlete.email,
      phone: athlete.phone,
      tshirtSize: athlete.tshirt_size,
      cwo: athlete.cwo,
      amcr: athlete.amcr,
      university: athlete.university,
    })),
  }
  const message = registrationEmail(registration, row.access_code)
  try {
    const providerId = await mailer.send(message)
    await db.from('email_log').insert({
      registration_id: row.id,
      kind: 'registration',
      recipients: message.to,
      status: 'sent',
      provider_id: providerId,
    })
    console.log(`${row.access_code}: sent to ${message.to.join(', ')}`)
  } catch (sendError) {
    console.error(`${row.access_code}: sending failed`, sendError)
    process.exitCode = 1
  }
}
