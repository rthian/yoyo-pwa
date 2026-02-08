/**
 * Supabase Client Configuration
 * Browser-side client for Supabase operations
 */
import { createBrowserClient } from '@supabase/ssr'

/**
 * Custom lock implementation that avoids navigator.locks AbortError.
 * navigator.locks uses AbortController internally, which throws
 * "signal is aborted without reason" during Next.js navigation/HMR.
 * This simple mutex-based lock prevents that while still serializing auth operations.
 */
const lockMap = new Map<string, Promise<unknown>>()

async function customLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  // Wait for any existing lock with this name to complete
  const existing = lockMap.get(name)
  if (existing) {
    try { await existing } catch { /* ignore */ }
  }

  // Run fn and store the promise so others wait
  const promise = fn()
  lockMap.set(name, promise)

  try {
    return await promise
  } finally {
    // Only clear if this is still the current lock
    if (lockMap.get(name) === promise) {
      lockMap.delete(name)
    }
  }
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build time, return a placeholder client that will error on use
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client for build time - real client created at runtime
    if (typeof window === 'undefined') {
      return createBrowserClient(
        'https://placeholder.supabase.co',
        'placeholder-key'
      )
    }
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      lock: customLock,
    },
  })
}
