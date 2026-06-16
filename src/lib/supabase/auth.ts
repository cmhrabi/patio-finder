import { createSupabaseServerClient } from '@/lib/supabase/server'

// Returns the authenticated user, or null. Use to guard server components and
// route handlers — getUser() validates the JWT against Supabase.
export async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
