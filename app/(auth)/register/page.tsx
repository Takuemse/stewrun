'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { BrandLogo } from '@/components/brand-logo'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'customer' | 'cook'>('customer')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const requestedRole = new URLSearchParams(window.location.search).get('role')
      if (requestedRole === 'cook') setRole('cook')
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Your passwords do not match. Please check and try again.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/signup-success`,
          data: {
            full_name: fullName.trim(),
            role,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.session) {
        setSuccess('Your account is ready. Taking you to StewRun…')
        window.setTimeout(() => {
          router.replace(role === 'cook' ? '/cook' : '/dashboard')
          router.refresh()
        }, 900)
      } else {
        setSuccess(
          'Your details have been submitted. Check your email for a confirmation link, then sign in.'
        )
      }
    } catch {
      setError('We could not connect right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-50 px-5 py-10 sm:px-8">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
        <section className="mx-auto w-full max-w-lg lg:mx-0">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
            aria-label="StewRun home"
          >
            <BrandLogo className="h-[42px] w-[150px]" />
          </Link>

          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
            A pre-order lunch marketplace for Harare
          </p>
          <h1 className="mt-3 max-w-md font-display text-4xl leading-tight tracking-tight text-ink-900 sm:text-5xl">
            Make room for a lunch made local.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-ink-900/70">
            Tell Ziva what you would like, compare offers from home cooks and
            small caterers, then collect your scheduled meal at a Harare hub.
          </p>
        </section>

        <Card className="mx-auto w-full max-w-md border border-ink-900/8 p-6 shadow-[0_12px_40px_rgba(31,27,22,0.06)] sm:p-8">
          <div className="mb-7">
            <h2 className="font-display text-3xl tracking-tight text-ink-900">
              Create your account
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-900/65">
              Choose how you would like to use StewRun.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="full-name" className="block text-sm font-medium text-ink-900">
                Name
              </label>
              <Input
                id="full-name"
                name="full_name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                minLength={2}
                maxLength={100}
                required
                className="min-h-12 rounded-lg border-ink-900/20 px-4"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="block text-sm font-medium text-ink-900">
                I am joining as a
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['customer', 'Customer'],
                  ['cook', 'Cook'],
                ] as const).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium ${
                      role === value
                        ? 'border-clay-500 bg-clay-500/5 text-ink-900'
                        : 'border-ink-900/15 bg-white text-ink-900/70'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={role === value}
                      onChange={() => setRole(value)}
                      className="accent-clay-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-ink-900">
                Email address
              </label>
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
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-ink-900">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  aria-describedby="password-hint"
                  className="min-h-12 rounded-lg border-ink-900/20 px-4 pr-20"
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
              <p id="password-hint" className="text-xs leading-5 text-ink-900/60">
                Use at least 8 characters.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-ink-900"
              >
                Confirm password
              </label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  aria-invalid={Boolean(confirmPassword) && password !== confirmPassword}
                  className="min-h-12 rounded-lg border-ink-900/20 px-4 pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                  aria-pressed={showConfirmPassword}
                  className="absolute inset-y-0 right-3 my-auto rounded px-2 text-sm font-medium text-clay-500 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-clay-500">
                  Your passwords do not match.
                </p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-clay-500/25 bg-clay-500/5 px-4 py-3 text-sm leading-5 text-ink-900"
              >
                {error}
              </p>
            )}
            {success && (
              <p
                role="status"
                className="rounded-lg border border-sage-500/30 bg-sage-500/10 px-4 py-3 text-sm leading-5 text-ink-900"
              >
                {success}
              </p>
            )}

            <Button
              type="submit"
              className="min-h-12 w-full rounded-md text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || Boolean(success)}
              aria-busy={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-900/70">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-clay-500 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
            >
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}
