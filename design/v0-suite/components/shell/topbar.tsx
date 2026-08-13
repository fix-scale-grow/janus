'use client'

import { useRouter } from 'next/navigation'
import { Bell, Menu as MenuIcon, LogOut, ChevronDown, CircleUserRound } from 'lucide-react'
import { GlobalSearch } from './global-search'
import { Menu, MenuItem } from '@/components/ui/menu'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth, roleLabels } from '@/src/lib/auth'
import { useData } from '@/src/lib/data/provider'
import { relativeTime } from '@/src/lib/format'

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { session, logout } = useAuth()
  const { store, now } = useData()
  const router = useRouter()

  const notifications = [
    { id: 'n1', text: '3 leads unanswered for over 4 hours', at: store.receptionistCalls[0]?.at },
    { id: 'n2', text: 'Invoice INV-2102 is 45 days overdue', at: store.receptionistCalls[1]?.at },
    { id: 'n3', text: 'AI Receptionist booked a new inspection', at: store.receptionistCalls[2]?.at },
    { id: 'n4', text: 'Cody Pruitt signed estimate EST-1043', at: store.receptionistCalls[3]?.at },
  ]

  const initials = session ? session.name.split(' ').map((p) => p[0]).slice(0, 2).join('') : 'U'

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Open menu"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center">
        <GlobalSearch />
      </div>

      {/* Notifications */}
      <Menu
        trigger={
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          </button>
        }
        className="w-80"
      >
        {() => (
          <div>
            <div className="flex items-center justify-between px-2.5 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              <Badge variant="secondary">{notifications.length} new</Badge>
            </div>
            <div className="space-y-0.5">
              {notifications.map((n) => (
                <div key={n.id} className="rounded-lg px-2.5 py-2 hover:bg-muted">
                  <p className="text-sm leading-snug">{n.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.at ? relativeTime(n.at, now) : 'today'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Menu>

      {/* User menu */}
      <Menu
        trigger={
          <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-muted">
            <Avatar initials={initials} size="sm" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium">{session?.name ?? 'User'}</span>
              <span className="block text-[11px] text-muted-foreground">
                {session ? roleLabels[session.role] : ''}
              </span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </button>
        }
      >
        {(close) => (
          <>
            <div className="px-2.5 py-2">
              <p className="text-sm font-medium">{session?.name}</p>
              <p className="text-xs text-muted-foreground">{session?.email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <MenuItem onClick={() => { close(); router.push('/settings') }}>
              <CircleUserRound className="h-4 w-4" /> Account settings
            </MenuItem>
            <MenuItem
              className="text-destructive hover:bg-destructive/10"
              onClick={() => { close(); logout(); router.push('/login') }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </MenuItem>
          </>
        )}
      </Menu>
    </header>
  )
}
