import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Gate the admin UI and its write API only.
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
