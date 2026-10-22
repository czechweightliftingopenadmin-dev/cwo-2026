import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { teamSize, universities } from '../../config/registration'
import { registerAthletes } from '../../lib/registration/api'
import type { ClientErrorCode } from '../../lib/registration/api'
import { formatBirthDate, kg } from '../../lib/registration/format'
import { registrationSchema, toFieldIssues } from '../../lib/registration/schema'
import type { CreatedRegistration } from '../../lib/registration/types'
import { AthleteFields } from './AthleteFields'
import {
  emptyAthlete,
  emptyDraft,
  loadDraft,
  needsInvoice,
  normaliseBirthDate,
  saveDraft,
  toInput,
  withKind,
} from './draft'
import type { AthleteDraft, Draft } from './draft'
import {
  Choice,
  Field,
  FieldError,
  fieldId,
  focusFirstError,
  toErrors,
  useErrorText,
} from './fields'
import type { Errors } from './fields'

type Phase = 'form' | 'review' | 'done'

export function RegistrationForm() {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [errors, setErrors] = useState<Errors>({})
  const [phase, setPhase] = useState<Phase>('form')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<ClientErrorCode | null>(null)
  const [result, setResult] = useState<CreatedRegistration | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const errorCount = Object.keys(errors).length
  const isTeam = draft.kind === 'team'

  useEffect(() => {
    if (phase !== 'done') saveDraft(draft)
  }, [draft, phase])

  function showPhase(next: Phase) {
    setPhase(next)
    requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true })
      headingRef.current?.scrollIntoView({ block: 'start' })
    })
  }

  function showErrors(next: Errors) {
    setErrors(next)
    setPhase('form')
    requestAnimationFrame(() => focusFirstError(next, summaryRef.current))
  }

  function clearErrors(...paths: string[]) {
    if (paths.some((path) => errors[path]))
      setErrors((current) => {
        const next = { ...current }
        for (const path of paths) delete next[path]
        return next
      })
  }

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }))
    clearErrors(...Object.keys(patch))
  }

  function updateAthlete(index: number, patch: Partial<AthleteDraft>) {
    setDraft((current) => ({
      ...current,
      athletes: current.athletes.map((athlete, i) =>
        i === index ? { ...athlete, ...patch } : athlete,
      ),
    }))
    clearErrors('athletes', ...Object.keys(patch).map((key) => `athletes.${index}.${key}`))
  }

  function review(e: FormEvent) {
    e.preventDefault()
    const parsed = registrationSchema.safeParse(toInput(draft, i18n.language))
    if (!parsed.success) return showErrors(toErrors(toFieldIssues(parsed.error)))
    setErrors({})
    setSubmitError(null)
    showPhase('review')
  }

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    const response = await registerAthletes({
      ...toInput(draft, i18n.language),
      website: draft.website,
    })
    setSubmitting(false)
    if (response.ok) {
      saveDraft(null)
      setResult(response.data)
      showPhase('done')
    } else if (response.error === 'invoiceFull' || response.error === 'alreadyRegistered') {
      showErrors({ invoiceNumber: response.error })
    } else if (response.error === 'validation' && response.issues?.length) {
      showErrors(toErrors(response.issues))
    } else {
      setSubmitError(response.error)
    }
  }

  function startOver() {
    setDraft(emptyDraft())
    setResult(null)
    showPhase('form')
  }

  if (phase === 'done' && result) {
    return (
      <div className="registration-panel" aria-live="polite">
        <h3 ref={headingRef} tabIndex={-1} className="panel-title">
          {t('registration.doneTitle')}
        </h3>
        <p className="access-code-label">{t('registration.doneCode')}</p>
        <p className="access-code">{result.accessCode}</p>
        <p>
          {result.invoiceNumber
            ? t('registration.doneInvoice', { invoice: result.invoiceNumber })
            : t('registration.doneCodeOnly')}
        </p>
        <p className={result.emailSent ? undefined : 'notice notice-warning'}>
          {result.emailSent ? t('registration.emailSent') : t('registration.emailFailed')}
        </p>
        <button type="button" className="button button-secondary" onClick={startOver}>
          {t('registration.another')}
        </button>
      </div>
    )
  }

  if (phase === 'review') {
    return (
      <div className="registration-panel">
        <h3 ref={headingRef} tabIndex={-1} className="panel-title">
          {t('registration.reviewTitle')}
        </h3>
        <p className="muted-copy">{t('registration.reviewText')}</p>
        <Review draft={draft} />
        {submitError && (
          <p className="notice notice-error" role="alert">
            {errorText(submitError)}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button button-secondary"
            disabled={submitting}
            onClick={() => showPhase('form')}
          >
            {t('registration.back')}
          </button>
          <button type="button" className="button" disabled={submitting} onClick={submit}>
            {submitting ? t('registration.submitting') : t('registration.submit')}
          </button>
        </div>
      </div>
    )
  }

  const [first] = draft.athletes
  return (
    <form className="registration-panel" noValidate onSubmit={review}>
      <h3 ref={headingRef} tabIndex={-1} className="sr-only">
        {t('registration.tabRegister')}
      </h3>
      <div ref={summaryRef} tabIndex={-1} aria-live="polite">
        {errorCount > 0 && (
          <p className="notice notice-error">
            {t('registration.errorSummary', { count: errorCount })}
          </p>
        )}
      </div>
      <div className="form-row">
        <Choice
          name="kind"
          legend={t('registration.kindLabel')}
          value={draft.kind}
          options={[
            { value: 'individual', label: t('registration.individual') },
            { value: 'team', label: t('registration.team') },
          ]}
          onChange={(kind) => {
            setDraft((current) => withKind(current, kind))
            setErrors({})
          }}
        />
        {!isTeam && first && (
          <fieldset className="checks">
            <legend>{t('registration.competitionsLabel')}</legend>
            {(['cwo', 'amcr'] as const).map((competition) => (
              <label key={competition} className="check">
                <input
                  id={competition === 'cwo' ? fieldId('athletes.0.cwo') : undefined}
                  type="checkbox"
                  checked={first[competition]}
                  aria-invalid={errors['athletes.0.cwo'] ? true : undefined}
                  onChange={(e) => {
                    updateAthlete(0, { [competition]: e.target.checked })
                    clearErrors('athletes.0.cwo', 'invoiceNumber')
                  }}
                />
                <span>{t(`registration.${competition}`)}</span>
              </label>
            ))}
            {errors['athletes.0.cwo'] && <FieldError message={errors['athletes.0.cwo']} />}
          </fieldset>
        )}
      </div>
      <div className="field-grid">
        {isTeam && (
          <Field
            path="teamName"
            label={t('registration.teamName')}
            hint={t('registration.teamHint')}
            error={errors.teamName}
          >
            {(props) => (
              <input
                {...props}
                value={draft.teamName}
                onChange={(e) => update({ teamName: e.target.value })}
              />
            )}
          </Field>
        )}
        {needsInvoice(draft) && (
          <Field
            path="invoiceNumber"
            label={t('registration.invoiceNumber')}
            hint={t('registration.invoiceHint')}
            error={errors.invoiceNumber}
          >
            {(props) => (
              <input
                {...props}
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                value={draft.invoiceNumber}
                onChange={(e) => update({ invoiceNumber: e.target.value })}
              />
            )}
          </Field>
        )}
      </div>
      <div
        className="athlete-list"
        data-layout={draft.kind}
        style={{ '--columns': draft.athletes.length } as CSSProperties}
      >
        {draft.athletes.map((athlete, index) => (
          <AthleteFields
            key={index}
            index={index}
            title={
              !isTeam
                ? t('registration.athlete')
                : index === 0
                  ? t('registration.captain')
                  : t('registration.member', { number: index + 1 })
            }
            athlete={athlete}
            isTeam={isTeam}
            errors={errors}
            onChange={(patch) => updateAthlete(index, patch)}
          />
        ))}
      </div>
      {isTeam && (
        <div className="form-actions">
          {draft.athletes.length < teamSize.max ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => update({ athletes: [...draft.athletes, emptyAthlete()] })}
            >
              {t('registration.addMember')}
            </button>
          ) : (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => update({ athletes: draft.athletes.slice(0, teamSize.min) })}
            >
              {t('registration.removeMember')}
            </button>
          )}
          {errors.athletes && <FieldError message={errors.athletes} />}
        </div>
      )}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="registration-website">{t('registration.website')}</label>
        <input
          id="registration-website"
          tabIndex={-1}
          autoComplete="off"
          value={draft.website}
          onChange={(e) => update({ website: e.target.value })}
        />
      </div>
      <label className="check consent">
        <input
          id={fieldId('consent')}
          type="checkbox"
          checked={draft.consent}
          aria-invalid={errors.consent ? true : undefined}
          onChange={(e) => update({ consent: e.target.checked })}
        />
        <span>{t('registration.consent')}</span>
      </label>
      {errors.consent && <FieldError message={errors.consent} />}
      <div className="form-actions">
        <button type="submit" className="button">
          {t('registration.continue')}
        </button>
      </div>
    </form>
  )
}

function Review({ draft }: { draft: Draft }) {
  const { t, i18n } = useTranslation()
  const input = toInput(draft, i18n.language)
  return (
    <div className="review">
      <dl className="review-list">
        <div>
          <dt>{t('registration.kindLabel')}</dt>
          <dd>{t(`registration.${draft.kind}`)}</dd>
        </div>
        {input.teamName && (
          <div>
            <dt>{t('registration.teamName')}</dt>
            <dd>{input.teamName.trim()}</dd>
          </div>
        )}
        {input.invoiceNumber && (
          <div>
            <dt>{t('registration.invoiceNumber')}</dt>
            <dd>{input.invoiceNumber}</dd>
          </div>
        )}
      </dl>
      {draft.athletes.map((athlete, index) => {
        const university = universities.find((item) => item.code === athlete.university)
        const rows: [string, string][] = [
          [
            t('registration.birthDate'),
            formatBirthDate(normaliseBirthDate(athlete.birthDate), i18n.language),
          ],
          [
            t('registration.sex'),
            t(athlete.sex === 'F' ? 'registration.female' : 'registration.male'),
          ],
          [t('registration.weightClass'), kg(athlete.weightClass)],
          [t('registration.total'), kg(athlete.total)],
          [t('registration.email'), athlete.email.trim().toLowerCase()],
          [t('registration.phone'), athlete.phone.trim()],
          [
            t('registration.competitionsLabel'),
            [athlete.cwo && 'CWO', athlete.amcr && 'AM ČR'].filter(Boolean).join(' + '),
          ],
        ]
        if (athlete.cwo) rows.push([t('registration.tshirtSize'), athlete.tshirtSize])
        if (athlete.amcr && university) rows.push([t('registration.university'), university.name])
        return (
          <section
            key={index}
            className="review-athlete"
            data-sex={athlete.sex}
            aria-label={`${athlete.firstName} ${athlete.lastName}`}
          >
            <h4>
              {athlete.firstName.trim()} {athlete.lastName.trim()}
            </h4>
            <dl className="review-list">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}
