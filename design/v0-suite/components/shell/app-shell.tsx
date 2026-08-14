'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { useAuth } from '@/src/lib/auth'
import { JanusDockProvider } from '@/src/lib/janus-dock'
import { JanusDock } from '@/components/agent/janus-dock'

export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (ready && !session) router.replace('/login')
  }, [ready, session, router])

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <JanusDockProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <JanusDock />
      </div>
    </JanusDockProvider>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && <p className="mt-2 text-sm text-muted-foreground text-pretty">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/**
 * Standard scrollable page body: centered 1440px container, 32px gutters,
 * 32px vertical rhythm, and 32px gaps between sections. Use for all
 * document-style (non-full-height) screens.
 */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto max-w-[1440px] space-y-8 px-4 py-8 sm:px-8${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}
