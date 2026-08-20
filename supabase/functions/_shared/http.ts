// Shared plumbing for the two scheduled functions: CORS, JSON replies, and the auth gate
// they must both apply before touching data.
import { createClient } from 'jsr:@supabase/supabase-js@2'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** Constant-time compare so a wrong cron secret can't be recovered byte by byte. */
export function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export interface Caller {
  /** True when the hourly cron job called us with the shared secret. */
  viaCron: boolean
  /** The signed-in user's id, when a browser called us. Null for cron. */
  callerId: string | null
}

/**
 * Accept iff the request carries the cron secret, or a bearer JWT that resolves to a real
 * user. Resolving the JWT is only half the check — the caller still has to match
 * `settings.user_id`, which the function does once it has read the settings row. Any other
 * valid Supabase JWT is not enough.
 *
 * Returns null when the request should be rejected.
 */
export async function authorize(req: Request): Promise<Caller | null> {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const headerSecret = req.headers.get('x-cron-secret')
  if (cronSecret && headerSecret && secretsMatch(headerSecret, cronSecret)) {
    return { viaCron: true, callerId: null }
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return null

  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data, error } = await anon.auth.getUser(authHeader.slice(7))
  if (error || !data.user) return null
  return { viaCron: false, callerId: data.user.id }
}

export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}
