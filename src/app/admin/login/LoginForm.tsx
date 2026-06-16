'use client'

import { useActionState } from 'react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { Heading } from '@/components/Heading'
import { Stack } from '@/components/layout'
import { signIn, type SignInState } from '../actions'

const initialState: SignInState = { error: null }

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState)

  return (
    <form
      action={formAction}
      style={{
        width: '100%',
        maxWidth: '22rem',
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        background: 'white',
        boxShadow: 'var(--shadow-md, 0 4px 24px rgba(0,0,0,0.08))',
      }}
    >
      <Stack gap="5">
        <Heading size="display-sm" as="h1">
          Admin sign in
        </Heading>

        <input type="hidden" name="next" value={next} />

        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.error ?? undefined}
        />

        <Button type="submit" variant="primary" block disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </Stack>
    </form>
  )
}
