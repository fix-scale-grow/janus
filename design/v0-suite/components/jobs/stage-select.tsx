'use client'

import { useData } from '@/src/lib/data/provider'
import {
  salesStageOrder,
  productionStageOrder,
  salesStageMeta,
  productionStageMeta,
} from '@/src/lib/format'
import type { Job, SalesStage, ProductionStage } from '@/src/lib/data/types'
import { cn } from '@/lib/utils'

export function StageSelect({ job, board }: { job: Job; board: 'sales' | 'production' }) {
  const { moveSalesStage, moveProductionStage } = useData()

  if (board === 'production') {
    return (
      <select
        value={job.productionStage ?? 'approved'}
        onChange={(e) => moveProductionStage(job.id, e.target.value as ProductionStage)}
        className={selectCls}
      >
        {productionStageOrder.map((s) => (
          <option key={s} value={s}>
            {productionStageMeta[s].label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <select
      value={job.salesStage}
      onChange={(e) => moveSalesStage(job.id, e.target.value as SalesStage)}
      className={selectCls}
    >
      {salesStageOrder.map((s) => (
        <option key={s} value={s}>
          {salesStageMeta[s].label}
        </option>
      ))}
    </select>
  )
}

const selectCls = cn(
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground',
  'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
)
