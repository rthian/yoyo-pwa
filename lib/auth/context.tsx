/**
 * Auth Context Provider
 * Client-side authentication state management
 */
'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Member } from '@/lib/types/database'

interface AuthContextType {
  user: User | null
  member: Member | null
  loading: boolean
  signOut: () => Promise<void>
  refreshMember: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Singleton supabase client to avoid recreating on each render.
// Uses custom lock from client.ts to avoid navigator.locks AbortError.
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const fetchingRef = useRef(false)

  const supabase = getSupabase()

  // Suppress AbortError unhandled rejections (caused by Next.js navigation/HMR aborting
  // in-flight Supabase fetch requests - benign in development)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.name === 'AbortError' ||
        (event.reason instanceof DOMException && event.reason.name === 'AbortError') ||
        String(event.reason).includes('signal is aborted')
      ) {
        event.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  const fetchMember = useCallback(async (userId: string) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      // Use server API route to bypass RLS (avoids infinite recursion on members table)
      const response = await fetch('/api/member/me')
      if (!mountedRef.current) return
      if (response.ok) {
        const { member } = await response.json()
        if (mountedRef.current) setMember(member)
      } else {
        if (mountedRef.current) setMember(null)
      }
    } catch {
      // Silently ignore - AbortError or network error
    } finally {
      fetchingRef.current = false
    }
  }, [])

  const refreshMember = useCallback(async () => {
    if (user) {
      await fetchMember(user.id)
    }
  }, [user, fetchMember])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setMember(null)
  }, [supabase])

  useEffect(() => {
    mountedRef.current = true

    // Use onAuthStateChange as the SOLE source of truth.
    // It fires INITIAL_SESSION on mount, so no need for separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mountedRef.current) return
        try {
          if (session?.user) {
            setUser(session.user)
            await fetchMember(session.user.id)
          } else {
            setUser(null)
            setMember(null)
          }
        } catch {
          // Silently ignore
        }
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    )

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchMember])

  return (
    <AuthContext.Provider value={{ user, member, loading, signOut, refreshMember }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
