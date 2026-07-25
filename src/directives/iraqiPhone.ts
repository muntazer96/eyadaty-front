import type { Directive } from 'vue'

const PHONE_PATTERN = /^07\d{9}$/
const PHONE_ERROR = 'رقم الهاتف يجب أن يكون 11 رقماً ويبدأ بـ 07.'

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\D/g, '')
    .slice(0, 11)
}

function validate(input: HTMLInputElement) {
  input.setCustomValidity(!input.value || PHONE_PATTERN.test(input.value) ? '' : PHONE_ERROR)
}

export const iraqiPhoneDirective: Directive<HTMLInputElement> = {
  mounted(input) {
    input.type = 'tel'
    input.inputMode = 'numeric'
    input.maxLength = 11
    input.pattern = '07[0-9]{9}'
    input.placeholder ||= '07XXXXXXXXX'
    input.title = PHONE_ERROR

    input.addEventListener('input', () => {
      const normalized = normalizeDigits(input.value)
      if (input.value !== normalized) {
        input.value = normalized
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return
      }
      validate(input)
    })
    input.addEventListener('blur', () => validate(input))
    validate(input)
  },
  updated(input) {
    const normalized = normalizeDigits(input.value)
    if (input.value !== normalized) input.value = normalized
    validate(input)
  },
}

