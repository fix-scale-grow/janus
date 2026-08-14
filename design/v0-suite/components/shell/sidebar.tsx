'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  Hammer,
  CalendarDays,
  Inbox,
  Users,
  FileText,
  ReceiptText,
  Zap,
  Settings,
  PanelLeftClose,
  PanelLeft,
  HardHat,
  Activity,
  PhoneCall,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useData } from '@/src/lib/data/provider'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/janus', label: 'Activity', icon: Activity },
  { href: '/sales', label: 'Sales', icon: TrendingUp },
  { href: '/production', label: 'Production', icon: Hammer },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/estimates', label: 'Estimates', icon: FileText },
  { href: '/invoices', label: 'Invoices', icon: ReceiptText },
  { href: '/automations', label: 'Automations', icon: Zap },
  { href: '/phone-agent', label: 'Phone Agent', icon: PhoneCall },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}) {
  const pathname = usePathname()
  const { store } = useData()
  const unread = store.conversations.filter((c) => c.unread).length

  const inner = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className={cn('flex h-14 items-center gap-2.5 px-4', collapsed && 'lg:justify-center lg:px-0')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <HardHat className="h-4.5 w-4.5" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Janus</div>
            <div className="text-[11px] text-sidebar-foreground/60">Summit Ridge Roofing</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin px-2 py-2">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                collapsed && 'lg:justify-center lg:px-0',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
              )}
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.label === 'Inbox' && unread > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                  {unread}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Field mode link + collapse */}
      <div className="border-t border-sidebar-border p-2">
        <Link
          href="/field"
          onClick={onMobileClose}
          title={collapsed ? 'Field Mode' : undefined}
          className={cn(
            'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <HardHat className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>Field Mode</span>}
        </Link>
        <button
          onClick={onToggle}
          className={cn(
            'hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground lg:flex',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <PanelLeft className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-sidebar-border transition-[width] duration-200 lg:block',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {inner}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" onClick={onMobileClose} className="absolute inset-0 bg-foreground/30" />
          <div className="absolute left-0 top-0 h-full w-64 animate-in slide-in-from-left duration-200">{inner}</div>
        </div>
      )}
    </>
  )
}
