'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  parseMealRequest,
  ParseOrderApiError,
  type ParsedMealRequest,
} from '@/lib/parse-order-client'
import { createClient } from '@/lib/supabase/client'

const examples = [
  'I want two plates of sadza with beef and vegetables.',
  'Ndinoda sadza nemuriwo nenyama.',
  'Can I get one chicken and rice for lunch?',
]

type RequestState = 'editing' | 'review'

export default function Home() {
  const supabase = useMemo(() => createClient(), [])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [request, setRequest] = useState('')
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestRequiresSignIn, setRequestRequiresSignIn] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsedRequest, setParsedRequest] = useState<ParsedMealRequest | null>(null)
  const [requestState, setRequestState] = useState<RequestState>('editing')

  useEffect(() => {
    let active = true
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          setUserEmail(session?.user.email ?? null)
          setAuthLoading(false)
          setAuthError(null)
        }
      },
    )

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setAuthError('We could not check your account right now.')
      } else {
        setUserEmail(data.session?.user.email ?? null)
      }
      setAuthLoading(false)
    }).catch(() => {
      if (active) {
        setAuthError('We could not check your account right now.')
        setAuthLoading(false)
      }
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSignOut() {
    setSigningOut(true)
    setAuthError(null)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setAuthError('We could not sign you out. Please try again.')
      }
    } catch {
      setAuthError('We could not sign you out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedRequest = request.trim()
    setRequestError(null)
    setRequestRequiresSignIn(false)
    setParsedRequest(null)

    if (!trimmedRequest) {
      setRequestError('Describe the meal you would like before continuing.')
      return
    }

    setParsing(true)
    try {
      const result = await parseMealRequest(trimmedRequest)
      setParsedRequest(result)
      setRequestState('review')
    } catch (error) {
      setRequestRequiresSignIn(
        error instanceof ParseOrderApiError && error.status === 401,
      )
      setRequestError(
        error instanceof ParseOrderApiError
          ? error.message
          : 'We could not interpret your request. Please try again.',
      )
    } finally {
      setParsing(false)
    }
  }

  function editRequest() {
    setRequestState('editing')
    setRequestError(null)
  }

  return (
    <main className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-900/10 bg-cream-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a
            href="#home"
            className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
            aria-label="StewRun home"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-clay-500 font-display text-xl font-semibold text-cream-50">
              S
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-ink-900">
              StewRun
            </span>
          </a>
          <nav aria-label="Account" className="flex items-center gap-3">
            {authLoading ? (
              <span className="text-sm text-ink-900/60" role="status">
                Checking account…
              </span>
            ) : userEmail ? (
              <>
                <span className="hidden max-w-48 truncate text-sm text-ink-900/70 sm:inline">
                  {userEmail}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="min-h-10 rounded-lg border border-ink-900/20 px-3 text-sm font-medium text-ink-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded px-2 py-2 text-sm font-semibold text-ink-900 hover:text-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex min-h-10 items-center rounded-lg bg-clay-500 px-4 text-sm font-semibold text-cream-50 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                >
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section id="home" className="mx-auto max-w-7xl px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_0.92fr] lg:gap-16">
          <div className="order-2 pt-2 lg:order-1">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              Harare lunches, made at home
            </p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              A good lunch is just around the corner.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-900/70 sm:text-lg sm:leading-8">
              Tell us what you feel like eating in English or Shona. We’ll
              organise your request for pickup at a convenient Harare hub.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-900/70">
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-sage-500" aria-hidden="true" />
                Home-cooked meals
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-saffron-500" aria-hidden="true" />
                Easy hub pickup
              </span>
            </div>

            <section aria-labelledby="how-it-works" className="mt-12 border-t border-ink-900/10 pt-6">
              <h2 id="how-it-works" className="font-display text-xl font-semibold text-ink-900">
                How it works
              </h2>
              <ol className="mt-5 grid gap-4 sm:grid-cols-3">
                {[
                  ['01', 'Describe your meal', 'Write it naturally in English or Shona.'],
                  ['02', 'Review the details', 'Check the meal, pickup hub and time.'],
                  ['03', 'Confirm later', 'You’ll review pricing before placing an order.'],
                ].map(([number, title, description]) => (
                  <li key={number} className="flex gap-3">
                    <span className="font-mono text-xs font-medium text-clay-500">{number}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
                      <p className="mt-1 text-sm leading-5 text-ink-900/65">{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <Card className="order-1 border border-ink-900/8 p-5 shadow-[0_12px_40px_rgba(31,27,22,0.06)] sm:p-7 lg:order-2">
            {requestState === 'editing' || !parsedRequest ? (
              <>
                <div className="mb-6">
                  <p className="text-sm font-semibold text-clay-500">Start with a craving</p>
                  <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900 sm:text-3xl">
                    What would you like for lunch?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink-900/65">
                    Share the dishes and quantities you have in mind. You can
                    review the interpretation before doing anything else.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="meal-request" className="mb-2 block text-sm font-medium text-ink-900">
                      Your meal request
                    </label>
                    <textarea
                      id="meal-request"
                      name="meal-request"
                      rows={5}
                      maxLength={500}
                      value={request}
                      onChange={(event) => {
                        setRequest(event.target.value)
                        setRequestError(null)
                        setRequestRequiresSignIn(false)
                      }}
                      placeholder="For example: I want two plates of sadza with beef and vegetables."
                      aria-describedby="request-help request-count"
                      aria-invalid={Boolean(requestError)}
                      className="w-full resize-y rounded-xl border border-ink-900/20 bg-white px-4 py-3 text-base leading-6 text-ink-900 placeholder:text-ink-900/45 focus:border-clay-500 focus:outline-none focus:ring-2 focus:ring-clay-500/25"
                    />
                    <div className="mt-2 flex justify-between gap-3 text-xs leading-5 text-ink-900/60">
                      <span id="request-help">English or Shona, whichever feels natural.</span>
                      <span id="request-count" className="shrink-0">{request.length}/500</span>
                    </div>
                  </div>

                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-900/60">
                      Try an example
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {examples.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => {
                            setRequest(example)
                            setRequestError(null)
                            setRequestRequiresSignIn(false)
                          }}
                          className="rounded-full border border-ink-900/15 bg-cream-50 px-3 py-2 text-left text-xs leading-4 text-ink-900/80 hover:border-sage-500 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-500"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {requestError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-clay-500/25 bg-clay-500/5 px-4 py-3 text-sm leading-5 text-ink-900"
                    >
                      <p>{requestError}</p>
                      {requestRequiresSignIn && (
                        <Link
                          href="/login"
                          className="mt-1 inline-block font-semibold text-clay-500 underline-offset-4 hover:underline"
                        >
                          Sign in to continue
                        </Link>
                      )}
                    </div>
                  )}
                  {authError && (
                    <p role="status" className="text-sm text-clay-500">{authError}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={parsing}
                    aria-busy={parsing}
                    className="min-h-12 w-full rounded-lg text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {parsing ? 'Understanding your request…' : 'Review meal request'}
                  </Button>
                  <p className="text-center text-xs leading-5 text-ink-900/60">
                    This step only interprets your request. It does not place an order.
                  </p>
                </form>
              </>
            ) : (
              <ReviewPanel result={parsedRequest} onEdit={editRequest} />
            )}
          </Card>
        </div>
      </section>

      <section aria-labelledby="pickup-hubs" className="border-y border-ink-900/10 bg-white/55">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-9 sm:px-8 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              Close to your day
            </p>
            <h2 id="pickup-hubs" className="mt-2 font-display text-2xl tracking-tight text-ink-900">
              Choose a Harare pickup hub
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {['Eastgate', 'Joina City', 'Avondale'].map((hub) => (
              <div key={hub} className="rounded-xl border border-ink-900/10 bg-cream-50 px-4 py-3">
                <p className="text-sm font-semibold text-ink-900">{hub}</p>
                <p className="mt-1 text-xs text-ink-900/60">Pickup available</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-sm text-ink-900/60 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Made for a better lunch break in Harare.</p>
        <p>Place pre-orders before 10:00 AM each day.</p>
      </footer>
    </main>
  )
}

function ReviewPanel({
  result,
  onEdit,
}: {
  result: ParsedMealRequest
  onEdit: () => void
}) {
  return (
    <section aria-labelledby="review-heading" aria-live="polite">
      <p className="text-sm font-semibold text-sage-500">Request interpreted</p>
      <h2 id="review-heading" className="mt-2 font-display text-2xl tracking-tight text-ink-900 sm:text-3xl">
        Review your meal
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-900/65">
        Check that these details match what you meant. This is not an order confirmation.
      </p>

      {result.confidence === 'low' && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-saffron-500/50 bg-saffron-500/10 px-4 py-3 text-sm leading-5 text-ink-900"
        >
          We’re not fully sure we understood. Please check the details carefully or edit your request.
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-900/60">
          Interpreted items
        </h3>
        <ul className="mt-3 divide-y divide-ink-900/10 border-y border-ink-900/10">
          {result.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-4 py-3">
              <span className="font-medium text-ink-900">{item.name}</span>
              <span className="shrink-0 text-sm text-ink-900/70">Qty {item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-cream-50 p-3">
          <dt className="text-xs font-medium text-ink-900/60">Pickup hub</dt>
          <dd className="mt-1 text-sm font-semibold text-ink-900">{result.hub}</dd>
        </div>
        <div className="rounded-lg bg-cream-50 p-3">
          <dt className="text-xs font-medium text-ink-900/60">Pickup time</dt>
          <dd className="mt-1 text-sm font-semibold text-ink-900">{result.pickup_time}</dd>
        </div>
        <div className="col-span-2 rounded-lg bg-cream-50 p-3">
          <dt className="text-xs font-medium text-ink-900/60">Interpretation confidence</dt>
          <dd className="mt-1 text-sm font-semibold capitalize text-ink-900">{result.confidence}</dd>
        </div>
      </dl>

      {result.notes.trim() && (
        <p className="mt-4 rounded-lg border border-ink-900/10 px-4 py-3 text-sm leading-5 text-ink-900/75">
          <span className="font-semibold text-ink-900">Note: </span>
          {result.notes}
        </p>
      )}

      <p className="mt-5 text-sm leading-6 text-ink-900/65">
        Prices and availability are not confirmed here. You’ll be able to review them before placing an order.
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={onEdit}
        className="mt-5 min-h-12 w-full rounded-lg text-base font-semibold"
      >
        Edit my request
      </Button>
    </section>
  )
}
