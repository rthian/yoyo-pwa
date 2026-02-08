/**
 * Member Layout Client Wrapper
 * Client component that wraps member pages with header navigation
 */
'use client'

import MemberHeader from './MemberHeader'

export default function MemberLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MemberHeader />
      <main className="min-h-screen bg-gradient-to-b from-background to-muted">
        {children}
      </main>
    </>
  )
}
