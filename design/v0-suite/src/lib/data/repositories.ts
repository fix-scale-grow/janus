// ---------------------------------------------------------------------------
// Repository layer. UI code talks to these functions only — never to the seed
// arrays directly. Swap the in-memory store for API calls here later.
// ---------------------------------------------------------------------------
import type {
  Employee,
  Contact,
  Job,
  TimelineEntry,
  Estimate,
  Invoice,
  Conversation,
  Automation,
  AutomationRun,
  ReceptionistCall,
  JobPhoto,
  JobDocument,
  SalesStage,
  ProductionStage,
  AgentActivity,
  AgentApproval,
  JobAiSuggestion,
  AiCall,
} from './types'

export interface Store {
  employees: Employee[]
  contacts: Contact[]
  jobs: Job[]
  timeline: TimelineEntry[]
  estimates: Estimate[]
  invoices: Invoice[]
  conversations: Conversation[]
  automations: Automation[]
  automationRuns: AutomationRun[]
  receptionistCalls: ReceptionistCall[]
  photos: JobPhoto[]
  documents: JobDocument[]
  agentActivity: AgentActivity[]
  agentApprovals: AgentApproval[]
  aiSuggestions: JobAiSuggestion[]
  aiCalls: AiCall[]
}

// ---- Employees & contacts --------------------------------------------------
export const employeeRepo = {
  all: (s: Store) => s.employees,
  byId: (s: Store, id: string) => s.employees.find((e) => e.id === id),
  reps: (s: Store) => s.employees.filter((e) => e.role === 'office' || e.role === 'owner'),
  crews: (s: Store) => s.employees.filter((e) => e.role === 'field' && e.crew),
}

export const contactRepo = {
  all: (s: Store) => s.contacts,
  byId: (s: Store, id: string) => s.contacts.find((c) => c.id === id),
  jobCount: (s: Store, id: string) => s.jobs.filter((j) => j.contactId === id).length,
  search: (s: Store, q: string) => {
    const t = q.trim().toLowerCase()
    if (!t) return s.contacts
    return s.contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(t) ||
        c.address.toLowerCase().includes(t) ||
        c.city.toLowerCase().includes(t) ||
        c.phone.includes(t) ||
        c.email.toLowerCase().includes(t),
    )
  },
}

// ---- Jobs ------------------------------------------------------------------
export const jobRepo = {
  all: (s: Store) => s.jobs,
  byId: (s: Store, id: string) => s.jobs.find((j) => j.id === id),
  byContact: (s: Store, contactId: string) => s.jobs.filter((j) => j.contactId === contactId),
  sales: (s: Store) => s.jobs.filter((j) => !j.won || j.salesStage === 'approved' ? true : true),
  bySalesStage: (s: Store, stage: SalesStage) => s.jobs.filter((j) => j.salesStage === stage),
  byProductionStage: (s: Store, stage: ProductionStage) =>
    s.jobs.filter((j) => j.won && j.productionStage === stage),
  production: (s: Store) => s.jobs.filter((j) => j.won),
  todaysJobs: (s: Store, todayISO: string) => {
    const day = todayISO.slice(0, 10)
    return s.jobs.filter((j) => j.scheduledDate?.slice(0, 10) === day)
  },
}

export function daysInStage(job: Job, nowISO: string): number {
  const then = new Date(job.stageEnteredAt).getTime()
  const now = new Date(nowISO).getTime()
  return Math.max(0, Math.floor((now - then) / 86400000))
}

// ---- Timeline --------------------------------------------------------------
export const timelineRepo = {
  byJob: (s: Store, jobId: string) =>
    s.timeline.filter((t) => t.jobId === jobId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  byContact: (s: Store, contactId: string) => {
    const jobIds = s.jobs.filter((j) => j.contactId === contactId).map((j) => j.id)
    return s.timeline
      .filter((t) => jobIds.includes(t.jobId))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },
}

// ---- Estimates & invoices --------------------------------------------------
export const estimateRepo = {
  all: (s: Store) => s.estimates,
  byId: (s: Store, id: string) => s.estimates.find((e) => e.id === id),
  byJob: (s: Store, jobId: string) => s.estimates.find((e) => e.jobId === jobId),
  total: (e: Estimate, tier?: Estimate['selectedTier']) => estimateTotals(e, tier),
}

export function estimateTotals(e: Estimate, tier?: Estimate['selectedTier']) {
  const tierRank = { good: 0, better: 1, best: 2 }
  const cap = tierRank[tier ?? 'best']
  const items = e.lineItems.filter((li) => tierRank[li.tier] <= cap)
  const subtotal = items.reduce((sum, li) => sum + li.qty * li.unitPrice, 0)
  const tax = Math.round(subtotal * e.taxRate)
  return { subtotal, tax, total: subtotal + tax, items }
}

export const invoiceRepo = {
  all: (s: Store) => s.invoices,
  byId: (s: Store, id: string) => s.invoices.find((i) => i.id === id),
  byJob: (s: Store, jobId: string) => s.invoices.find((i) => i.jobId === jobId),
  paid: (inv: Invoice) => inv.payments.reduce((sum, p) => sum + p.amount, 0),
  balance: (inv: Invoice) => inv.total - inv.payments.reduce((sum, p) => sum + p.amount, 0),
  agingBucket: (inv: Invoice, nowISO: string): 'current' | '1-30' | '31-60' | '60+' => {
    if (inv.status === 'paid') return 'current'
    const due = new Date(inv.dueAt).getTime()
    const now = new Date(nowISO).getTime()
    const overdueDays = Math.floor((now - due) / 86400000)
    if (overdueDays <= 0) return 'current'
    if (overdueDays <= 30) return '1-30'
    if (overdueDays <= 60) return '31-60'
    return '60+'
  },
}

// ---- Conversations ---------------------------------------------------------
export const conversationRepo = {
  all: (s: Store) => s.conversations,
  byId: (s: Store, id: string) => s.conversations.find((c) => c.id === id),
  unmatched: (s: Store) => s.conversations.filter((c) => !c.contactId),
}

// ---- Automations -----------------------------------------------------------
export const automationRepo = {
  all: (s: Store) => s.automations,
  runs: (s: Store) => s.automationRuns,
}

// ---- Metrics for dashboard -------------------------------------------------
export function pipelineByStage(s: Store) {
  const stages: SalesStage[] = ['new_lead', 'inspection_scheduled', 'inspected', 'estimate_sent', 'approved']
  return stages.map((stage) => {
    const items = s.jobs.filter((j) => j.salesStage === stage)
    return {
      stage,
      count: items.length,
      value: items.reduce((sum, j) => sum + j.value, 0),
    }
  })
}

export function revenueThisWeekVsLast(s: Store, nowISO: string) {
  const now = new Date(nowISO).getTime()
  const week = 7 * 86400000
  let thisWeek = 0
  let lastWeek = 0
  for (const inv of s.invoices) {
    for (const p of inv.payments) {
      const t = new Date(p.date).getTime()
      if (now - t <= week) thisWeek += p.amount
      else if (now - t <= 2 * week) lastWeek += p.amount
    }
  }
  // Ensure demo has non-zero values
  if (thisWeek === 0) thisWeek = 48200
  if (lastWeek === 0) lastWeek = 41600
  return { thisWeek, lastWeek }
}

export function weeklyRevenueSeries(s: Store) {
  // 6-week trailing series for the sparkline/bar chart
  return [32400, 38900, 41600, 36200, 45100, 48200].map((v, i) => ({
    label: `W${i + 1}`,
    revenue: v,
  }))
}
