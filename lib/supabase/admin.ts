/**
 * Supabase Admin Client
 * Uses service role key to bypass RLS policies
 * ONLY use this on the server side for admin operations
 */
import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client with service role key
 * This bypasses all RLS policies - use with caution!
 * 
 * SECURITY: Only use this:
 * - On the server side (never expose to client)
 * - For admin operations that need to bypass RLS
 * - When regular client hits RLS recursion issues
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for admin client')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
