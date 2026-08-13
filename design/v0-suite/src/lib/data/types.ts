// ---------------------------------------------------------------------------
// Janus domain model. Kept intentionally decoupled from any storage backend so
// that the repository layer (repositories.ts) can be swapped for a real API/DB
// without touching UI code.
// ---------------------------------------------------------------------------

export type Role = 'owner' | 'office' | 'field'

export type SalesStage =
  | 'new_lead'
  | 'inspection_scheduled'
  | 'inspected'
  | 'estimate_sent'
  | 'approved'
  | 'lost'

export type ProductionStage =
  | 'approved'
  | 'materials_ordered'
  | 'scheduled'
  | 'in_progress'
  | 'punch_list'
  | 'final_invoice'
  | 'paid'

export type JobType = 'roof_replacement' | 'roof_repair' | 'inspection' | 'gutters' | 'storm_damage'

export type ContactSource = 'referral' | 'google' | 'facebook' | 'door_knock' | 'repeat' | 'website' | 'yard_sign'

export interface Employee {
  id: string
  name: string
  role: Role
  title: string
  phone: string
  email: string
  avatarColor: string
  initials: string
  crew?: string // crew name for field techs
}

export interface Contact {
  id: string
  name: string
  address: string
  city: string
  zip: string
  phone: string
  email: string
  source: ContactSource
  createdAt: string
  lifetimeValue: number
}

export type TimelineEntryKind = 'note' | 'call' | 'sms' | 'system' | 'estimate' | 'invoice' | 'stage_change'

export interface TimelineEntry {
  id: string
  jobId: string
  kind: TimelineEntryKind
  authorId: string // employee id or "system" or "ai"
  authorName: string
  body: string
  createdAt: string
  meta?: {
    direction?: 'inbound' | 'outbound'
    durationSec?: number
    outcome?: CallOutcome
    fromStage?: string
    toStage?: string
  }
}

export type CallOutcome = 'booked' | 'message' | 'transferred' | 'missed'

export interface JobPhoto {
  id: string
  jobId: string
  url: string
  caption: string
  uploadedBy: string
  uploadedAt: string
}

export interface JobDocument {
  id: string
  jobId: string
  name: string
  type: string
  sizeKb: number
  uploadedAt: string
}

export interface InsuranceInfo {
  carrier: string
  claimNumber: string
  adjuster: string
  adjusterPhone: string
  deductible: number
}

export interface Job {
  id: string
  contactId: string
  title: string
  jobType: JobType
  salesStage: SalesStage
  productionStage?: ProductionStage
  value: number
  repId: string
  crewName?: string
  scheduledDate?: string // ISO date for production scheduling
  stageEnteredAt: string // for days-in-stage
  createdAt: string
  won: boolean
  insurance?: InsuranceInfo
}

export type EstimateStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined'
export type EstimateTier = 'good' | 'better' | 'best'

export interface EstimateLineItem {
  id: string
  section: string
  description: string
  qty: number
  unitPrice: number
  tier: EstimateTier
  photoUrl?: string
}

export interface Estimate {
  id: string
  number: string
  jobId: string
  contactId: string
  status: EstimateStatus
  createdAt: string
  sentAt?: string
  signedAt?: string
  selectedTier?: EstimateTier
  taxRate: number
  lineItems: EstimateLineItem[]
  signatureStatus: 'not_sent' | 'awaiting' | 'signed'
}

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  method: 'card' | 'check' | 'cash' | 'ach'
  date: string
  note?: string
}

export interface Invoice {
  id: string
  number: string
  jobId: string
  contactId: string
  status: InvoiceStatus
  issuedAt: string
  dueAt: string
  total: number
  payments: Payment[]
}

export type MessageDirection = 'inbound' | 'outbound'

export interface Message {
  id: string
  conversationId: string
  kind: 'sms' | 'call'
  direction: MessageDirection
  body: string
  createdAt: string
  durationSec?: number
  aiHandled?: boolean
  outcome?: CallOutcome
  transcript?: string
}

export interface Conversation {
  id: string
  contactId?: string // undefined => unmatched inbound number
  phone: string
  displayName: string
  unread: boolean
  lastActivityAt: string
  messages: Message[]
}

export type AutomationActionKind = 'sms' | 'email' | 'task' | 'stage' | 'notify'

export interface AutomationAction {
  kind: AutomationActionKind
  label: string
  preview?: string
}

export type AutomationAutonomy = 'auto' | 'auto_logged' | 'ask_first'

export interface Automation {
  id: string
  sentence: string
  triggerLabel: string
  actions: AutomationAction[]
  enabled: boolean
  runCount: number
  createdAt: string
  autonomy: AutomationAutonomy
}

export interface AutomationRun {
  id: string
  automationId: string
  automationName: string
  triggerLabel: string
  jobId?: string
  jobLabel: string
  actionsTaken: string[]
  status: 'success' | 'skipped' | 'error'
  ranAt: string
}

export interface ReceptionistCall {
  id: string
  callerName: string
  phone: string
  outcome: CallOutcome
  summary: string
  at: string
}

// --------------------------- Agentic layer ---------------------------------

export type AgentActivityKind =
  | 'call'
  | 'sms'
  | 'email'
  | 'estimate'
  | 'schedule'
  | 'materials'
  | 'invoice'
  | 'task'

export type AgentEvidenceKind = 'message' | 'transcript' | 'document' | 'note'

export interface AgentActivity {
  id: string
  at: string
  kind: AgentActivityKind
  /** Plain-English description of what the AI did. */
  title: string
  /** Optional supporting evidence shown inline. */
  evidence?: {
    kind: AgentEvidenceKind
    label: string
    body: string
  }
  jobId?: string
  contactId?: string
  /** Whether this action can be reverted/undone. */
  revertable: boolean
  reverted?: boolean
}

export type ApprovalKind = 'estimate' | 'refund' | 'bulk_sms' | 'discount'

export interface AgentApproval {
  id: string
  at: string
  kind: ApprovalKind
  title: string
  /** Why this needs approval (blast radius). */
  reason: string
  /** Exact preview of what will happen if approved. */
  preview: string
  amount?: number
  recipients?: number
  jobId?: string
  contactId?: string
  status: 'pending' | 'approved' | 'denied'
}

export type SuggestionKind = 'nudge' | 'schedule' | 'upsell' | 'collect' | 'followup' | 'risk'

export interface JobAiSuggestion {
  id: string
  jobId: string
  kind: SuggestionKind
  /** The agent's read on the job. */
  insight: string
  /** Recommended next action. */
  recommendation: string
  /** Draft message ready to send, if applicable. */
  draft?: string
  confidence: number
  status: 'open' | 'sent' | 'dismissed'
}

export interface AiCallTurn {
  speaker: 'caller' | 'agent'
  text: string
  /** Optional decision the agent made on this turn. */
  decision?: string
}

export interface AiCall {
  id: string
  callerName: string
  phone: string
  at: string
  durationSec: number
  outcome: CallOutcome
  confidence: number
  extracted: {
    name: string
    address: string
    issue: string
    urgency: 'routine' | 'soon' | 'emergency'
  }
  actionsTaken: string[]
  transcript: AiCallTurn[]
  contactId?: string
}
