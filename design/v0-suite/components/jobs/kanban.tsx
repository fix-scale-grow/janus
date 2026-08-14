'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { useData } from '@/src/lib/data/provider'
import { JobCard } from './job-card'
import {
  salesStageOrder,
  productionStageOrder,
  salesStageMeta,
  productionStageMeta,
  currency,
} from '@/src/lib/format'
import type { Job, SalesStage, ProductionStage } from '@/src/lib/data/types'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function Kanban({
  board,
  onOpen,
}: {
  board: 'sales' | 'production'
  onOpen: (id: string) => void
}) {
  const { store, moveSalesStage, moveProductionStage } = useData()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [lostOpen, setLostOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const jobs = board === 'sales' ? store.jobs.filter((j) => !j.won || j.salesStage === 'approved') : store.jobs.filter((j) => j.won)

  const stages =
    board === 'sales'
      ? (salesStageOrder.filter((s) => s !== 'lost') as string[])
      : (productionStageOrder as string[])

  const stageOf = (j: Job) => (board === 'sales' ? j.salesStage : j.productionStage ?? 'approved')

  const byStage = useMemo(() => {
    const map: Record<string, Job[]> = {}
    for (const s of [...stages, 'lost']) map[s] = []
    for (const j of jobs) {
      const st = stageOf(j)
      if (map[st]) map[st].push(j)
    }
    return map
  }, [jobs, stages, board])

  const activeJob = activeId ? jobs.find((j) => j.id === activeId) ?? null : null

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const jobId = e.active.id as string
    const over = e.over?.id as string | undefined
    if (!over) return
    // `over` is either a column id (stage) or another card id
    let targetStage = over
    if (!stages.includes(over) && over !== 'lost') {
      const overJob = jobs.find((j) => j.id === over)
      if (overJob) targetStage = stageOf(overJob)
    }
    if (board === 'sales') moveSalesStage(jobId, targetStage as SalesStage)
    else moveProductionStage(jobId, targetStage as ProductionStage)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full gap-4 overflow-x-auto px-4 pb-8 sm:px-8">
        {stages.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            board={board}
            jobs={byStage[stage] ?? []}
            onOpen={onOpen}
          />
        ))}

        {board === 'sales' && (
          <div className="flex w-72 shrink-0 flex-col">
            <button
              onClick={() => setLostOpen((o) => !o)}
              className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              <span className="flex items-center gap-1.5">
                {lostOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Lost
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{(byStage['lost'] ?? []).length}</span>
            </button>
            {lostOpen && (
              <div className="mt-3 flex flex-col gap-3 opacity-75">
                {(byStage['lost'] ?? []).map((j) => (
                  <JobCard key={j.id} job={j} board="sales" onOpen={onOpen} />
                ))}
                {(byStage['lost'] ?? []).length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">No lost jobs.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <DragOverlay>{activeJob && <JobCard job={activeJob} board={board} overlay />}</DragOverlay>
    </DndContext>
  )
}

function Column({
  stage,
  board,
  jobs,
  onOpen,
}: {
  stage: string
  board: 'sales' | 'production'
  jobs: Job[]
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const meta =
    board === 'sales'
      ? salesStageMeta[stage as SalesStage]
      : productionStageMeta[stage as ProductionStage]
  const dot = 'dot' in meta ? meta.dot : 'var(--primary)'
  const total = jobs.reduce((s, j) => s + j.value, 0)

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dot }} />
            {meta.label}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {jobs.length}
          </span>
        </div>
        <p className="mt-1 pl-4.5 text-xs text-muted-foreground">{currency(total, true)}</p>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-3 rounded-lg p-1 transition-colors',
          isOver && 'bg-accent/60 ring-2 ring-primary/30',
        )}
      >
        <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} board={board} onOpen={onOpen} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
