import { Resend } from 'resend'
import { emailSettings } from '../../src/config/registration.js'

export interface EmailMessage {
  to: string[]
  subject: string
  html: string
  text: string
}

export interface Mailer {
  /** Resolves with the provider's message id. */
  send(message: EmailMessage): Promise<string>
}

// Sending lives here only, so another provider (e.g. SMTP) replaces this one function.
export function createResendMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY
  // EMAIL_FROM overrides the sender until the domain is verified (onboarding@resend.dev).
  const from = process.env.EMAIL_FROM || emailSettings.from
  const replyTo = emailSettings.replyTo
  const resend = apiKey ? new Resend(apiKey) : null

  return {
    async send(message) {
      if (!resend) throw new Error('E-mail is not configured (RESEND_API_KEY)')
      const { data, error } = await resend.emails.send({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(replyTo ? { replyTo } : {}),
      })
      if (error || !data) throw new Error(error?.message ?? 'Resend returned no message id')
      return data.id
    },
  }
}
