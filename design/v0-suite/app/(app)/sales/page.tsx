'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shell/app-shell'
import { Kanban } from '@/components/jobs/kanban'
import { JobPanel } from '@/components/jobs/job-panel'
import { useData } from '@/src/lib/data/provider'
import { currency } from '@/src/lib/format'

export default function SalesPage() {
  const { store } = useData()
  const [openId, setOpenId] = useState<string | null>(null)

  const active = store.jobs.filter((j) => !j.won || j.salesStage === 'approved')
  const openPipeline = active
    .filter((j) => j.salesStage !== 'approved' && j.salesStage !== 'lost')
    .reduce((s, j) => s + j.value, 0)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <PageHeader
        title="Sales Pipeline"
        description={`${currency(openPipeline)} in open pipeline · drag cards to move stages`}
      />
      <div className="min-h-0 flex-1 pt-4">
        <Kanban board="sales" onOpen={setOpenId} />
      </div>
      <JobPanel jobId={openId} board="sales" onClose={() => setOpenId(null)} />
    </div>
  )
}
