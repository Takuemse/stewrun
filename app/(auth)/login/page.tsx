'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import AuthShell, { TimeGreeting } from '@/components/auth-shell'
import { ArrowRight, Lock, Mail } from 'lucide-react'

type SessionRoleResponse =
  | { role: 'customer' }
  | { role: 'cook' }
  | {
      role: 'administrator'
      currentLevel: string | null
      hasVerifiedTotp: boolean
    }

function isSessionRoleResponse(
  value: unknown,
): value is SessionRoleResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }

  const response = value as Record<string, unknown>

  if (response.role === 'customer' || response.role === 'cook') {
    return true
  }

  return (
    response.role === 'administrator' &&
    (response.currentLevel === null ||
      typeof response.currentLevel === 'string') &&
    typeof response.hasVerifiedTotp === 'boolean'
  )
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const redirectTimer = useRef<number | null>(null)

  const clearSignedOutState = useCallback(() => {
    if (redirectTimer.current !== null) {
      window.clearTimeout(redirectTimer.current)
      redirectTimer.current = null
    }

    setSignedIn(false)
    setSuccess(false)
    setLoading(false)
    setError(null)
    setPassword('')
    setShowPassword(false)
  }, [])

  const completeSignIn = useCallback((destination: '/' | '/dashboard' | '/cook' = '/') => {
    setSignedIn(true)
    setSuccess(true)
    setPassword('')

    if (redirectTimer.current !== null) {
      window.clearTimeout(redirectTimer.current)
    }

    redirectTimer.current = window.setTimeout(() => {
      router.replace(destination)
      router.refresh()
    }, 700)
  }, [router])

  const continueAuthenticatedSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        cache: 'no-store',
      })

      const result: unknown = await response.json()

      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          !Array.isArray(result) &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'We could not verify your account. Please retry.'
        setError(message)
        setLoading(false)
        return
      }

      if (!isSessionRoleResponse(result)) {
        setError('We could not verify your account. Please retry.')
        setLoading(false)
        return
      }

      if (result.role === 'customer') {
        completeSignIn('/dashboard')
        return
      }

      if (result.role === 'cook') {
        completeSignIn('/cook')
        return
      }

      if (!result.hasVerifiedTotp || result.currentLevel !== 'aal2') {
        router.replace('/admin/mfa')
        router.refresh()
        return
      }

      completeSignIn()
    } catch {
      setError('We could not verify your account. Please retry.')
      setLoading(false)
    }
  }, [completeSignIn, router])

  useEffect(() => {
    let active = true
    let authRevision = 0
    let verificationTimer: number | null = null

    async function verifySession(revision: number) {
      try {
        const { data, error: sessionError } = await supabase.auth.getUser()

        if (!active || revision !== authRevision) {
          return
        }

        if (sessionError || !data.user) {
          clearSignedOutState()
          return
        }

        await continueAuthenticatedSession()
      } catch {
        if (active && revision === authRevision) {
          clearSignedOutState()
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      authRevision += 1
      const revision = authRevision

      if (event === 'SIGNED_OUT') {
        clearSignedOutState()
        return
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (verificationTimer !== null) {
          window.clearTimeout(verificationTimer)
        }

        verificationTimer = window.setTimeout(() => {
          void verifySession(revision)
        }, 0)
      }
    })

    void verifySession(authRevision)

    return () => {
      active = false
      subscription.unsubscribe()

      if (verificationTimer !== null) {
        window.clearTimeout(verificationTimer)
      }

      if (redirectTimer.current !== null) {
        window.clearTimeout(redirectTimer.current)
        redirectTimer.current = null
      }
    }
  }, [clearSignedOutState, continueAuthenticatedSession, supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      if (!data.session || !data.user) {
        setError('We could not verify your sign-in. Please try again.')
        return
      }

      await continueAuthenticatedSession()
    } catch {
      setError('We could not connect right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
   <AuthShell mode="login">

        <Card className="w-full max-w-md border border-ink-900/8 p-6 shadow-[0_12px_40px_rgba(31,27,22,0.06)] sm:p-8">

        <div className="mb-7">
        <TimeGreeting />
        <h2 className="font-display text-3xl tracking-tight text-ink-900">
               Welcome back
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-900/65">
              Sign in to pick up where your lunch plans left off.
        </p>
        </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-ink-900">
                Email address
              </label>
           <div className="relative">
  <Mail
    aria-hidden="true"
    style={{
      position: 'absolute',
      left: 16,
      top: '50%',
      width: 20,
      height: 20,
      transform: 'translateY(-50%)',
      opacity: 0.6,
      pointerEvents: 'none',
    }}
    />
    <Input
    id="email"
    name="email"
    type="email"
    autoComplete="email"
    inputMode="email"
    placeholder="you@example.com"
    value={email}
    onChange={(event) => setEmail(event.target.value)}
       required
        className="min-h-12 rounded-lg border-ink-900/20 px-4"
              style={{ paddingLeft: 46, minHeight: 54, borderRadius: 14 }}
          />
           </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-ink-900">
                Password
              </label>
              <div className="relative">
              <Lock
                aria-hidden="true"
                style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                width: 20,
                height: 20,
                transform: 'translateY(-50%)',
                opacity: 0.6,
                pointerEvents: 'none',
                }}
                />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="min-h-12 rounded-lg border-ink-900/20 px-4 pr-20"
                  style={{ paddingLeft: 46, paddingRight: 76, minHeight: 54, borderRadius: 14 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-3 my-auto rounded px-2 text-sm font-medium text-clay-500 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-clay-500/25 bg-clay-500/5 px-4 py-3 text-sm leading-5 text-ink-900"
              >
                {error}
              </p>
            )}
            {signedIn && success && (
              <p
                role="status"
                className="rounded-lg border border-sage-500/30 bg-sage-500/10 px-4 py-3 text-sm leading-5 text-ink-900"
              >
                You’re signed in. Taking you to StewRun…
              </p>
            )}

    <Button
  type="submit"
  className="font-semibold disabled:cursor-not-allowed disabled:opacity-60"
  style={{
    display: 'flex',
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 999,
    fontSize: 16,
  }}
  disabled={loading || (signedIn && success)}
  aria-busy={loading}
>
  {loading
    ? 'Signing in…'
    : signedIn && success
      ? 'Signed in'
      : 'Sign in'}
  {!loading && !(signedIn && success) && (
    <ArrowRight aria-hidden="true" style={{ width: 18, height: 18 }} />
  )}
</Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-900/70">
            New to StewRun?{' '}
            <Link
              href="/register"
              className="font-semibold text-clay-500 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
            >
              Create an account
            </Link>
          </p>
        </Card>
      </AuthShell>
  )
}
