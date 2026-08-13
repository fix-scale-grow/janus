import type { AutomationAction } from './data/types'

export interface ParsedAutomation {
  triggerLabel: string
  actions: AutomationAction[]
}

/**
 * Naive plain-English → trigger/actions parser used for the "told, not built"
 * automations demo. Shared between the live composer preview and the store's
 * addAutomation action so both render the same breakdown.
 */
export function parseAutomation(sentence: string): ParsedAutomation {
  const lower = sentence.toLowerCase()

  const triggerLabel = lower.includes('signed')
    ? 'Estimate signed'
    : lower.includes('overdue')
      ? 'Invoice overdue'
      : lower.includes('paid')
        ? 'Invoice paid'
        : lower.includes('lead')
          ? 'New lead'
          : lower.includes('complete') || lower.includes('finished')
            ? 'Job completed'
            : lower.includes('scheduled')
              ? 'Job scheduled'
              : lower.includes('missed')
                ? 'Missed call'
                : 'Custom trigger'

  const smsPreview = lower.includes('thank')
    ? 'Thanks {first_name}! We appreciate your business — your project is now in our queue.'
    : lower.includes('overdue') || lower.includes('payment')
      ? 'Hi {first_name}, a friendly reminder your invoice is due. Pay securely here: {pay_link}'
      : lower.includes('way') || lower.includes('progress')
        ? 'Hi {first_name}, your Summit Ridge crew is on the way and will arrive around {eta}.'
        : lower.includes('lead')
          ? 'Hi {first_name}, thanks for reaching out to Summit Ridge Roofing! When works for a free inspection?'
          : 'Hi {first_name}, this is Summit Ridge Roofing following up on your roof.'

  const actions: AutomationAction[] = []
  if (lower.includes('text') || lower.includes('sms') || lower.includes('message'))
    actions.push({ kind: 'sms', label: 'Send text', preview: smsPreview })
  if (lower.includes('email')) actions.push({ kind: 'email', label: 'Send email' })
  if (lower.includes('task') || lower.includes('materials') || lower.includes('order'))
    actions.push({ kind: 'task', label: 'Create task' })
  if (lower.includes('stage') || lower.includes('move')) actions.push({ kind: 'stage', label: 'Change stage' })
  if (lower.includes('notify') || lower.includes('alert') || lower.includes('team'))
    actions.push({ kind: 'notify', label: 'Notify team' })
  if (actions.length === 0) actions.push({ kind: 'notify', label: 'Notify team' })

  return { triggerLabel, actions }
}
