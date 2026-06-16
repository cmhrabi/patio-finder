import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/supabase/auth'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await requireUser()
  if (user) redirect('/admin')

  const { next } = await searchParams
  const safeNext = next && next.startsWith('/admin') ? next : '/admin'

  return (
    <main
      className="grid h-screen w-screen place-items-center"
      style={{ background: 'var(--theme-bg, #f5f3ee)', padding: 'var(--space-5)' }}
    >
      <LoginForm next={safeNext} />
    </main>
  )
}
