import { useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { registrationWindows, tshirtSizes, universities } from '../../config/registration'
import { lookupRegistration, updateRegistration } from '../../lib/registration/api'
import type { ClientErrorCode } from '../../lib/registration/api'
import { formatDay, kg } from '../../lib/registration/format'
import {
  lookupSchema,
  toFieldIssues,
  updateSchema,
  weightClassesFor,
} from '../../lib/registration/schema'
import type {
  EditableRegistration,
  LookupResult,
  UpdatedRegistration,
} from '../../lib/registration/types'
import { Field, focusFirstError, toErrors, useErrorText, useRevealOnChange } from './fields'
import type { Errors } from './fields'
import { Select } from './Select'

interface AthleteValues {
  weightClass: string
  total: string
  cwo: boolean
  amcr: boolean
  invoiceNumber: string
  tshirtSize: string
  university: string
}
type Values = Record<string, AthleteValues>

export function EditRegistration() {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [requestError, setRequestError] = useState<ClientErrorCode | null>(null)
  const [lookup, setLookup] = useState<LookupResult | null>(null)
  const [values, setValues] = useState<Values>({})
  const [result, setResult] = useState<UpdatedRegistration | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const credentials = { identifier, email, language: i18n.language === 'en' ? 'en' : 'cs' } as const
  const groupTitle = (registration: EditableRegistration) =>
    registration.teamName ?? t(`registration.${registration.kind}`)
  const day = (iso: string, end = false) => formatDay(iso, i18n.language, end)
  useRevealOnChange(result ? 'result' : lookup ? 'edit' : 'find', headingRef)

  function showIssues(issues: { path: string; message: string }[]) {
    const next = toErrors(issues)
    setErrors(next)
    requestAnimationFrame(() => focusFirstError(next, summaryRef.current))
  }
  function changeValue(id: string, patch: Partial<AthleteValues>) {
    setValues((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }))
    const index = lookup?.registrations
      .flatMap((registration) => registration.athletes)
      .findIndex((athlete) => athlete.id === id)
    const changedPaths = Object.keys(patch)
      .flatMap((key) => {
        if (key === 'cwo') return ['addCwo']
        if (key === 'amcr') return ['addAmcr']
        if (key === 'invoiceNumber') return ['addCwo.invoiceNumber']
        if (key === 'tshirtSize') return ['tshirtSize', 'addCwo.tshirtSize']
        if (key === 'university') return ['university', 'addAmcr.university']
        return [key]
      })
      .map((path) => `changes.${index}.${path}`)
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([path]) =>
            !changedPaths.some((changed) => path === changed || path.startsWith(`${changed}.`)),
        ),
      ),
    )
    setRequestError(null)
  }
  async function find(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setRequestError(null)
    const parsed = lookupSchema.safeParse(credentials)
    if (!parsed.success) return showIssues(toFieldIssues(parsed.error))
    setErrors({})
    setBusy(true)
    const response = await lookupRegistration(parsed.data)
    setBusy(false)
    if (!response.ok) return setRequestError(response.error)
    setLookup(response.data)
    setValues(
      Object.fromEntries(
        response.data.registrations.flatMap((registration) =>
          registration.athletes.map((athlete) => [
            athlete.id,
            {
              weightClass: athlete.weightClass,
              total: String(athlete.total),
              cwo: athlete.cwo,
              amcr: athlete.amcr,
              invoiceNumber: registration.invoiceNumber ?? '',
              tshirtSize: athlete.tshirtSize ?? '',
              university: athlete.university ?? '',
            },
          ]),
        ),
      ),
    )
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!lookup || busy) return
    setRequestError(null)
    const body = {
      ...credentials,
      changes: lookup.registrations.flatMap((registration) =>
        registration.athletes.map((athlete) => {
          const value = values[athlete.id]!
          const resultsChanged =
            lookup.permissions.results &&
            (value.weightClass !== athlete.weightClass ||
              value.total.trim() !== String(athlete.total))
          return {
            athleteId: athlete.id,
            ...(resultsChanged
              ? {
                  weightClass: value.weightClass,
                  total: value.total.trim() === '' ? NaN : Number(value.total),
                }
              : {}),
            ...(!athlete.cwo && value.cwo
              ? {
                  addCwo: {
                    invoiceNumber: value.invoiceNumber.replace(/\s/g, ''),
                    tshirtSize: value.tshirtSize,
                  },
                }
              : {}),
            ...(!athlete.amcr && value.amcr ? { addAmcr: { university: value.university } } : {}),
            ...(athlete.cwo && value.tshirtSize !== (athlete.tshirtSize ?? '')
              ? { tshirtSize: value.tshirtSize }
              : {}),
            ...(athlete.amcr && value.university !== (athlete.university ?? '')
              ? { university: value.university }
              : {}),
          }
        }),
      ),
    }
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return showIssues(toFieldIssues(parsed.error))
    setErrors({})
    setBusy(true)
    const response = await updateRegistration(parsed.data)
    setBusy(false)
    if (!response.ok) {
      if (response.issues) showIssues(response.issues)
      return setRequestError(response.error)
    }
    setResult(response.data)
  }
  function reset() {
    setLookup(null)
    setResult(null)
    setErrors({})
    setRequestError(null)
    setIdentifier('')
    setEmail('')
  }
  const notice = requestError && (
    <p className="notice notice-error" role="alert">
      {errorText(requestError)}
    </p>
  )
  if (lookup && result)
    return (
      <div key="result" className="registration-panel" aria-live="polite">
        <h3 ref={headingRef} tabIndex={-1} className="panel-title">
          {result.changed === 0 ? t('edit.unchanged') : t('edit.saved')}
        </h3>
        {result.changed > 0 && (
          <p className={result.emailSent ? undefined : 'notice notice-warning'}>
            {result.emailSent ? t('edit.emailSent') : t('edit.emailFailed')}
          </p>
        )}
        <button type="button" className="button button-secondary" onClick={reset}>
          {t('edit.another')}
        </button>
      </div>
    )
  if (lookup) {
    let index = 0
    const single = lookup.registrations.length === 1
    return (
      <form key="edit" className="registration-panel" noValidate onSubmit={save}>
        <h3 ref={headingRef} tabIndex={-1} className="panel-title">
          {single ? groupTitle(lookup.registrations[0]!) : t('edit.found')}
        </h3>
        <p className="panel-intro">{t('edit.participationHint')}</p>
        {!lookup.permissions.results && (
          <p className="notice">
            {t('edit.resultsWindow', {
              from: day(registrationWindows.edits.opensAt),
              to: day(registrationWindows.edits.closesAt, true),
            })}
          </p>
        )}
        {!lookup.permissions.competitions && <p className="notice">{t('edit.detailsClosed')}</p>}
        {lookup.registrations.map((registration, group) => (
          <div key={group} className="edit-group">
            {!single && <h4 className="edit-group-title">{groupTitle(registration)}</h4>}
            {registration.invoiceNumber && (
              <p className="window-note">
                {t('registration.invoiceNumber')}: {registration.invoiceNumber}
              </p>
            )}
            <div
              className="athlete-list"
              data-layout={registration.athletes.length === 1 ? 'individual' : 'team'}
              style={{ '--columns': registration.athletes.length } as CSSProperties}
            >
              {registration.athletes.map((athlete) => {
                const path = `changes.${index++}`
                const value = values[athlete.id]!
                const tshirtPath = `${path}.${athlete.cwo ? 'tshirtSize' : 'addCwo.tshirtSize'}`
                const universityPath = `${path}.${athlete.amcr ? 'university' : 'addAmcr.university'}`
                return (
                  <fieldset
                    key={athlete.id}
                    className="athlete-card"
                    data-sex={athlete.sex}
                    disabled={busy}
                  >
                    <legend>
                      {athlete.firstName} {athlete.lastName}
                    </legend>
                    <fieldset className="checks">
                      <legend>{t('registration.competitionsLabel')}</legend>
                      {(['cwo', 'amcr'] as const).map((competition) => (
                        <label key={competition} className="check">
                          <input
                            type="checkbox"
                            checked={value[competition]}
                            disabled={athlete[competition] || !lookup.permissions.competitions}
                            onChange={(e) =>
                              changeValue(athlete.id, { [competition]: e.target.checked })
                            }
                          />
                          <span>{t(`registration.${competition}`)}</span>
                        </label>
                      ))}
                    </fieldset>
                    <fieldset
                      className="field-grid edit-competition-fields"
                      disabled={!lookup.permissions.competitions}
                    >
                      {value.cwo && !athlete.cwo && (
                        <Field
                          path={`${path}.addCwo.invoiceNumber`}
                          label={t('registration.invoiceNumber')}
                          hint={t('edit.invoiceHint')}
                          error={errors[`${path}.addCwo.invoiceNumber`]}
                        >
                          {(props) => (
                            <input
                              {...props}
                              inputMode="numeric"
                              autoComplete="off"
                              value={value.invoiceNumber}
                              onChange={(e) =>
                                changeValue(athlete.id, { invoiceNumber: e.target.value })
                              }
                            />
                          )}
                        </Field>
                      )}
                      {value.cwo && (
                        <Field
                          path={tshirtPath}
                          label={t('registration.tshirtSize')}
                          error={errors[tshirtPath]}
                        >
                          {(props) => (
                            <Select
                              {...props}
                              value={value.tshirtSize}
                              placeholder={t('registration.choose')}
                              options={tshirtSizes.map((size) => ({ value: size, label: size }))}
                              onChange={(tshirtSize) => changeValue(athlete.id, { tshirtSize })}
                            />
                          )}
                        </Field>
                      )}
                      {value.amcr && (
                        <Field
                          path={universityPath}
                          label={t('registration.university')}
                          error={errors[universityPath]}
                        >
                          {(props) => (
                            <Select
                              {...props}
                              value={value.university}
                              placeholder={t('registration.choose')}
                              options={universities.map((university) => ({
                                value: university.code,
                                label: university.name,
                              }))}
                              onChange={(university) => changeValue(athlete.id, { university })}
                            />
                          )}
                        </Field>
                      )}
                    </fieldset>
                    {lookup.permissions.results ? (
                      <div className="field-grid">
                        <Field
                          path={`${path}.weightClass`}
                          label={t('registration.weightClass')}
                          error={errors[`${path}.weightClass`]}
                        >
                          {(props) => (
                            <Select
                              {...props}
                              value={value.weightClass}
                              options={weightClassesFor(athlete.sex).map((weightClass) => ({
                                value: weightClass,
                                label: kg(weightClass),
                              }))}
                              onChange={(weightClass) => changeValue(athlete.id, { weightClass })}
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
                              value={value.total}
                              onChange={(e) => changeValue(athlete.id, { total: e.target.value })}
                            />
                          )}
                        </Field>
                      </div>
                    ) : (
                      <p className="window-note">
                        {t('registration.weightClass')}: {kg(athlete.weightClass)} ·{' '}
                        {t('registration.total')}: {athlete.total}
                      </p>
                    )}
                  </fieldset>
                )
              })}
            </div>
          </div>
        ))}
        <div ref={summaryRef} tabIndex={-1} aria-live="polite">
          {Object.keys(errors).length > 0 && (
            <p className="notice notice-error">
              {t('registration.errorSummary', { count: Object.keys(errors).length })}
            </p>
          )}
        </div>
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
    <form key="find" className="registration-panel" noValidate onSubmit={find}>
      <h3 ref={headingRef} tabIndex={-1} className="sr-only">
        {t('registration.tabEdit')}
      </h3>
      <p className="panel-intro">
        {t('edit.intro', { date: day(registrationWindows.registration.closesAt, true) })}
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
