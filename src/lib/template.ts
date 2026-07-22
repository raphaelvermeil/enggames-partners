import type { Company } from '@/types'

// Variables usable in campaign templates and subject lines, with a natural
// fallback word used when the company field is empty.
const TEMPLATE_VARS: { key: string; value: (c: Company) => string | null; fallback: string }[] = [
  { key: 'company', value: c => c.name, fallback: 'your company' },
  { key: 'contact', value: c => c.contact_name, fallback: 'there' },
  { key: 'industry', value: c => c.industry, fallback: 'your industry' },
  { key: 'website', value: c => c.website, fallback: 'your website' },
  { key: 'email', value: c => c.contact_email, fallback: '' },
]

// List of available variable tokens (e.g. "[company]") for UI hints.
export const TEMPLATE_VARIABLES = TEMPLATE_VARS.map(v => `[${v.key}]`)

// Replace [variables] in `text` with the company's values, falling back to a
// natural word when a field is empty. Unknown tags are left untouched.
export function fillTemplate(text: string, company: Company): string {
  let result = text
  for (const { key, value, fallback } of TEMPLATE_VARS) {
    const filled = value(company)?.trim() || fallback
    result = result.replaceAll(`[${key}]`, filled)
  }
  return result
}
