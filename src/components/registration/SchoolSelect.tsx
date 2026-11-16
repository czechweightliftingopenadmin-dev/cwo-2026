import { useMemo, useState } from 'react'
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { universities } from '../../config/registration'

type School = (typeof universities)[number]

interface Props {
  id?: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  value: string
  onChange: (code: string) => void
}

/** Lowercase without diacritics, so "zdravotnicka plzen" finds "zdravotnická … Plzeň". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const searchable = universities.map((school) => ({
  school,
  text: fold(`${school.name} ${school.code} ${school.city}`),
}))

/** A searchable picker for the long list of universities and VOŠ. */
export function SchoolSelect({ value, onChange, ...inputProps }: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    return searchable
      .filter(({ text }) => words.every((word) => text.includes(word)))
      .map(({ school }) => school)
  }, [query])
  const groups = (['university', 'college'] as const)
    .map((kind) => ({ kind, schools: matches.filter((school) => school.kind === kind) }))
    .filter((group) => group.schools.length > 0)

  return (
    <Combobox
      value={value}
      onChange={(next: string | null) => next && onChange(next)}
      onClose={() => setQuery('')}
      immediate
    >
      <div className="select combobox">
        <ComboboxInput
          {...inputProps}
          className="select-button combobox-input"
          autoComplete="off"
          placeholder={t('registration.schools.placeholder')}
          displayValue={(code: string) =>
            universities.find((school) => school.code === code)?.name ?? ''
          }
          onChange={(event) => setQuery(event.target.value)}
        />
        <ComboboxButton className="combobox-toggle">
          <ChevronDown size={16} aria-hidden="true" />
        </ComboboxButton>
      </div>
      <ComboboxOptions
        modal={false}
        anchor={{ to: 'bottom start', gap: 4 }}
        className="select-options combobox-options"
      >
        {groups.map((group) => (
          <div key={group.kind} role="presentation">
            <div className="select-group" aria-hidden="true">
              {t(`registration.schools.${group.kind}`)}
            </div>
            {group.schools.map((school: School) => (
              <ComboboxOption
                key={school.code}
                value={school.code}
                aria-label={`${school.name}, ${school.city}`}
                className="select-option"
              >
                <span>
                  {school.name}
                  <span className="select-option-detail">{school.city}</span>
                </span>
                <Check size={15} aria-hidden="true" />
              </ComboboxOption>
            ))}
          </div>
        ))}
        {groups.length === 0 && (
          <div className="select-empty">{t('registration.schools.empty')}</div>
        )}
      </ComboboxOptions>
    </Combobox>
  )
}
