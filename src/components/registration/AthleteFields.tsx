import { useTranslation } from 'react-i18next'
import { tshirtSizes, universities } from '../../config/registration'
import { weightClassesFor } from '../../lib/registration/schema'
import type { Sex } from '../../lib/registration/schema'
import { kg } from '../../lib/registration/format'
import { BirthDateField } from './BirthDateField'
import type { AthleteDraft } from './draft'
import { Choice, Field, FieldError, fieldId } from './fields'
import type { Errors } from './fields'
import { Select } from './Select'

interface Props {
  index: number
  title: string
  athlete: AthleteDraft
  isTeam: boolean
  errors: Errors
  onChange: (patch: Partial<AthleteDraft>) => void
}

export function AthleteFields({ index, title, athlete, isTeam, errors, onChange }: Props) {
  const { t } = useTranslation()
  const path = (field: keyof AthleteDraft) => `athletes.${index}.${field}`
  const error = (field: keyof AthleteDraft) => errors[path(field)]
  // Autofill only the first athlete; the others are different people.
  const autoComplete = (token: string) => (index === 0 ? token : 'off')

  return (
    <fieldset className="athlete-card" data-sex={athlete.sex}>
      <legend>{title}</legend>
      <Choice<Sex>
        name={`athlete-${index}-sex`}
        legend={t('registration.sex')}
        value={athlete.sex}
        options={[
          { value: 'F', label: t('registration.female') },
          { value: 'M', label: t('registration.male') },
        ]}
        onChange={(sex) => onChange({ sex, weightClass: '' })}
      />
      <div className="field-grid">
        <Field
          path={path('firstName')}
          label={t('registration.firstName')}
          error={error('firstName')}
        >
          {(props) => (
            <input
              {...props}
              autoComplete={autoComplete('given-name')}
              value={athlete.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
            />
          )}
        </Field>
        <Field path={path('lastName')} label={t('registration.lastName')} error={error('lastName')}>
          {(props) => (
            <input
              {...props}
              autoComplete={autoComplete('family-name')}
              value={athlete.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
            />
          )}
        </Field>
        <Field
          path={path('birthDate')}
          label={t('registration.birthDate')}
          error={error('birthDate')}
        >
          {(props) => (
            <BirthDateField
              {...props}
              autoComplete={autoComplete('bday')}
              value={athlete.birthDate}
              onChange={(birthDate) => onChange({ birthDate })}
            />
          )}
        </Field>
        <Field
          path={path('weightClass')}
          label={t('registration.weightClass')}
          error={error('weightClass')}
        >
          {(props) => (
            <Select
              {...props}
              value={athlete.weightClass}
              placeholder={t('registration.choose')}
              options={weightClassesFor(athlete.sex).map((value) => ({ value, label: kg(value) }))}
              onChange={(weightClass) => onChange({ weightClass })}
            />
          )}
        </Field>
        <Field
          path={path('total')}
          label={t('registration.total')}
          hint={t('registration.totalHint')}
          error={error('total')}
        >
          {(props) => (
            <input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              max={500}
              step={1}
              value={athlete.total}
              onChange={(e) => onChange({ total: e.target.value })}
            />
          )}
        </Field>
        <Field path={path('email')} label={t('registration.email')} error={error('email')}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete={autoComplete('email')}
              value={athlete.email}
              onChange={(e) => onChange({ email: e.target.value })}
            />
          )}
        </Field>
        <Field path={path('phone')} label={t('registration.phone')} error={error('phone')}>
          {(props) => (
            <input
              {...props}
              type="tel"
              autoComplete={autoComplete('tel')}
              value={athlete.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
            />
          )}
        </Field>
        {athlete.cwo && (
          <Field
            path={path('tshirtSize')}
            label={t('registration.tshirtSize')}
            error={error('tshirtSize')}
          >
            {(props) => (
              <Select
                {...props}
                value={athlete.tshirtSize}
                placeholder={t('registration.choose')}
                options={tshirtSizes.map((value) => ({ value, label: value }))}
                onChange={(tshirtSize) => onChange({ tshirtSize })}
              />
            )}
          </Field>
        )}
      </div>
      {isTeam && (
        <label className="check">
          <input
            id={fieldId(path('amcr'))}
            type="checkbox"
            checked={athlete.amcr}
            onChange={(e) => onChange({ amcr: e.target.checked })}
          />
          <span>{t('registration.amcrMember')}</span>
        </label>
      )}
      {isTeam && error('cwo') && <FieldError message={error('cwo')!} />}
      {athlete.amcr && (
        <Field
          path={path('university')}
          label={t('registration.university')}
          error={error('university')}
        >
          {(props) => (
            <Select
              {...props}
              value={athlete.university}
              placeholder={t('registration.choose')}
              options={universities.map(({ code, name }) => ({ value: code, label: name }))}
              onChange={(university) => onChange({ university })}
            />
          )}
        </Field>
      )}
    </fieldset>
  )
}
