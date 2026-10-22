import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption<T extends string | number> {
  value: T
  label: string
  disabled?: boolean
}

interface Props<T extends string | number> {
  id?: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  'aria-label'?: string
  value: T | ''
  options: readonly SelectOption<T>[]
  placeholder?: string
  /** Inline renders the list in place, for use inside another popover such as the calendar. */
  inline?: boolean
  className?: string
  onChange: (value: T) => void
}

/** A styled, keyboard-accessible replacement for the native select. */
export function Select<T extends string | number>({
  value,
  options,
  placeholder,
  inline = false,
  className,
  onChange,
  ...buttonProps
}: Props<T>) {
  const selected = options.find((option) => option.value === value)
  return (
    <Listbox value={value} onChange={(next: T | '') => next !== '' && onChange(next)}>
      <div className={className ? `select ${className}` : 'select'}>
        <ListboxButton {...buttonProps} className="select-button">
          <span className={selected ? undefined : 'select-placeholder'}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </ListboxButton>
        <ListboxOptions
          anchor={inline ? undefined : { to: 'bottom start', gap: 4 }}
          className={inline ? 'select-options select-options-inline' : 'select-options'}
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="select-option"
            >
              <span>{option.label}</span>
              <Check size={15} aria-hidden="true" />
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}
