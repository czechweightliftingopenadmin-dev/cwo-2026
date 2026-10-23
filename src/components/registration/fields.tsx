import { useLayoutEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'

export type Errors = Partial<Record<string, string>>

export const fieldId = (path: string) => `registration-${path.replaceAll('.', '-')}`

export function useErrorText() {
  const { t, i18n } = useTranslation()
  return (message: string) => {
    const key = `registration.errors.${message}`
    return t(i18n.exists(key) ? key : 'registration.errors.invalid')
  }
}

/** Keeps the first issue for each path, the way the form shows them. */
export function toErrors(issues: { path: string; message: string }[]): Errors {
  const errors: Errors = {}
  for (const issue of issues) errors[issue.path] ??= issue.message
  return errors
}

/** Focuses the invalid field that comes first on the page. */
export function focusFirstError(errors: Errors, fallback?: HTMLElement | null) {
  const [first] = Object.keys(errors)
    .map((path) => document.getElementById(fieldId(path)))
    .filter((element) => element !== null)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
  ;(first ?? fallback)?.focus()
}

/**
 * Call from a layout effect after swapping panels. A shorter panel would make the page
 * collapse under a smooth scroll, so the top of the forms (tabs included) is brought back
 * instantly, before paint, and only when it has scrolled out of view.
 */
export function revealPanel(heading: HTMLElement | null) {
  if (!heading) return
  const top = (heading.closest('.registration-forms') ?? heading).getBoundingClientRect().top
  if (top < 0) window.scrollTo({ top: window.scrollY + top - 16, behavior: 'instant' })
  heading.focus({ preventScroll: true })
}

/** Runs `revealPanel` whenever `view` changes, but not on the first render. */
export function useRevealOnChange(view: string, heading: RefObject<HTMLElement | null>) {
  const previous = useRef(view)
  useLayoutEffect(() => {
    if (previous.current === view) return
    previous.current = view
    revealPanel(heading.current)
  }, [view, heading])
}

interface ControlProps {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

interface FieldProps {
  path: string
  label: string
  error?: string
  hint?: string
  className?: string
  children: (props: ControlProps) => ReactNode
}

export function Field({ path, label, error, hint, className, children }: FieldProps) {
  const id = fieldId(path)
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')
  return (
    <div className={className ? `field ${className}` : 'field'} data-invalid={Boolean(error)}>
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`} message={error} />}
    </div>
  )
}

export function FieldError({ id, message }: { id?: string; message: string }) {
  const errorText = useErrorText()
  return (
    <p id={id} className="field-error">
      {errorText(message)}
    </p>
  )
}

interface ChoiceProps<T extends string> {
  name: string
  legend: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}

/** Radio buttons styled as a segmented control. */
export function Choice<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: ChoiceProps<T>) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="choice-options">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
