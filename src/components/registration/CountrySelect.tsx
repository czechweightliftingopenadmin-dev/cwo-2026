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
import { commonCountries, countries as regions, countryCodes } from '../../config/countries'
import type { CountryCode } from '../../config/countries'
import { countryName, locale } from '../../lib/registration/format'

interface Props {
  id?: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  value: string
  onChange: (code: string) => void
}

/** Lowercase without diacritics, so "cesko" finds "Česko". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Names people commonly type that Intl.DisplayNames does not use. */
const aliases: Partial<Record<CountryCode, string>> = {
  CZE: 'Česká republika Czech Republic',
  GBR: 'Anglie England Velká Británie Great Britain',
  USA: 'Amerika America',
}

/** A searchable country picker; names follow the page language, Czech and English both match. */
export function CountrySelect({ value, onChange, ...inputProps }: Props) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const [query, setQuery] = useState('')

  const countries = useMemo(() => {
    const collator = new Intl.Collator(locale(language))
    const all = countryCodes.map((code) => ({
      code,
      name: countryName(code, language),
      text: fold(
        [
          code,
          regions[code],
          countryName(code, 'cs'),
          countryName(code, 'en'),
          aliases[code] ?? '',
        ].join(' '),
      ),
    }))
    const common = commonCountries.map((code) => all.find((country) => country.code === code)!)
    const rest = all
      .filter((country) => !commonCountries.includes(country.code))
      .sort((a, b) => collator.compare(a.name, b.name))
    return [...common, ...rest]
  }, [language])

  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    return countries.filter(({ text }) => words.every((word) => text.includes(word)))
  }, [countries, query])

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
          placeholder={t('registration.countries.placeholder')}
          displayValue={(code: string) => (code ? `${countryName(code, language)} (${code})` : '')}
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
        {matches.map((country) => (
          <ComboboxOption
            key={country.code}
            value={country.code}
            aria-label={`${country.name} (${country.code})`}
            className="select-option"
          >
            <span>
              {country.name}
              <span className="select-option-detail">{country.code}</span>
            </span>
            <Check size={15} aria-hidden="true" />
          </ComboboxOption>
        ))}
        {matches.length === 0 && (
          <div className="select-empty">{t('registration.countries.empty')}</div>
        )}
      </ComboboxOptions>
    </Combobox>
  )
}
