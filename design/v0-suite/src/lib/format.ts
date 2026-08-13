import type { SalesStage, ProductionStage, JobType, CallOutcome } from './data/types'

export function currency(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function relativeTime(iso: string, nowISO = new Date().toISOString()): string {
  const diff = new Date(nowISO).getTime() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.round(d / 7)
  if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function shortDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function longDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function duration(sec?: number): string {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const salesStageMeta: Record<SalesStage, { label: string; color: string; dot: string }> = {
  new_lead: { label: 'New Lead', color: 'var(--info)', dot: 'oklch(0.58 0.12 245)' },
  inspection_scheduled: { label: 'Inspection Scheduled', color: 'oklch(0.55 0.13 300)', dot: 'oklch(0.55 0.13 300)' },
  inspected: { label: 'Inspected', color: 'oklch(0.6 0.12 190)', dot: 'oklch(0.6 0.12 190)' },
  estimate_sent: { label: 'Estimate Sent', color: 'var(--primary)', dot: 'oklch(0.62 0.16 52)' },
  approved: { label: 'Approved', color: 'var(--success)', dot: 'oklch(0.62 0.14 152)' },
  lost: { label: 'Lost', color: 'var(--muted-foreground)', dot: 'oklch(0.6 0.02 60)' },
}

export const productionStageMeta: Record<ProductionStage, { label: string; dot: string }> = {
  approved: { label: 'Approved', dot: 'oklch(0.62 0.14 152)' },
  materials_ordered: { label: 'Materials Ordered', dot: 'oklch(0.6 0.12 190)' },
  scheduled: { label: 'Scheduled', dot: 'oklch(0.55 0.13 300)' },
  in_progress: { label: 'In Progress', dot: 'var(--primary)' },
  punch_list: { label: 'Punch List', dot: 'oklch(0.7 0.13 70)' },
  final_invoice: { label: 'Final Invoice', dot: 'oklch(0.58 0.12 245)' },
  paid: { label: 'Paid', dot: 'oklch(0.62 0.14 152)' },
}

export const salesStageOrder: SalesStage[] = [
  'new_lead',
  'inspection_scheduled',
  'inspected',
  'estimate_sent',
  'approved',
  'lost',
]

export const productionStageOrder: ProductionStage[] = [
  'approved',
  'materials_ordered',
  'scheduled',
  'in_progress',
  'punch_list',
  'final_invoice',
  'paid',
]

export const jobTypeLabels: Record<JobType, string> = {
  roof_replacement: 'Roof Replacement',
  roof_repair: 'Roof Repair',
  inspection: 'Inspection',
  gutters: 'Gutters',
  storm_damage: 'Storm Damage',
}

export const callOutcomeMeta: Record<CallOutcome, { label: string; className: string }> = {
  booked: { label: 'Booked', className: 'bg-success/15 text-success border-success/30' },
  message: { label: 'Message taken', className: 'bg-info/15 text-info border-info/30' },
  transferred: { label: 'Transferred', className: 'bg-accent text-accent-foreground border-primary/30' },
  missed: { label: 'Missed', className: 'bg-destructive/10 text-destructive border-destructive/30' },
}

export function formatPhoneMaybe(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length !== 10) return raw
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

export function sourceLabel(s: string): string {
  return s
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export const agentKindMeta: Record<
  string,
  { label: string; icon: 'phone' | 'message' | 'mail' | 'file' | 'calendar' | 'package' | 'receipt' | 'check' }
> = {
  call: { label: 'Answered call', icon: 'phone' },
  sms: { label: 'Sent text', icon: 'message' },
  email: { label: 'Sent email', icon: 'mail' },
  estimate: { label: 'Drafted estimate', icon: 'file' },
  schedule: { label: 'Scheduled', icon: 'calendar' },
  materials: { label: 'Ordered materials', icon: 'package' },
  invoice: { label: 'Invoice action', icon: 'receipt' },
  task: { label: 'Created task', icon: 'check' },
}

export const suggestionKindMeta: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'accent' }> = {
  nudge: { label: 'Nudge', tone: 'accent' },
  schedule: { label: 'Scheduling', tone: 'info' },
  upsell: { label: 'Upsell', tone: 'success' },
  collect: { label: 'Collections', tone: 'warning' },
  followup: { label: 'Follow-up', tone: 'info' },
  risk: { label: 'At risk', tone: 'warning' },
}

export const autonomyMeta: Record<string, { label: string; description: string }> = {
  auto: { label: 'Auto-run', description: 'Ships automatically, no log entry needed' },
  auto_logged: { label: 'Auto + evidence log', description: 'Ships automatically and records what it did' },
  ask_first: { label: 'Ask first', description: 'Waits for your approval before running' },
}

export function urgencyTone(u: string): 'warning' | 'info' | 'muted' {
  return u === 'emergency' ? 'warning' : u === 'soon' ? 'info' : 'muted'
}
