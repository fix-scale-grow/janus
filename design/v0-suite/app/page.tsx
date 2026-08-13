'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/lib/auth'

export default function Home() {
  const { session, ready } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    if (session) router.replace(session.role === 'field' ? '/field' : '/dashboard')
    else router.replace('/login')
  }, [ready, session, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}
