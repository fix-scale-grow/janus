'use client'

import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import { parseAutomation } from '../automation-parser'
import type { Store } from './repositories'
import type {
  SalesStage,
  ProductionStage,
  TimelineEntry,
  TimelineEntryKind,
  Job,
  AutomationAutonomy,
} from './types'
import {
  employees,
  contacts,
  jobs,
  timeline,
  estimates,
  invoices,
  conversations,
  automations,
  automationRuns,
  receptionistCalls,
  photos,
  documents,
  agentActivity,
  agentApprovals,
  aiSuggestions,
  aiCalls,
  NOW_ISO,
} from './seed'

// Deep-ish clone of seed so mutations don't affect module state across HMR.
function initialStore(): Store {
  return structuredClone({
    employees,
    contacts,
    jobs,
    timeline,
    estimates,
    invoices,
    conversations,
    automations,
    automationRuns,
    receptionistCalls,
    photos,
    documents,
    agentActivity,
    agentApprovals,
    aiSuggestions,
    aiCalls,
  })
}

const stageLabels: Record<string, string> = {
  new_lead: 'New Lead',
  inspection_scheduled: 'Inspection Scheduled',
  inspected: 'Inspected',
  estimate_sent: 'Estimate Sent',
  approved: 'Approved',
  lost: 'Lost',
  materials_ordered: 'Materials Ordered',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  punch_list: 'Punch List',
  final_invoice: 'Final Invoice',
  paid: 'Paid',
}

interface DataContextValue {
  store: Store
  now: string
  currentUserId: string
  role: string
  setSession: (userId: string, role: string) => void
  moveSalesStage: (jobId: string, stage: SalesStage) => void
  moveProductionStage: (jobId: string, stage: ProductionStage) => void
  scheduleJob: (jobId: string, crewName: string, dateISO: string) => void
  addTimelineEntry: (jobId: string, kind: TimelineEntryKind, body: string) => void
  toggleAutomation: (id: string) => void
  addAutomation: (sentence: string, autonomy?: AutomationAutonomy) => void
  setAutomationAutonomy: (id: string, autonomy: AutomationAutonomy) => void
  linkConversation: (conversationId: string, contactId: string) => void
  markConversationRead: (conversationId: string) => void
  addPhoto: (jobId: string, caption: string) => void
  recordPayment: (invoiceId: string, amount: number) => void
  sendEstimate: (estimateId: string) => void
  signEstimate: (estimateId: string) => void
  selectEstimateTier: (estimateId: string, tier: 'good' | 'better' | 'best') => void
  convertEstimateToInvoice: (estimateId: string) => string | null
  revertAgentActivity: (activityId: string) => void
  resolveApproval: (approvalId: string, decision: 'approved' | 'denied') => void
  sendSuggestion: (suggestionId: string) => void
  dismissSuggestion: (suggestionId: string) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(initialStore)
  const [currentUserId, setUserId] = useState('emp_1')
  const [role, setRole] = useState('owner')

  const setSession = useCallback((userId: string, r: string) => {
    setUserId(userId)
    setRole(r)
  }, [])

  const author = useCallback(
    (s: Store) => s.employees.find((e) => e.id === currentUserId) ?? s.employees[0],
    [currentUserId],
  )

  const pushTimeline = (s: Store, entry: Omit<TimelineEntry, 'id'>) => {
    s.timeline.unshift({ id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...entry })
  }

  const moveSalesStage = useCallback((jobId: string, stage: SalesStage) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const job = s.jobs.find((j) => j.id === jobId)
      if (!job || job.salesStage === stage) return prev
      const from = job.salesStage
      job.salesStage = stage
      job.stageEnteredAt = new Date().toISOString()
      if (stage === 'approved') {
        job.won = true
        job.productionStage = job.productionStage ?? 'approved'
      }
      pushTimeline(s, {
        jobId,
        kind: 'stage_change',
        authorId: 'system',
        authorName: 'System',
        body: `Stage changed from ${stageLabels[from]} to ${stageLabels[stage]}`,
        createdAt: new Date().toISOString(),
        meta: { fromStage: from, toStage: stage },
      })
      return s
    })
  }, [])

  const moveProductionStage = useCallback((jobId: string, stage: ProductionStage) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const job = s.jobs.find((j) => j.id === jobId)
      if (!job || job.productionStage === stage) return prev
      const from = job.productionStage
      job.productionStage = stage
      job.stageEnteredAt = new Date().toISOString()
      pushTimeline(s, {
        jobId,
        kind: 'stage_change',
        authorId: 'system',
        authorName: 'System',
        body: `Production stage changed from ${from ? stageLabels[from] : '—'} to ${stageLabels[stage]}`,
        createdAt: new Date().toISOString(),
        meta: { fromStage: from, toStage: stage },
      })
      return s
    })
  }, [])

  const scheduleJob = useCallback((jobId: string, crewName: string, dateISO: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const job = s.jobs.find((j) => j.id === jobId)
      if (!job) return prev
      job.crewName = crewName
      job.scheduledDate = dateISO
      if (job.productionStage === 'approved' || job.productionStage === 'materials_ordered') {
        job.productionStage = 'scheduled'
      }
      pushTimeline(s, {
        jobId,
        kind: 'system',
        authorId: 'system',
        authorName: 'System',
        body: `Scheduled for ${crewName} on ${new Date(dateISO).toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
      })
      return s
    })
  }, [])

  const addTimelineEntry = useCallback(
    (jobId: string, kind: TimelineEntryKind, body: string) => {
      setStore((prev) => {
        const s = structuredClone(prev)
        const a = author(s)
        pushTimeline(s, {
          jobId,
          kind,
          authorId: a.id,
          authorName: a.name,
          body,
          createdAt: new Date().toISOString(),
          meta: kind === 'sms' ? { direction: 'outbound' } : undefined,
        })
        return s
      })
    },
    [author],
  )

  const toggleAutomation = useCallback((id: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const a = s.automations.find((x) => x.id === id)
      if (a) a.enabled = !a.enabled
      return s
    })
  }, [])

  const addAutomation = useCallback((sentence: string, autonomy: AutomationAutonomy = 'auto_logged') => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const { triggerLabel, actions } = parseAutomation(sentence)
      s.automations.unshift({
        id: `auto_${Date.now()}`,
        sentence,
        triggerLabel,
        actions,
        enabled: true,
        runCount: 0,
        autonomy,
        createdAt: new Date().toISOString(),
      })
      return s
    })
  }, [])

  const setAutomationAutonomy = useCallback((id: string, autonomy: AutomationAutonomy) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const a = s.automations.find((x) => x.id === id)
      if (a) a.autonomy = autonomy
      return s
    })
  }, [])

  const linkConversation = useCallback((conversationId: string, contactId: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const conv = s.conversations.find((c) => c.id === conversationId)
      const contact = s.contacts.find((c) => c.id === contactId)
      if (conv && contact) {
        conv.contactId = contactId
        conv.displayName = contact.name
      }
      return s
    })
  }, [])

  const markConversationRead = useCallback((conversationId: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const conv = s.conversations.find((c) => c.id === conversationId)
      if (conv) conv.unread = false
      return s
    })
  }, [])

  const addPhoto = useCallback((jobId: string, caption: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      s.photos.unshift({
        id: `ph_${Date.now()}`,
        jobId,
        url: `/roof-photo.png?height=240&width=320&query=roof%20field%20photo`,
        caption: caption || 'Field photo',
        uploadedBy: author(s).name,
        uploadedAt: new Date().toISOString(),
      })
      return s
    })
  }, [author])

  const recordPayment = useCallback((invoiceId: string, amount: number) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const inv = s.invoices.find((i) => i.id === invoiceId)
      if (!inv) return prev
      inv.payments.push({
        id: `pay_${Date.now()}`,
        invoiceId,
        amount,
        method: 'card',
        date: new Date().toISOString(),
        note: 'Payment via text link',
      })
      const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0)
      inv.status = paid >= inv.total ? 'paid' : 'partial'
      return s
    })
  }, [])

  const sendEstimate = useCallback((estimateId: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const est = s.estimates.find((e) => e.id === estimateId)
      if (!est) return prev
      est.status = 'sent'
      est.sentAt = new Date().toISOString()
      est.signatureStatus = 'awaiting'
      pushTimeline(s, {
        jobId: est.jobId,
        kind: 'estimate',
        authorId: author(s).id,
        authorName: author(s).name,
        body: `Estimate ${est.number} sent for signature`,
        createdAt: new Date().toISOString(),
      })
      return s
    })
  }, [author])

  const signEstimate = useCallback((estimateId: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const est = s.estimates.find((e) => e.id === estimateId)
      if (!est) return prev
      est.status = 'signed'
      est.signedAt = new Date().toISOString()
      est.signatureStatus = 'signed'
      pushTimeline(s, {
        jobId: est.jobId,
        kind: 'estimate',
        authorId: 'system',
        authorName: 'System',
        body: `Estimate ${est.number} signed by customer`,
        createdAt: new Date().toISOString(),
      })
      return s
    })
  }, [])

  const selectEstimateTier = useCallback((estimateId: string, tier: 'good' | 'better' | 'best') => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const est = s.estimates.find((e) => e.id === estimateId)
      if (est) est.selectedTier = tier
      return s
    })
  }, [])

  const convertEstimateToInvoice = useCallback((estimateId: string): string | null => {
    let newId: string | null = null
    setStore((prev) => {
      const s = structuredClone(prev)
      const est = s.estimates.find((e) => e.id === estimateId)
      if (!est) return prev
      if (s.invoices.some((i) => i.jobId === est.jobId)) {
        newId = s.invoices.find((i) => i.jobId === est.jobId)!.id
        return prev
      }
      const tierRank = { good: 0, better: 1, best: 2 }
      const cap = tierRank[est.selectedTier ?? 'best']
      const items = est.lineItems.filter((li) => tierRank[li.tier] <= cap)
      const subtotal = items.reduce((sum, li) => sum + li.qty * li.unitPrice, 0)
      const total = Math.round(subtotal * (1 + est.taxRate))
      const id = `inv_${Date.now()}`
      newId = id
      const now = new Date()
      const due = new Date(now.getTime() + 30 * 86400000)
      s.invoices.unshift({
        id,
        number: `INV-${1000 + s.invoices.length + 1}`,
        jobId: est.jobId,
        contactId: est.contactId,
        status: 'draft',
        issuedAt: now.toISOString(),
        dueAt: due.toISOString(),
        total,
        payments: [],
      })
      pushTimeline(s, {
        jobId: est.jobId,
        kind: 'invoice',
        authorId: author(s).id,
        authorName: author(s).name,
        body: `Invoice created from estimate ${est.number}`,
        createdAt: now.toISOString(),
      })
      return s
    })
    return newId
  }, [author])

  const revertAgentActivity = useCallback((activityId: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const a = s.agentActivity.find((x) => x.id === activityId)
      if (a && a.revertable) a.reverted = !a.reverted
      return s
    })
  }, [])

  const resolveApproval = useCallback((approvalId: string, decision: 'approved' | 'denied') => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const ap = s.agentApprovals.find((x) => x.id === approvalId)
      if (!ap) return prev
      ap.status = decision
      // When approved, record it as an agent activity so the "Today" feed reflects it.
      if (decision === 'approved') {
        s.agentActivity.unshift({
          id: `aa_${Date.now()}`,
          at: new Date().toISOString(),
          kind: ap.kind === 'estimate' ? 'estimate' : ap.kind === 'refund' ? 'invoice' : 'sms',
          title: `Approved: ${ap.title}`,
          evidence: { kind: 'note', label: 'Action executed', body: ap.preview },
          jobId: ap.jobId,
          contactId: ap.contactId,
          revertable: true,
        })
      }
      return s
    })
  }, [])

  const sendSuggestion = useCallback((suggestionId: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const sg = s.aiSuggestions.find((x) => x.id === suggestionId)
      if (!sg) return prev
      sg.status = 'sent'
      if (sg.draft) {
        pushTimeline(s, {
          jobId: sg.jobId,
          kind: 'sms',
          authorId: 'ai',
          authorName: 'Janus AI',
          body: sg.draft,
          createdAt: new Date().toISOString(),
        })
        s.agentActivity.unshift({
          id: `aa_${Date.now()}`,
          at: new Date().toISOString(),
          kind: 'sms',
          title: `Sent the recommended text on ${s.jobs.find((j) => j.id === sg.jobId)?.title ?? 'a job'}`,
          evidence: { kind: 'message', label: 'Text sent', body: sg.draft },
          jobId: sg.jobId,
          revertable: true,
        })
      }
      return s
    })
  }, [])

  const dismissSuggestion = useCallback((suggestionId: string) => {
    setStore((prev) => {
      const s = structuredClone(prev)
      const sg = s.aiSuggestions.find((x) => x.id === suggestionId)
      if (sg) sg.status = 'dismissed'
      return s
    })
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({
      store,
      now: NOW_ISO,
      currentUserId,
      role,
      setSession,
      moveSalesStage,
      moveProductionStage,
      scheduleJob,
      addTimelineEntry,
      toggleAutomation,
      addAutomation,
      setAutomationAutonomy,
      linkConversation,
      markConversationRead,
      addPhoto,
      recordPayment,
      sendEstimate,
      signEstimate,
      selectEstimateTier,
      convertEstimateToInvoice,
      revertAgentActivity,
      resolveApproval,
      sendSuggestion,
      dismissSuggestion,
    }),
    [store, currentUserId, role, setSession, moveSalesStage, moveProductionStage, scheduleJob, addTimelineEntry, toggleAutomation, addAutomation, setAutomationAutonomy, linkConversation, markConversationRead, addPhoto, recordPayment, sendEstimate, signEstimate, selectEstimateTier, convertEstimateToInvoice, revertAgentActivity, resolveApproval, sendSuggestion, dismissSuggestion],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

// -------- Convenience selectors (read directly from the live store) ---------
export function useJobs() {
  return useData().store.jobs
}
export function useContacts() {
  return useData().store.contacts
}
export function useEmployees() {
  return useData().store.employees
}
export function useEstimates() {
  return useData().store.estimates
}
export function useInvoices() {
  return useData().store.invoices
}
export function useConversations() {
  return useData().store.conversations
}
export function useAutomations() {
  return useData().store.automations
}
export function useAutomationRuns() {
  return useData().store.automationRuns
}
export function useReceptionistCalls() {
  return useData().store.receptionistCalls
}
export function useAgentActivity() {
  return useData().store.agentActivity
}
export function useAgentApprovals() {
  return useData().store.agentApprovals
}
export function useAiSuggestions(jobId?: string) {
  const { store } = useData()
  return jobId ? store.aiSuggestions.filter((s) => s.jobId === jobId) : store.aiSuggestions
}
export function useAiCalls() {
  return useData().store.aiCalls
}
export function useJob(id: string | null | undefined) {
  const { store } = useData()
  return id ? store.jobs.find((j) => j.id === id) ?? null : null
}
export function useContact(id: string | null | undefined) {
  const { store } = useData()
  return id ? store.contacts.find((c) => c.id === id) ?? null : null
}
export function useTimeline(jobId: string) {
  const { store } = useData()
  return store.timeline.filter((t) => t.jobId === jobId)
}
export function usePhotos(jobId: string) {
  const { store } = useData()
  return store.photos.filter((p) => p.jobId === jobId)
}
export function useDocuments(jobId: string) {
  const { store } = useData()
  return store.documents.filter((d) => d.jobId === jobId)
}
