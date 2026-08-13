'use client'

import { currency } from '@/src/lib/format'

export function MiniBarChart({
  data,
  highlightLast = true,
}: {
  data: { label: string; revenue: number }[]
  highlightLast?: boolean
}) {
  const max = Math.max(...data.map((d) => d.revenue), 1)
  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((d, i) => {
        const h = Math.max(6, (d.revenue / max) * 100)
        const isLast = i === data.length - 1
        return (
          <div key={d.label} className="group flex flex-1 flex-col items-center gap-1.5">
            <div className="relative flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${h}%`,
                  backgroundColor: highlightLast && isLast ? 'var(--primary)' : 'var(--chart-2)',
                  opacity: highlightLast && !isLast ? 0.45 : 1,
                }}
              />
              <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
                {currency(d.revenue, true)}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}
