'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, Search } from 'lucide-react'
import { Input } from './input'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  align?: 'left' | 'right'
  className?: string
  sortValue?: (row: T) => string | number
  render: (row: T) => ReactNode
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  search,
  searchKeys,
  onRowClick,
  initialSort,
  emptyLabel = 'Nothing here yet.',
  toolbar,
}: {
  rows: T[]
  columns: Column<T>[]
  search?: boolean
  searchKeys?: (row: T) => string
  onRowClick?: (row: T) => void
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  emptyLabel?: string
  toolbar?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null)

  const filtered = useMemo(() => {
    let out = rows
    if (query && searchKeys) {
      const q = query.toLowerCase()
      out = out.filter((r) => searchKeys(r).toLowerCase().includes(q))
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a)
          const bv = col.sortValue!(b)
          const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
          return sort.dir === 'asc' ? cmp : -cmp
        })
      }
    }
    return out
  }, [rows, query, sort, columns, searchKeys])

  const toggleSort = (key: string) => {
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  return (
    <div>
      {(search || toolbar) && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {search && (
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="pl-9"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-4 py-2.5 text-xs font-medium text-muted-foreground',
                    c.align === 'right' ? 'text-right' : 'text-left',
                    c.className,
                  )}
                >
                  {c.sortable ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        'inline-flex items-center gap-1 hover:text-foreground',
                        c.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {c.header}
                      <span className="flex flex-col">
                        <ChevronUp
                          className={cn('h-3 w-3 -mb-1', sort?.key === c.key && sort.dir === 'asc' ? 'text-primary' : 'text-muted-foreground/40')}
                        />
                        <ChevronDown
                          className={cn('h-3 w-3', sort?.key === c.key && sort.dir === 'desc' ? 'text-primary' : 'text-muted-foreground/40')}
                        />
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-border last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-muted/50',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('px-4 py-3', c.align === 'right' ? 'text-right' : 'text-left', c.className)}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
