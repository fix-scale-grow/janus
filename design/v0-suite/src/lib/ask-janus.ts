import type { Store } from './data/repositories'
import { salesStageMeta, currency } from './format'

export type ToolChip = {
  label: string
  icon: 'search' | 'message' | 'file' | 'calendar' | 'phone' | 'check' | 'user'
}

export type AskResult =
  | { kind: 'jobs'; items: { id: string; title: string; sub: string; href: string }[] }
  | { kind: 'draft'; channel: 'sms' | 'email'; to: string; body: string }
  | { kind: 'estimate'; number: string; total: string; note: string; href?: string }
  | { kind: 'note' }

export type AskResponse = {
  chips: ToolChip[]
  answer: string
  result?: AskResult
}

export const askSuggestions = [
  'Which jobs are stuck?',
  'Text Mike the crew is running 20 min late',
  'Draft an estimate for the Hendersons like the Baker job',
  'Who owes me money?',
  "What did you do today?",
]

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function askJanus(query: string, store: Store): AskResponse {
  const q = query.trim().toLowerCase()

  // --- Stuck jobs -----------------------------------------------------------
  if (q.includes('stuck') || (q.includes('stall') && q.includes('job'))) {
    const stuck = store.jobs
      .filter((j) => !j.won && daysSince(j.stageEnteredAt) >= 6)
      .sort((a, b) => daysSince(b.stageEnteredAt) - daysSince(a.stageEnteredAt))
      .slice(0, 5)
      .map((j) => {
        const c = store.contacts.find((x) => x.id === j.contactId)
        return {
          id: j.id,
          title: c?.name ?? j.title,
          sub: `${salesStageMeta[j.salesStage]?.label ?? j.salesStage} · ${daysSince(j.stageEnteredAt)} days in stage · ${currency(j.value)}`,
          href: `/sales?job=${j.id}`,
        }
      })
    return {
      chips: [
        { label: 'Searched jobs', icon: 'search' },
        { label: 'Ranked by days-in-stage', icon: 'check' },
      ],
      answer: `${stuck.length} jobs haven't moved in 6+ days. The oldest is worth ${stuck[0]?.sub.includes('$') ? stuck[0].sub.split('· ').pop() : ''}. Want me to draft nudges for all of them?`,
      result: { kind: 'jobs', items: stuck },
    }
  }

  // --- Who owes money -------------------------------------------------------
  if (q.includes('owe') || (q.includes('overdue') && !q.includes('job')) || q.includes('unpaid')) {
    const overdue = store.invoices
      .filter((i) => i.status !== 'paid' && daysSince(i.dueAt) > 0)
      .slice(0, 5)
      .map((i) => {
        const c = store.contacts.find((x) => x.id === i.contactId)
        return {
          id: i.id,
          title: `${c?.name ?? 'Customer'} — ${i.number}`,
          sub: `${currency(i.total)} · ${daysSince(i.dueAt)} days overdue`,
          href: `/invoices/${i.id}`,
        }
      })
    return {
      chips: [
        { label: 'Searched invoices', icon: 'search' },
        { label: 'Filtered unpaid', icon: 'check' },
      ],
      answer: `${overdue.length} invoices are past due. I already texted payment links to the two oldest. Want me to chase the rest?`,
      result: { kind: 'jobs', items: overdue },
    }
  }

  // --- Text someone ---------------------------------------------------------
  if (q.startsWith('text ') || q.includes('send a text') || q.includes('let them know')) {
    const nameMatch = query.match(/text\s+([A-Z][a-z]+)/)
    const name = nameMatch?.[1] ?? 'the customer'
    let body = `Hi ${name}, quick update from Summit Ridge Roofing — `
    if (q.includes('late') || q.includes('running')) body += 'our crew is running about 20 minutes behind. We\u2019ll be there shortly, thanks for your patience!'
    else if (q.includes('done') || q.includes('complete')) body += 'your job is all wrapped up. We\u2019ll send the final invoice shortly. Thank you!'
    else body += 'just checking in on your project. Let me know if you have any questions.'
    return {
      chips: [
        { label: 'Matched contact', icon: 'user' },
        { label: 'Drafted SMS', icon: 'message' },
      ],
      answer: `Here's a draft text to ${name}. Review and hit Send, or edit the wording.`,
      result: { kind: 'draft', channel: 'sms', to: name, body },
    }
  }

  // --- Draft an estimate ----------------------------------------------------
  if (q.includes('estimate') || q.includes('quote')) {
    return {
      chips: [
        { label: 'Found reference job', icon: 'search' },
        { label: 'Copied scope + pricing', icon: 'file' },
        { label: 'Drafted estimate', icon: 'check' },
      ],
      answer:
        'I built a 3-tier estimate modeled on the reference job — same shingle system and labor rates, adjusted for roof size. It\u2019s saved as a draft for your review.',
      result: {
        kind: 'estimate',
        number: 'EST-1052 (draft)',
        total: '$21,400 – $28,900',
        note: 'Good / Better / Best tiers · GAF Timberline HDZ · tear-off + install',
      },
    }
  }

  // --- What did you do today ------------------------------------------------
  if ((q.includes('what') && q.includes('today')) || q.includes('recap') || q.includes('summary')) {
    return {
      chips: [
        { label: 'Read activity log', icon: 'search' },
        { label: 'Summarized', icon: 'check' },
      ],
      answer: `Today I answered ${store.aiCalls.length + 5} calls, booked 3 inspections, sent 6 follow-up texts, drafted 2 estimates, ordered materials for 1 job, and chased 2 overdue invoices. 3 high-value actions are waiting on your approval.`,
      result: { kind: 'note' },
    }
  }

  return {
    chips: [{ label: 'Searched everything', icon: 'search' }],
    answer:
      "I can search your jobs, draft texts and estimates, and take actions. Try \u201cwhich jobs are stuck?\u201d, \u201ctext Mike the crew is running late\u201d, or \u201cwho owes me money?\u201d",
    result: { kind: 'note' },
  }
}
