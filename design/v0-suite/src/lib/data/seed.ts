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
  AgentActivity,
  AgentApproval,
  JobAiSuggestion,
  AiCall,
} from './types'

// Deterministic date helpers so the demo is stable relative to "now".
const NOW = new Date('2026-08-13T14:30:00')
export const NOW_ISO = NOW.toISOString()

function daysAgo(d: number, h = 0): string {
  const t = new Date(NOW)
  t.setDate(t.getDate() - d)
  t.setHours(NOW.getHours() - h)
  return t.toISOString()
}
function daysAhead(d: number): string {
  const t = new Date(NOW)
  t.setDate(t.getDate() + d)
  return t.toISOString()
}

const AVATAR_COLORS = [
  'oklch(0.62 0.16 52)',
  'oklch(0.58 0.12 245)',
  'oklch(0.62 0.14 152)',
  'oklch(0.6 0.18 15)',
  'oklch(0.55 0.13 300)',
  'oklch(0.6 0.12 190)',
  'oklch(0.65 0.15 90)',
]

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// --------------------------- Employees (14) --------------------------------
const empRaw: Array<[string, Employee['role'], string, string]> = [
  ['Dale Whitfield', 'owner', 'Owner / Operator', 'crew'],
  ['Brenda Whitfield', 'office', 'Office Manager', ''],
  ['Tammy Rourke', 'office', 'Sales Coordinator', ''],
  ['Marcus Boykin', 'office', 'Sales Rep', ''],
  ['Cody Pruitt', 'office', 'Sales Rep', ''],
  ['Levi Stallworth', 'field', 'Crew Lead', 'Crew A'],
  ['Jesse Kirkland', 'field', 'Roofer', 'Crew A'],
  ['Travis McCall', 'field', 'Crew Lead', 'Crew B'],
  ['Hank Devereaux', 'field', 'Roofer', 'Crew B'],
  ['Otis Pettway', 'field', 'Crew Lead', 'Crew C'],
  ['Wyatt Sanderson', 'field', 'Roofer', 'Crew C'],
  ['Earl Beauchamp', 'field', 'Roofer', 'Crew A'],
  ['Dwayne Fortner', 'field', 'Estimator', ''],
  ['Colton Rhea', 'field', 'Roofer', 'Crew B'],
]

export const employees: Employee[] = empRaw.map(([name, role, title, crew], i) => ({
  id: `emp_${i + 1}`,
  name,
  role,
  title,
  crew: crew || undefined,
  phone: `(205) 555-0${(100 + i).toString()}`,
  email: `${name.split(' ')[0].toLowerCase()}@summitridgeroofing.com`,
  avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
  initials: initials(name),
}))

export const reps = employees.filter((e) => e.role === 'office' || e.role === 'owner')
export const crews = ['Crew A', 'Crew B', 'Crew C']

// --------------------------- Contacts (40) ---------------------------------
const firstNames = [
  'James', 'Mary', 'Robert', 'Patricia', 'Willie', 'Linda', 'Bo', 'Barbara', 'Junior', 'Susan',
  'Clayton', 'Jessica', 'Roy', 'Sarah', 'Bubba', 'Karen', 'Delbert', 'Nancy', 'Cletus', 'Betty',
  'Ray', 'Donna', 'Merle', 'Carol', 'Lamar', 'Ruth', 'Gaylen', 'Sharon', 'Buck', 'Michelle',
  'Roscoe', 'Laura', 'Odell', 'Kimberly', 'Vernon', 'Amy', 'Floyd', 'Angela', 'Elroy', 'Melissa',
]
const lastNames = [
  'Prewitt', 'Culpepper', 'Tolliver', 'Sizemore', 'Bledsoe', 'Gantt', 'Ledbetter', 'Hollis', 'Crumpton',
  'Odom', 'Sasser', 'Vickery', 'Rutledge', 'Dabbs', 'Meacham', 'Threadgill', 'Sconyers', 'Aldridge',
  'Bagwell', 'Pinckney', 'Hutto', 'Weatherford', 'Tanksley', 'Wiggins', 'Ridgeway', 'Coker', 'Faulkner',
  'Musgrove', 'Yeager', 'Strickland', 'Padgett', 'Nolen', 'Barfield', 'Ainsworth', 'Grissom', 'Sellers',
  'Hendrix', 'Croft', 'Beasley', 'Windham',
]
const streets = [
  'Old Shell Rd', 'Vestavia Dr', 'Cahaba River Rd', 'Hoover Ct', 'Chalkville Ln', 'Pelham Pkwy',
  'Trussville Way', 'Alabaster Ave', 'Helena Loop', 'Bessemer Rd', 'Homewood Blvd', 'Mountain Brook Cir',
  'Springville Rd', 'Gardendale Ave', 'Fultondale St', 'Leeds Trace', 'Moody Ridge', 'Clay Rd',
]
const cities = [
  ['Birmingham', '35205'], ['Vestavia Hills', '35216'], ['Hoover', '35244'], ['Pelham', '35124'],
  ['Trussville', '35173'], ['Alabaster', '35007'], ['Helena', '35080'], ['Homewood', '35209'],
  ['Mountain Brook', '35223'], ['Gardendale', '35071'],
]
const sources: Contact['source'][] = ['referral', 'google', 'facebook', 'door_knock', 'repeat', 'website', 'yard_sign']

export const contacts: Contact[] = Array.from({ length: 40 }).map((_, i) => {
  const name = `${firstNames[i]} ${lastNames[i]}`
  const [city, zip] = cities[i % cities.length]
  return {
    id: `con_${i + 1}`,
    name,
    address: `${1200 + i * 37} ${streets[i % streets.length]}`,
    city,
    zip,
    phone: `(205) 555-${(2000 + i).toString().padStart(4, '0')}`,
    email: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@gmail.com`,
    source: sources[i % sources.length],
    createdAt: daysAgo(90 - i),
    lifetimeValue: 0, // filled after jobs
  }
})

// --------------------------- Jobs (~25) ------------------------------------
type JobSeed = {
  con: number
  type: Job['jobType']
  sales: Job['salesStage']
  prod?: Job['productionStage']
  value: number
  rep: string
  crew?: string
  sched?: string
  stageDays: number
  won: boolean
  ins?: boolean
}

const jobSeeds: JobSeed[] = [
  // New leads
  { con: 0, type: 'storm_damage', sales: 'new_lead', value: 18500, rep: 'emp_4', stageDays: 1, won: false, ins: true },
  { con: 1, type: 'roof_repair', sales: 'new_lead', value: 2400, rep: 'emp_5', stageDays: 2, won: false },
  { con: 2, type: 'roof_replacement', sales: 'new_lead', value: 21000, rep: 'emp_4', stageDays: 9, won: false },
  // Inspection scheduled
  { con: 3, type: 'roof_replacement', sales: 'inspection_scheduled', value: 24500, rep: 'emp_5', stageDays: 3, won: false, ins: true },
  { con: 4, type: 'inspection', sales: 'inspection_scheduled', value: 0, rep: 'emp_4', stageDays: 1, won: false },
  { con: 5, type: 'gutters', sales: 'inspection_scheduled', value: 3800, rep: 'emp_5', stageDays: 5, won: false },
  // Inspected
  { con: 6, type: 'roof_replacement', sales: 'inspected', value: 27800, rep: 'emp_4', stageDays: 4, won: false, ins: true },
  { con: 7, type: 'roof_repair', sales: 'inspected', value: 4100, rep: 'emp_5', stageDays: 11, won: false },
  { con: 8, type: 'storm_damage', sales: 'inspected', value: 31200, rep: 'emp_4', stageDays: 2, won: false, ins: true },
  // Estimate sent
  { con: 9, type: 'roof_replacement', sales: 'estimate_sent', value: 22600, rep: 'emp_5', stageDays: 6, won: false },
  { con: 10, type: 'roof_replacement', sales: 'estimate_sent', value: 19900, rep: 'emp_4', stageDays: 8, won: false, ins: true },
  { con: 11, type: 'gutters', sales: 'estimate_sent', value: 4500, rep: 'emp_5', stageDays: 3, won: false },
  // Approved (also enter production)
  { con: 12, type: 'roof_replacement', sales: 'approved', prod: 'approved', value: 26400, rep: 'emp_4', stageDays: 1, won: true, ins: true },
  { con: 13, type: 'roof_replacement', sales: 'approved', prod: 'materials_ordered', value: 28900, rep: 'emp_5', crew: 'Crew A', sched: daysAhead(4), stageDays: 2, won: true },
  { con: 14, type: 'storm_damage', sales: 'approved', prod: 'scheduled', value: 33500, rep: 'emp_4', crew: 'Crew B', sched: daysAhead(1), stageDays: 3, won: true, ins: true },
  { con: 15, type: 'roof_replacement', sales: 'approved', prod: 'scheduled', value: 24200, rep: 'emp_5', crew: 'Crew C', sched: NOW_ISO, stageDays: 1, won: true },
  { con: 16, type: 'roof_replacement', sales: 'approved', prod: 'in_progress', value: 29900, rep: 'emp_4', crew: 'Crew A', sched: NOW_ISO, stageDays: 2, won: true, ins: true },
  { con: 17, type: 'roof_repair', sales: 'approved', prod: 'in_progress', value: 6700, rep: 'emp_5', crew: 'Crew B', sched: NOW_ISO, stageDays: 1, won: true },
  { con: 18, type: 'roof_replacement', sales: 'approved', prod: 'punch_list', value: 27300, rep: 'emp_4', crew: 'Crew C', sched: daysAgo(2), stageDays: 2, won: true },
  { con: 19, type: 'roof_replacement', sales: 'approved', prod: 'final_invoice', value: 25600, rep: 'emp_5', crew: 'Crew A', sched: daysAgo(6), stageDays: 3, won: true, ins: true },
  { con: 20, type: 'roof_replacement', sales: 'approved', prod: 'paid', value: 23400, rep: 'emp_4', crew: 'Crew B', sched: daysAgo(20), stageDays: 8, won: true },
  { con: 21, type: 'storm_damage', sales: 'approved', prod: 'paid', value: 34900, rep: 'emp_5', crew: 'Crew C', sched: daysAgo(28), stageDays: 12, won: true, ins: true },
  // Lost
  { con: 22, type: 'roof_replacement', sales: 'lost', value: 20100, rep: 'emp_4', stageDays: 14, won: false },
  { con: 23, type: 'roof_repair', sales: 'lost', value: 3200, rep: 'emp_5', stageDays: 22, won: false },
  { con: 24, type: 'gutters', sales: 'lost', value: 2900, rep: 'emp_4', stageDays: 19, won: false },
]

const jobTitles: Record<Job['jobType'], string> = {
  roof_replacement: 'Full Roof Replacement',
  roof_repair: 'Roof Repair',
  inspection: 'Roof Inspection',
  gutters: 'Gutter Install',
  storm_damage: 'Storm Damage / Insurance',
}

const carriers = ['State Farm', 'Alfa Insurance', 'Allstate', 'Farmers', 'Nationwide']

export const jobs: Job[] = jobSeeds.map((s, i) => {
  const c = contacts[s.con]
  return {
    id: `job_${i + 1}`,
    contactId: c.id,
    title: `${jobTitles[s.type]} — ${c.name}`,
    jobType: s.type,
    salesStage: s.sales,
    productionStage: s.prod,
    value: s.value,
    repId: s.rep,
    crewName: s.crew,
    scheduledDate: s.sched,
    stageEnteredAt: daysAgo(s.stageDays),
    createdAt: daysAgo(s.stageDays + 5),
    won: s.won,
    insurance: s.ins
      ? {
          carrier: carriers[i % carriers.length],
          claimNumber: `CLM-${2026}-${(1000 + i).toString()}`,
          adjuster: `${firstNames[(i + 5) % firstNames.length]} ${lastNames[(i + 3) % lastNames.length]}`,
          adjusterPhone: `(800) 555-${(3000 + i).toString().padStart(4, '0')}`,
          deductible: 1000 + (i % 3) * 500,
        }
      : undefined,
  }
})

// Fill contact lifetime value from won/paid jobs
for (const j of jobs) {
  const c = contacts.find((x) => x.id === j.contactId)
  if (c && j.won) c.lifetimeValue += j.value
}
// Give a few repeat customers extra history value
contacts[20].lifetimeValue += 18900
contacts[4].lifetimeValue += 12400

// --------------------------- Timeline entries ------------------------------
const stageLabels: Record<string, string> = {
  new_lead: 'New Lead',
  inspection_scheduled: 'Inspection Scheduled',
  inspected: 'Inspected',
  estimate_sent: 'Estimate Sent',
  approved: 'Approved',
  lost: 'Lost',
}

export const timeline: TimelineEntry[] = []
let tId = 1
function addEntry(e: Omit<TimelineEntry, 'id'>) {
  timeline.push({ id: `tl_${tId++}`, ...e })
}

for (const j of jobs) {
  const c = contacts.find((x) => x.id === j.contactId)!
  const rep = employees.find((e) => e.id === j.repId)!
  const base = j.stageEnteredAt

  addEntry({
    jobId: j.id,
    kind: 'system',
    authorId: 'system',
    authorName: 'System',
    body: `Lead created from ${c.source.replace('_', ' ')}`,
    createdAt: j.createdAt,
  })
  addEntry({
    jobId: j.id,
    kind: 'call',
    authorId: 'ai',
    authorName: 'AI Receptionist',
    body: `Answered inbound call from ${c.name}. Collected address and roof concern, booked inspection.`,
    createdAt: daysAgo(20),
    meta: { direction: 'inbound', durationSec: 184, outcome: 'booked' },
  })
  addEntry({
    jobId: j.id,
    kind: 'note',
    authorId: rep.id,
    authorName: rep.name,
    body: `Spoke with ${c.name.split(' ')[0]}. ${j.jobType === 'storm_damage' ? 'Hail damage from last month\u2019s storm, wants insurance help.' : 'Interested in a quote, roof is ~18 years old.'}`,
    createdAt: daysAgo(18),
  })
  if (['inspected', 'estimate_sent', 'approved', 'lost'].includes(j.salesStage)) {
    addEntry({
      jobId: j.id,
      kind: 'sms',
      authorId: rep.id,
      authorName: rep.name,
      body: 'Hey! Confirming your roof inspection for tomorrow between 9-11am. Reply C to confirm.',
      createdAt: daysAgo(12),
      meta: { direction: 'outbound' },
    })
    addEntry({
      jobId: j.id,
      kind: 'sms',
      authorId: 'contact',
      authorName: c.name,
      body: 'C',
      createdAt: daysAgo(12),
      meta: { direction: 'inbound' },
    })
  }
  addEntry({
    jobId: j.id,
    kind: 'stage_change',
    authorId: 'system',
    authorName: 'System',
    body: `Stage changed to ${stageLabels[j.salesStage] ?? j.salesStage}`,
    createdAt: base,
    meta: { toStage: j.salesStage },
  })
}
timeline.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

// --------------------------- Photos & documents ----------------------------
export const photos: JobPhoto[] = []
const photoCaptions = ['Before — north slope', 'Hail bruising on shingles', 'Ridge vent detail', 'After — completed', 'Drip edge close-up', 'Flashing repair']
jobs
  .filter((j) => j.won)
  .forEach((j, ji) => {
    for (let p = 0; p < 4; p++) {
      photos.push({
        id: `ph_${ji}_${p}`,
        jobId: j.id,
        url: `/roof-photo.png?height=240&width=320&query=roof%20${p % 2 ? 'shingle%20close%20up' : 'house%20roof%20aerial'}`,
        caption: photoCaptions[(p + ji) % photoCaptions.length],
        uploadedBy: 'Levi Stallworth',
        uploadedAt: daysAgo(3 + p),
      })
    }
  })

export const documents: JobDocument[] = jobs
  .filter((j) => j.insurance)
  .map((j, i) => ({
    id: `doc_${i}`,
    jobId: j.id,
    name: `Insurance Scope - ${j.insurance!.claimNumber}.pdf`,
    type: 'PDF',
    sizeKb: 240 + i * 18,
    uploadedAt: daysAgo(7),
  }))

// --------------------------- Estimates -------------------------------------
function buildLineItems(value: number): Estimate['lineItems'] {
  const base = Math.round(value * 0.62)
  return [
    { id: 'li1', section: 'Tear-off & Prep', description: 'Remove existing shingles, haul-off & dumpster', qty: 1, unitPrice: Math.round(base * 0.2), tier: 'good' },
    { id: 'li2', section: 'Materials', description: 'Architectural shingles (30-yr) — GAF Timberline HDZ', qty: 1, unitPrice: Math.round(base * 0.35), tier: 'good', photoUrl: '/gaf-timberline-shingle.png' },
    { id: 'li3', section: 'Materials', description: 'Synthetic underlayment & ice-and-water shield', qty: 1, unitPrice: Math.round(base * 0.12), tier: 'better' },
    { id: 'li4', section: 'Labor', description: 'Installation labor & cleanup', qty: 1, unitPrice: Math.round(base * 0.25), tier: 'good' },
    { id: 'li5', section: 'Upgrades', description: 'Premium ridge vent + designer ridge cap', qty: 1, unitPrice: Math.round(base * 0.08), tier: 'best' },
  ]
}

const estStatuses: Estimate['status'][] = ['draft', 'sent', 'viewed', 'signed', 'declined']
export const estimates: Estimate[] = jobs
  .filter((j) => ['estimate_sent', 'approved', 'lost', 'inspected'].includes(j.salesStage) && j.value > 0)
  .map((j, i) => {
    const status: Estimate['status'] =
      j.salesStage === 'approved' ? 'signed' : j.salesStage === 'lost' ? 'declined' : estStatuses[i % 3 + 1]
    return {
      id: `est_${i + 1}`,
      number: `EST-${1040 + i}`,
      jobId: j.id,
      contactId: j.contactId,
      status,
      createdAt: daysAgo(10 - (i % 5)),
      sentAt: status !== 'draft' ? daysAgo(8 - (i % 5)) : undefined,
      signedAt: status === 'signed' ? daysAgo(3) : undefined,
      selectedTier: status === 'signed' ? 'better' : undefined,
      taxRate: 0.09,
      lineItems: buildLineItems(j.value),
      signatureStatus: status === 'signed' ? 'signed' : status === 'sent' || status === 'viewed' ? 'awaiting' : 'not_sent',
    }
  })

// --------------------------- Invoices --------------------------------------
const invStatusByProd: Partial<Record<NonNullable<Job['productionStage']>, Invoice['status']>> = {
  final_invoice: 'sent',
  paid: 'paid',
  punch_list: 'draft',
  in_progress: 'draft',
}
export const invoices: Invoice[] = jobs
  .filter((j) => j.won)
  .map((j, i) => {
    let status: Invoice['status'] = invStatusByProd[j.productionStage!] ?? 'draft'
    // add some variety: overdue + partial
    if (i === 2) status = 'overdue'
    if (i === 3) status = 'partial'
    const issued = daysAgo(status === 'overdue' ? 45 : status === 'partial' ? 20 : 10 - (i % 6))
    const due = daysAgo(status === 'overdue' ? 15 : -20)
    const payments =
      status === 'paid'
        ? [{ id: `pay_${i}a`, invoiceId: `inv_${i}`, amount: j.value, method: 'check' as const, date: daysAgo(5), note: 'Paid in full' }]
        : status === 'partial'
          ? [{ id: `pay_${i}b`, invoiceId: `inv_${i}`, amount: Math.round(j.value * 0.5), method: 'card' as const, date: daysAgo(10), note: 'Deposit' }]
          : []
    return {
      id: `inv_${i}`,
      number: `INV-${2100 + i}`,
      jobId: j.id,
      contactId: j.contactId,
      status,
      issuedAt: issued,
      dueAt: due,
      total: j.value,
      payments,
    }
  })

// --------------------------- Conversations / Inbox -------------------------
export const conversations: Conversation[] = []
contacts.slice(0, 12).forEach((c, i) => {
  const aiCall = i % 3 === 0
  const msgs = [
    aiCall
      ? {
          id: `m_${i}_0`,
          conversationId: `conv_${i}`,
          kind: 'call' as const,
          direction: 'inbound' as const,
          body: 'Inbound call answered by AI Receptionist',
          createdAt: daysAgo(2, i),
          durationSec: 132 + i * 9,
          aiHandled: true,
          outcome: (['booked', 'message', 'transferred', 'missed'] as const)[i % 4],
          transcript: `Caller: Hi, my roof's been leaking after the storm.\nJanus AI: I'm sorry to hear that! I can get one of our inspectors out. What's the property address?\nCaller: ${c.address}, ${c.city}.\nJanus AI: Perfect. I have an opening tomorrow morning between 9 and 11 — does that work?\nCaller: That works.\nJanus AI: You're booked. You'll get a text confirmation shortly.`,
        }
      : {
          id: `m_${i}_0`,
          conversationId: `conv_${i}`,
          kind: 'sms' as const,
          direction: 'inbound' as const,
          body: 'Hi, is someone able to come look at my roof this week?',
          createdAt: daysAgo(2, i),
        },
    {
      id: `m_${i}_1`,
      conversationId: `conv_${i}`,
      kind: 'sms' as const,
      direction: 'outbound' as const,
      body: `Absolutely, ${c.name.split(' ')[0]}! We can have an inspector out Thursday. Does morning or afternoon work better?`,
      createdAt: daysAgo(2, i - 1),
    },
    {
      id: `m_${i}_2`,
      conversationId: `conv_${i}`,
      kind: 'sms' as const,
      direction: 'inbound' as const,
      body: 'Morning is better, thanks!',
      createdAt: daysAgo(1, i),
    },
  ]
  conversations.push({
    id: `conv_${i}`,
    contactId: c.id,
    phone: c.phone,
    displayName: c.name,
    unread: i % 4 === 0,
    lastActivityAt: msgs[msgs.length - 1].createdAt,
    messages: msgs,
  })
})
// Two unmatched inbound numbers for triage strip
conversations.unshift({
  id: 'conv_unmatched_1',
  phone: '(205) 555-8841',
  displayName: '(205) 555-8841',
  unread: true,
  lastActivityAt: daysAgo(0, 3),
  messages: [
    {
      id: 'um1_0',
      conversationId: 'conv_unmatched_1',
      kind: 'sms',
      direction: 'inbound',
      body: 'yall do metal roofs? got a quote from someone else for 32k',
      createdAt: daysAgo(0, 3),
    },
  ],
})
conversations.unshift({
  id: 'conv_unmatched_2',
  phone: '(256) 555-1207',
  displayName: '(256) 555-1207',
  unread: true,
  lastActivityAt: daysAgo(0, 1),
  messages: [
    {
      id: 'um2_0',
      conversationId: 'conv_unmatched_2',
      kind: 'call',
      direction: 'inbound',
      body: 'Missed call — no voicemail',
      createdAt: daysAgo(0, 1),
      durationSec: 0,
      aiHandled: true,
      outcome: 'missed',
    },
  ],
})
conversations.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))

// --------------------------- Automations -----------------------------------
export const automations: Automation[] = [
  {
    id: 'auto_1',
    sentence: 'When an estimate is signed, text the customer a thank-you and create a materials-ordering task.',
    triggerLabel: 'Estimate signed',
    actions: [
      { kind: 'sms', label: 'Text customer thank-you' },
      { kind: 'task', label: 'Create materials task' },
    ],
    enabled: true,
    runCount: 42,
    autonomy: 'auto_logged',
    createdAt: daysAgo(120),
  },
  {
    id: 'auto_2',
    sentence: 'When a new lead comes in and no one replies within 5 minutes, text the lead and notify the on-call rep.',
    triggerLabel: 'Lead unanswered 5 min',
    actions: [
      { kind: 'sms', label: 'Auto-reply to lead' },
      { kind: 'notify', label: 'Notify on-call rep' },
    ],
    enabled: true,
    runCount: 88,
    autonomy: 'auto',
    createdAt: daysAgo(140),
  },
  {
    id: 'auto_3',
    sentence: 'When a job moves to In Progress, text the homeowner that the crew is on the way.',
    triggerLabel: 'Job \u2192 In Progress',
    actions: [{ kind: 'sms', label: 'Text homeowner crew ETA' }],
    enabled: true,
    runCount: 61,
    autonomy: 'auto',
    createdAt: daysAgo(100),
  },
  {
    id: 'auto_4',
    sentence: 'When an invoice becomes 15 days overdue, text a payment-link reminder and flag it for the office.',
    triggerLabel: 'Invoice 15 days overdue',
    actions: [
      { kind: 'sms', label: 'Text payment link' },
      { kind: 'notify', label: 'Flag for office' },
    ],
    enabled: true,
    runCount: 19,
    autonomy: 'auto_logged',
    createdAt: daysAgo(90),
  },
  {
    id: 'auto_5',
    sentence: 'When a job is marked complete, email the customer a review request with a Google link.',
    triggerLabel: 'Job completed',
    actions: [{ kind: 'email', label: 'Email review request' }],
    enabled: false,
    runCount: 27,
    autonomy: 'ask_first',
    createdAt: daysAgo(70),
  },
  {
    id: 'auto_6',
    sentence: 'When an insurance job is created, create a task to request the adjuster scope and set a 3-day follow-up.',
    triggerLabel: 'Insurance job created',
    actions: [
      { kind: 'task', label: 'Request adjuster scope' },
      { kind: 'task', label: 'Set 3-day follow-up' },
    ],
    enabled: true,
    runCount: 34,
    autonomy: 'auto_logged',
    createdAt: daysAgo(60),
  },
]

export const automationRuns: AutomationRun[] = Array.from({ length: 28 }).map((_, i) => {
  const a = automations[i % automations.length]
  const j = jobs[i % jobs.length]
  const c = contacts.find((x) => x.id === j.contactId)!
  const status: AutomationRun['status'] = i % 11 === 0 ? 'skipped' : i % 17 === 0 ? 'error' : 'success'
  return {
    id: `run_${i + 1}`,
    automationId: a.id,
    automationName: a.triggerLabel,
    triggerLabel: a.triggerLabel,
    jobId: j.id,
    jobLabel: `${c.name} — ${jobTitles[j.jobType]}`,
    actionsTaken: a.actions.map((x) => x.label),
    status,
    ranAt: daysAgo(Math.floor(i / 2), i % 24),
  }
})

// --------------------------- Receptionist feed -----------------------------
export const receptionistCalls: ReceptionistCall[] = Array.from({ length: 8 }).map((_, i) => {
  const c = contacts[(i * 3) % contacts.length]
  const outcome = (['booked', 'message', 'booked', 'transferred', 'booked', 'missed', 'message', 'booked'] as const)[i]
  const summaries: Record<string, string> = {
    booked: `Booked a roof inspection for ${c.name}.`,
    message: `Took a message from ${c.name} about a warranty question.`,
    transferred: `Transferred ${c.name} to Dale (owner) for a large commercial bid.`,
    missed: 'Caller hung up before completing — flagged for callback.',
  }
  return {
    id: `rc_${i + 1}`,
    callerName: outcome === 'missed' ? 'Unknown caller' : c.name,
    phone: c.phone,
    outcome,
    summary: summaries[outcome],
    at: daysAgo(0, i * 2 + 1),
  }
})

// =====================  AGENTIC LAYER  ======================================
// Janus positioned as AI office staff. These records power the "Janus AI"
// workspace, the per-job copilot, the Phone Agent screen, and Ask Janus.

const firstName = (id: string) => contacts.find((c) => c.id === id)?.name.split(' ')[0] ?? 'there'

// --- What the agent DID (auto-shipped, merely recorded) ---------------------
export const agentActivity: AgentActivity[] = [
  {
    id: 'aa_1',
    at: daysAgo(0, 1),
    kind: 'call',
    title: `Answered a call from ${contacts[0].name} and booked a roof inspection`,
    evidence: {
      kind: 'transcript',
      label: 'Call transcript',
      body: `"Hi, my roof's leaking after the storm." → Collected address, confirmed insurance claim, offered Thursday 9 AM. Caller accepted. Inspection booked, lead created.`,
    },
    jobId: 'job_1',
    contactId: contacts[0].id,
    revertable: false,
  },
  {
    id: 'aa_2',
    at: daysAgo(0, 2),
    kind: 'sms',
    title: `Sent a follow-up text to ${contacts[9].name} — estimate viewed but unsigned`,
    evidence: {
      kind: 'message',
      label: 'Text sent',
      body: `Hi ${firstName(contacts[9].id)}, just checking in on the roofing estimate we sent. Happy to walk through the options — any questions I can answer?`,
    },
    jobId: 'job_10',
    contactId: contacts[9].id,
    revertable: true,
  },
  {
    id: 'aa_3',
    at: daysAgo(0, 3),
    kind: 'schedule',
    title: `Scheduled Crew B for the ${contacts[14].name} storm-damage job tomorrow`,
    evidence: {
      kind: 'note',
      label: 'Schedule change',
      body: `Matched crew availability + material lead time. Crew B assigned for ${daysAhead(1).slice(0, 10)}. Homeowner notified by text.`,
    },
    jobId: 'job_15',
    contactId: contacts[14].id,
    revertable: true,
  },
  {
    id: 'aa_4',
    at: daysAgo(0, 4),
    kind: 'estimate',
    title: `Drafted a Good/Better/Best estimate for ${contacts[6].name} from the inspection notes`,
    evidence: {
      kind: 'document',
      label: 'Draft estimate EST-1043',
      body: `3-tier estimate built from inspection photos and measurements. Ready for a rep to review before sending. Total range $24,100–$31,800.`,
    },
    jobId: 'job_7',
    contactId: contacts[6].id,
    revertable: true,
  },
  {
    id: 'aa_5',
    at: daysAgo(0, 6),
    kind: 'materials',
    title: `Placed a shingle order with ABC Supply for the ${contacts[13].name} job`,
    evidence: {
      kind: 'note',
      label: 'Purchase order',
      body: `28 sq GAF Timberline HDZ (Charcoal), delivery scheduled to site 1 day before install. PO #SR-4471.`,
    },
    jobId: 'job_14',
    contactId: contacts[13].id,
    revertable: true,
  },
  {
    id: 'aa_6',
    at: daysAgo(1, 2),
    kind: 'invoice',
    title: `Chased an overdue invoice for ${contacts[20].name} with a payment link`,
    evidence: {
      kind: 'message',
      label: 'Text sent',
      body: `Hi ${firstName(contacts[20].id)}, a friendly reminder your Summit Ridge invoice is past due. Pay securely here: pay.summitridge.co/inv-1021`,
    },
    jobId: 'job_21',
    contactId: contacts[20].id,
    revertable: true,
  },
  {
    id: 'aa_7',
    at: daysAgo(1, 5),
    kind: 'call',
    title: `Took a message from ${contacts[7].name} about a warranty question after hours`,
    evidence: {
      kind: 'transcript',
      label: 'Call transcript',
      body: `Caller asked about workmanship warranty on a 2-year-old repair. Logged the question, promised a callback by 9 AM, flagged for ${employees[1].name}.`,
    },
    jobId: 'job_8',
    contactId: contacts[7].id,
    revertable: false,
  },
  {
    id: 'aa_8',
    at: daysAgo(1, 8),
    kind: 'task',
    title: `Created a punch-list task for Crew C on the ${contacts[18].name} job`,
    evidence: {
      kind: 'note',
      label: 'Task created',
      body: `Homeowner flagged two exposed nails near the ridge vent. Task assigned to ${employees[9].name} (Crew C lead), due before final invoice.`,
    },
    jobId: 'job_19',
    contactId: contacts[18].id,
    revertable: true,
  },
  {
    id: 'aa_9',
    at: daysAgo(2, 3),
    kind: 'sms',
    title: `Texted ${contacts[3].name} an inspection reminder for tomorrow morning`,
    evidence: {
      kind: 'message',
      label: 'Text sent',
      body: `Hi ${firstName(contacts[3].id)}, reminder your Summit Ridge roof inspection is tomorrow at 9 AM. Reply RESCHEDULE if you need a different time.`,
    },
    jobId: 'job_4',
    contactId: contacts[3].id,
    revertable: true,
  },
]

// --- What the agent is WAITING ON (high blast radius only) ------------------
export const agentApprovals: AgentApproval[] = [
  {
    id: 'ap_1',
    at: daysAgo(0, 1),
    kind: 'estimate',
    title: `Send $33,500 storm-damage estimate to ${contacts[14].name}`,
    reason: 'Estimate total exceeds the $10k auto-send threshold',
    preview: `Emails and texts estimate EST-1051 (3 tiers, $28,900–$33,500) to ${contacts[14].name} with an e-signature link. Marks the estimate as Sent.`,
    amount: 33500,
    jobId: 'job_15',
    contactId: contacts[14].id,
    status: 'pending',
  },
  {
    id: 'ap_2',
    at: daysAgo(0, 4),
    kind: 'bulk_sms',
    title: 'Text all 12 leads stuck in "Estimate Sent" a limited-time promo',
    reason: 'Bulk message to more than 10 recipients',
    preview: `Sends this to 12 contacts: "Book your roof replacement this month and Summit Ridge waives your $500 deductible gap. Reply YES to lock it in."`,
    recipients: 12,
    status: 'pending',
  },
  {
    id: 'ap_3',
    at: daysAgo(0, 7),
    kind: 'refund',
    title: `Refund $1,000 deductible overpayment to ${contacts[20].name}`,
    reason: 'Refunds require owner approval',
    preview: `Issues a $1,000 refund to the card on file for invoice INV-1021 and records a payment adjustment on the ${contacts[20].name} job.`,
    amount: 1000,
    jobId: 'job_21',
    contactId: contacts[20].id,
    status: 'pending',
  },
]

// --- Per-job copilot suggestions --------------------------------------------
export const aiSuggestions: JobAiSuggestion[] = [
  {
    id: 'sg_1',
    jobId: 'job_10',
    kind: 'nudge',
    insight: `Estimate viewed 3x but unsigned for 6 days. ${contacts[9].name} keeps opening the "Better" tier.`,
    recommendation: 'Send a gentle nudge text referencing the Better option and offer to answer questions.',
    draft: `Hi ${firstName(contacts[9].id)}, saw you were looking over the roofing options — the architectural shingle package is our most popular. Want me to hold that price through the weekend?`,
    confidence: 0.86,
    status: 'open',
  },
  {
    id: 'sg_2',
    jobId: 'job_3',
    kind: 'risk',
    insight: `This lead has sat in New Lead for 9 days with no contact attempt logged.`,
    recommendation: 'Call now or the lead goes cold — 80% of roofing leads convert only if reached within 10 days.',
    draft: undefined,
    confidence: 0.79,
    status: 'open',
  },
  {
    id: 'sg_3',
    jobId: 'job_17',
    kind: 'upsell',
    insight: `Crew noted aging gutters in the job photos while replacing the roof.`,
    recommendation: 'Offer a gutter add-on before the crew demobilizes — cheaper for the customer, easy margin.',
    draft: `Hi ${firstName(contacts[16].id)}, while we're on site your gutters are near end-of-life. We can add seamless gutters this week at a bundled rate — want a quick number?`,
    confidence: 0.72,
    status: 'open',
  },
  {
    id: 'sg_4',
    jobId: 'job_19',
    kind: 'collect',
    insight: `Job is in Final Invoice but no payment link has been sent. Work completed 6 days ago.`,
    recommendation: 'Send the invoice with a text payment link to shorten days-to-cash.',
    draft: `Hi ${firstName(contacts[18].id)}, your roof is all wrapped up! Here's your invoice with a secure pay link: pay.summitridge.co/inv-1019. Thanks for choosing Summit Ridge!`,
    confidence: 0.9,
    status: 'open',
  },
  {
    id: 'sg_5',
    jobId: 'job_8',
    kind: 'followup',
    insight: `Insurance job inspected 2 days ago — adjuster contact captured but no supplement filed.`,
    recommendation: 'Draft the supplement packet from inspection photos so the claim total reflects full scope.',
    draft: undefined,
    confidence: 0.68,
    status: 'open',
  },
  {
    id: 'sg_6',
    jobId: 'job_14',
    kind: 'schedule',
    insight: `Materials arrive in 3 days but no install date is confirmed with the homeowner.`,
    recommendation: 'Confirm the install window now so Crew A is not idle when shingles land.',
    draft: `Hi ${firstName(contacts[13].id)}, your materials arrive Thursday. Can we lock in Friday for the install? Crew will be on site around 7 AM.`,
    confidence: 0.83,
    status: 'open',
  },
]

// --- AI-answered calls (richer than the receptionist summary feed) ----------
export const aiCalls: AiCall[] = [
  {
    id: 'aic_1',
    callerName: contacts[0].name,
    phone: contacts[0].phone,
    at: daysAgo(0, 1),
    durationSec: 143,
    outcome: 'booked',
    confidence: 0.94,
    extracted: {
      name: contacts[0].name,
      address: `${contacts[0].address}, ${contacts[0].city}`,
      issue: 'Active leak in master bedroom ceiling after hailstorm',
      urgency: 'emergency',
    },
    actionsTaken: ['Created lead', 'Booked inspection Thu 9 AM', 'Tagged as insurance claim', 'Texted confirmation'],
    contactId: contacts[0].id,
    transcript: [
      { speaker: 'agent', text: 'Thanks for calling Summit Ridge Roofing, this is Janus. How can I help?' },
      { speaker: 'caller', text: 'My roof is leaking bad after last night\u2019s storm, water\u2019s coming through the ceiling.' },
      { speaker: 'agent', text: 'I\u2019m sorry to hear that — let\u2019s get you on the schedule fast. What\u2019s the property address?', decision: 'Classified as emergency \u2192 prioritized booking' },
      { speaker: 'caller', text: `It\u2019s ${contacts[0].address} in ${contacts[0].city}.` },
      { speaker: 'agent', text: 'Got it. Is this going through insurance?', decision: 'Detected storm damage \u2192 flagged insurance claim' },
      { speaker: 'caller', text: 'Yeah, I filed a claim this morning.' },
      { speaker: 'agent', text: 'Perfect. I have Thursday at 9 AM open for a free inspection — does that work?', decision: 'Offered earliest available slot' },
      { speaker: 'caller', text: 'That works, thank you.' },
      { speaker: 'agent', text: 'You\u2019re booked. I\u2019ll text a confirmation and our inspector\u2019s name now. Hang a towel under that leak in the meantime.', decision: 'Booked \u2192 created lead + sent confirmation text' },
    ],
  },
  {
    id: 'aic_2',
    callerName: 'Unmatched (205) 555-8841',
    phone: '(205) 555-8841',
    at: daysAgo(0, 5),
    durationSec: 96,
    outcome: 'message',
    confidence: 0.71,
    extracted: {
      name: 'Ronnie Aldridge',
      address: 'Not provided',
      issue: 'Wants a quote on a metal roof for a barn',
      urgency: 'routine',
    },
    actionsTaken: ['Captured caller details', 'Left message for sales', 'Flagged as unmatched number'],
    transcript: [
      { speaker: 'agent', text: 'Summit Ridge Roofing, this is Janus — how can I help?' },
      { speaker: 'caller', text: 'Do y\u2019all do metal roofs on barns? I need a price.' },
      { speaker: 'agent', text: 'We do. Metal roofing quotes go through our sales team — can I grab your name and the best number?', decision: 'Out-of-scope for auto-booking \u2192 routed to sales' },
      { speaker: 'caller', text: 'Ronnie Aldridge, this number\u2019s fine.' },
      { speaker: 'agent', text: 'Thanks Ronnie, I\u2019ll have someone reach out today with next steps.', decision: 'Low confidence on scope \u2192 message taken, no booking' },
    ],
  },
  {
    id: 'aic_3',
    callerName: contacts[7].name,
    phone: contacts[7].phone,
    at: daysAgo(1, 5),
    durationSec: 61,
    outcome: 'transferred',
    confidence: 0.88,
    extracted: {
      name: contacts[7].name,
      address: `${contacts[7].address}, ${contacts[7].city}`,
      issue: 'Warranty question on a repair from 2 years ago',
      urgency: 'soon',
    },
    actionsTaken: ['Matched to existing contact', 'Pulled job history', 'Transferred to office manager'],
    contactId: contacts[7].id,
    transcript: [
      { speaker: 'agent', text: 'Summit Ridge Roofing, this is Janus.' },
      { speaker: 'caller', text: 'I had a repair done a couple years back and I think it\u2019s leaking again — is that under warranty?' },
      { speaker: 'agent', text: `I see your repair from two years ago, ${firstName(contacts[7].id)} — workmanship is covered. Let me get you to ${employees[1].name} to sort the details.`, decision: 'Matched contact + warranty terms \u2192 transferred to human' },
    ],
  },
]
