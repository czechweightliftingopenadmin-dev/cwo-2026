import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { CalendarDays } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { DayPicker } from 'react-day-picker'
import type { DropdownProps } from 'react-day-picker'
import { cs, enGB } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { maskBirthDate, normaliseBirthDate } from './draft'
import { Select } from './Select'

interface Props {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  value: string
  autoComplete: string
  onChange: (value: string) => void
}

const pad = (value: number) => String(value).padStart(2, '0')
const earliest = new Date(1920, 0, 1)

function parse(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normaliseBirthDate(value))
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** Month and year pickers inside the calendar, styled like the other selects. */
function CalendarDropdown({ options = [], value, onChange, 'aria-label': label }: DropdownProps) {
  return (
    <Select
      inline
      className="calendar-select"
      aria-label={label}
      value={Number(value)}
      options={options}
      onChange={(next) =>
        onChange?.({ target: { value: String(next) } } as ChangeEvent<HTMLSelectElement>)
      }
    />
  )
}

/** One text field ("01. 05. 2000") with a calendar for those who prefer clicking. */
export function BirthDateField({ value, autoComplete, onChange, ...inputProps }: Props) {
  const { t, i18n } = useTranslation()
  const selected = parse(value)
  const today = new Date()

  return (
    <Popover className="date-field">
      <input
        {...inputProps}
        inputMode="numeric"
        placeholder={t('registration.birthDatePlaceholder')}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(maskBirthDate(e.target.value))}
      />
      <PopoverButton className="date-field-button" aria-label={t('registration.openCalendar')}>
        <CalendarDays size={18} aria-hidden="true" />
      </PopoverButton>
      <PopoverPanel anchor={{ to: 'bottom end', gap: 6 }} className="calendar-panel">
        {({ close }) => (
          <DayPicker
            mode="single"
            locale={i18n.language === 'en' ? enGB : cs}
            captionLayout="dropdown"
            startMonth={earliest}
            endMonth={today}
            disabled={{ after: today }}
            defaultMonth={selected ?? new Date(2000, 0, 1)}
            selected={selected}
            components={{ Dropdown: CalendarDropdown }}
            onSelect={(date) => {
              if (!date) return
              onChange(`${pad(date.getDate())}. ${pad(date.getMonth() + 1)}. ${date.getFullYear()}`)
              close()
            }}
          />
        )}
      </PopoverPanel>
    </Popover>
  )
}
