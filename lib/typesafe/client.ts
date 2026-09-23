/**
 * Server-only TypeSafe (Jev) client for structured decisions.
 * Callers: scripts/smoke-typesafe.ts; future app/api/** decision routes.
 * Glob: no prior lib/typesafe/*.
 * Env: TYPESAFE_API_KEY (never commit). User: "install for me i have api key"
 */
import { TypeSafeClient } from '@typesafe-ai/sdk'

let client: TypeSafeClient | null = null

export function getTypeSafeClient(): TypeSafeClient {
  if (!process.env.TYPESAFE_API_KEY?.trim()) {
    throw new Error('Missing TYPESAFE_API_KEY. Add it to .env.local')
  }
  if (!client) {
    client = new TypeSafeClient()
  }
  return client
}

export function isTypeSafeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim())
}
