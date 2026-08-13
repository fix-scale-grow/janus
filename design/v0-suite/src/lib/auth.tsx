'use client'

// Mock auth. Any credentials work; the role picker selects the persona.
// Persisted to localStorage so refreshes keep you logged in.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Role = 'owner' | 'office' | 'field'

export interface Session {
  name: string
  email: string
  role: Role
  employeeId: string
}

// Map each persona role to a seeded employee id (see seed.ts: emp_1 owner, emp_3 office, emp_6 field).
const roleNames: Record<Role, string> = {
  owner: 'Dale Whitfield',
  office: 'Brenda Whitfield',
  field: 'Levi Stallworth',
}

const roleEmployeeId: Record<Role, string> = {
  owner: 'emp_1',
  office: 'emp_3',
  field: 'emp_6',
}

interface AuthContextValue {
  session: Session | null
  login: (email: string, role: Role) => void
  logout: () => void
  ready: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)
const KEY = 'janus_session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setSession(JSON.parse(raw))
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [])

  const login = (email: string, role: Role) => {
    const s: Session = {
      name: roleNames[role],
      email: email || `${role}@summitridgeroofing.com`,
      role,
      employeeId: roleEmployeeId[role],
    }
    setSession(s)
    localStorage.setItem(KEY, JSON.stringify(s))
  }

  const logout = () => {
    setSession(null)
    localStorage.removeItem(KEY)
  }

  return <AuthContext.Provider value={{ session, login, logout, ready }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export const roleLabels: Record<Role, string> = {
  owner: 'Owner',
  office: 'Office',
  field: 'Field Tech',
}
