import { createClient } from '@supabase/supabase-js'

// Secret-key client. Bypasses RLS — use only in server-side scripts/handlers,
// never import from a client component.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
