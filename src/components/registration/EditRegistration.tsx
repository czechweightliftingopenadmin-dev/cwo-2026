import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { registrationWindows } from '../../config/registration'
import { lookupRegistration, updateRegistration } from '../../lib/registration/api'
import type { ClientErrorCode } from '../../lib/registration/api'
import { formatDay, kg } from '../../lib/registration/format'
import {
  lookupSchema,
  toFieldIssues,
  updateSchema,
  weightClassesFor,
} from '../../lib/registration/schema'
import type { EditableRegistration, UpdatedRegistration } from '../../lib/registration/types'
import { Field, focusFirstError, toErrors, useErrorText } from './fields'
import type { Errors } from './fields'
import { Select } from './Select'

type Values = Record<string, { weightClass: string; total: string }>

const athletesOf = (registrations: EditableRegistration[]) =>
  registrations.flatMap((registration) => registration.athletes)

export function EditRegistration() {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [requestError, setRequestError] = useState<ClientErrorCode | null>(null)
  // One invoice can hold several registrations, e.g. individuals from one club.
  const [registrations, setRegistrations] = useState<EditableRegistration[] | null>(null)
  const [values, setValues] = useState<Values>({})
  const [result, setResult] = useState<UpdatedRegistration | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const credentials = { identifier, email, language: i18n.language === 'en' ? 'en' : 'cs' } as const

  const groupTitle = (registration: EditableRegistration) =>
    registration.teamName ?? t(`registration.${registration.kind}`)

  function focusHeading() {
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  async function find(e: FormEvent) {
    e.preventDefault()
    setRequestError(null)
    const parsed = lookupSchema.safeParse(credentials)
    if (!parsed.success) {
      const next = toErrors(toFieldIssues(parsed.error))
      setErrors(next)
      requestAnimationFrame(() => focusFirstError(next))
      return
    }
    setErrors({})
    setBusy(true)
    const response = await lookupRegistration(credentials)
    setBusy(false)
    if (!response.ok) return setRequestError(response.error)
    setRegistrations(response.data.registrations)
    setValues(
      Object.fromEntries(
        athletesOf(response.data.registrations).map((athlete) => [
          athlete.id,
          { weightClass: athlete.weightClass, total: String(athlete.total) },
        ]),
      ),
    )
    focusHeading()
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!registrations) return
    setRequestError(null)
    const body = {
      ...credentials,
      changes: athletesOf(registrations).map((athlete) => ({
        athleteId: athlete.id,
        weightClass: values[athlete.id]!.weightClass,
        total: values[athlete.id]!.total.trim() === '' ? NaN : Number(values[athlete.id]!.total),
      })),
    }
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      const next = toErrors(toFieldIssues(parsed.error))
      setErrors(next)
      requestAnimationFrame(() => focusFirstError(next))
      return
    }
    setErrors({})
    setBusy(true)
    const response = await updateRegistration(body)
    setBusy(false)
    if (!response.ok) {
      if (response.issues) setErrors(toErrors(response.issues))
      return setRequestError(response.error)
    }
    setResult(response.data)
    focusHeading()
  }

  function reset() {
    setRegistrations(null)
    setResult(null)
    setIdentifier('')
    setEmail('')
    focusHeading()
  }

  const notice = requestError && (
    <p className="notice notice-error" role="alert">
      {errorText(requestError)}
    </p>
  )

  if (registrations && result) {
    return (
      <div className="registration-panel" aria-live="polite">
        <h3 ref={headingRef} tabIndex={-1} className="panel-title">
          {result.changed === 0
            ? t('edit.unchanged')
            : result.emailSent
              ? t('edit.saved')
              : t('edit.savedNoEmail')}
        </h3>
        <button type="button" className="button button-secondary" onClick={reset}>
          {t('edit.another')}
        </button>
      </div>
    )
  }

  if (registrations) {
    // Field paths follow the order of `changes`, i.e. all athletes in sequence.
    let index = 0
    const single = registrations.length === 1
    return (
      <form className="registration-panel" noValidate onSubmit={save}>
        <h3 ref={headingRef} tabIndex={-1} className="panel-title">
          {single ? groupTitle(registrations[0]!) : t('edit.found')}
        </h3>
        {registrations.map((registration, group) => (
          <div key={group} className="edit-group">
            {!single && <h4 className="edit-group-title">{groupTitle(registration)}</h4>}
            <div className="athlete-list" data-layout="team">
              {registration.athletes.map((athlete) => {
                const path = `changes.${index++}`
                return (
                  <fieldset key={athlete.id} className="athlete-card" data-sex={athlete.sex}>
                    <legend>
                      {athlete.firstName} {athlete.lastName}
                    </legend>
                    <div className="field-grid">
                      <Field
                        path={`${path}.weightClass`}
                        label={t('registration.weightClass')}
                        error={errors[`${path}.weightClass`]}
                      >
                        {(props) => (
                          <Select
                            {...props}
                            value={values[athlete.id]!.weightClass}
                            options={weightClassesFor(athlete.sex).map((value) => ({
                              value,
                              label: kg(value),
                            }))}
                            onChange={(weightClass) =>
                              setValues({
                                ...values,
                                [athlete.id]: { ...values[athlete.id]!, weightClass },
                              })
                            }
                          />
                        )}
                      </Field>
                      <Field
                        path={`${path}.total`}
                        label={t('registration.total')}
                        error={errors[`${path}.total`]}
                      >
                        {(props) => (
                          <input
                            {...props}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={500}
                            step={1}
                            value={values[athlete.id]!.total}
                            onChange={(e) =>
                              setValues({
                                ...values,
                                [athlete.id]: { ...values[athlete.id]!, total: e.target.value },
                              })
                            }
                          />
                        )}
                      </Field>
                    </div>
                  </fieldset>
                )
              })}
            </div>
          </div>
        ))}
        {notice}
        <div className="form-actions">
          <button type="button" className="button button-secondary" disabled={busy} onClick={reset}>
            {t('edit.cancel')}
          </button>
          <button type="submit" className="button" disabled={busy}>
            {busy ? t('edit.saving') : t('edit.save')}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form className="registration-panel" noValidate onSubmit={find}>
      <h3 ref={headingRef} tabIndex={-1} className="sr-only">
        {t('registration.tabEdit')}
      </h3>
      <p className="panel-intro">
        {t('edit.intro', {
          date: formatDay(registrationWindows.edits.closesAt, i18n.language, true),
        })}
      </p>
      <div className="field-grid">
        <Field path="identifier" label={t('edit.identifier')} error={errors.identifier}>
          {(props) => (
            <input
              {...props}
              autoComplete="off"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          )}
        </Field>
        <Field path="email" label={t('edit.email')} error={errors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
      </div>
      {notice}
      <div className="form-actions">
        <button type="submit" className="button" disabled={busy}>
          {busy ? t('edit.finding') : t('edit.find')}
        </button>
      </div>
    </form>
  )
}
