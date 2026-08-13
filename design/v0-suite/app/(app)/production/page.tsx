'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shell/app-shell'
import { Kanban } from '@/components/jobs/kanban'
import { JobPanel } from '@/components/jobs/job-panel'
import { useData } from '@/src/lib/data/provider'
import { currency } from '@/src/lib/format'

export default function ProductionPage() {
  const { store } = useData()
  const [openId, setOpenId] = useState<string | null>(null)

  const won = store.jobs.filter((j) => j.won)
  const inProduction = won.filter((j) => j.productionStage !== 'paid').reduce((s, j) => s + j.value, 0)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <PageHeader
        title="Production Board"
        description={`${currency(inProduction)} of active work · ${won.length} won jobs`}
      />
      <div className="min-h-0 flex-1 pt-4">
        <Kanban board="production" onOpen={setOpenId} />
      </div>
      <JobPanel jobId={openId} board="production" onClose={() => setOpenId(null)} />
    </div>
  )
}
