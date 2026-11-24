'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ChefHat,
  ChevronRight,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Caveat } from 'next/font/google'
import { BrandLogo } from '@/components/brand-logo'

const script = Caveat({ subsets: ['latin'], weight: '600', display: 'swap' })

/* ── Media setup ─────────────────────────────────────────────────────────
   When you have real footage, put it at public/videos/stewrun-kitchen.mp4
   (muted loop, 720p, about 8-12 seconds, ideally 1-2 MB) and set VIDEO_SRC
   to '/videos/stewrun-kitchen.mp4'. Until then the poster image is shown
   with a few steam wisps, and no video is downloaded.
   The caption only appears once real footage is set, so it is never shown
   over a picture it does not describe. */
const VIDEO_SRC ='/videos/stewrun-kitchen.mp4'
const POSTER_SRC = '/images/stewrun-hero-lunch.webp' // swap for a real still
const POSTER_ALT = 'A plate of sadza and beef stew'

const pills = ['Pre-order', 'Pick your hub', 'Pay cash on collection']

type NetworkInformation = { saveData?: boolean; effectiveType?: string }

/** Small time-aware line for the sign-in card. Uses the visitor's own clock. */
export function TimeGreeting() {
  const [text, setText] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const hour = new Date().getHours()
      if (hour >= 5 && hour < 11) setText('Good morning. Plan today’s lunch.')
      else if (hour >= 11 && hour < 14) setText('Ready for lunch?')
      else if (hour >= 14 && hour < 18) setText('Good afternoon.')
      else setText('Good evening. Plan tomorrow’s lunch.')
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <p
      className="mb-1.5 text-sm font-semibold text-clay-500"
      style={{ minHeight: 20 }}
    >
      {text}
    </p>
  )
}

function KitchenVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [auto, setAuto] = useState(false)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)

  // Autoplay only on desktop widths, with motion allowed and a light connection.
  useEffect(() => {
    if (!VIDEO_SRC) return
    const timeout = window.setTimeout(() => {
      const desktop = window.matchMedia('(min-width: 1024px)').matches
      const motionOk = !window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      const connection = (
        navigator as Navigator & { connection?: NetworkInformation }
      ).connection
      const light =
        !connection?.saveData &&
        connection?.effectiveType !== 'slow-2g' &&
        connection?.effectiveType !== '2g'
      setAuto(desktop && motionOk && light)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  const showVideo = Boolean(VIDEO_SRC) && (auto || started)

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  return (
    <div className="auth-vid">
      <Image
        src={POSTER_SRC}
        alt={showVideo ? '' : POSTER_ALT}
        fill
        sizes="(min-width: 1024px) 560px, 100vw"
        className="object-cover object-[60%_55%]"
      />

      {showVideo && VIDEO_SRC && (
        <video
          ref={videoRef}
          className="auth-video"
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          autoPlay
          loop
          playsInline
          muted={muted}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          aria-label="A local cook preparing a meal"
        />
      )}

      {!showVideo && (
        <div aria-hidden="true">
          <span className="auth-steam" style={{ left: '38%' }} />
          <span
            className="auth-steam"
            style={{ left: '48%', animationDelay: '1.2s' }}
          />
          <span
            className="auth-steam"
            style={{ left: '58%', animationDelay: '2.4s' }}
          />
        </div>
      )}

      <div aria-hidden="true" className="auth-vid-shade" />

      {VIDEO_SRC && (
        <p className={`auth-caption ${script.className}`}>
          Freshly cooked,
          <br />
          locally made
          <i />
        </p>
      )}

      {VIDEO_SRC && !showVideo && (
        <button
          type="button"
          onClick={() => setStarted(true)}
          aria-label="Play kitchen video"
          className="auth-round auth-playbig"
        >
          <Play aria-hidden="true" className="size-6" />
        </button>
      )}

      {showVideo && (
        <div className="auth-controls">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause video' : 'Play video'}
            className="auth-round"
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-4" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            aria-pressed={!muted}
            className="auth-round"
          >
            {muted ? (
              <VolumeX aria-hidden="true" className="size-[18px]" />
            ) : (
              <Volume2 aria-hidden="true" className="size-[18px]" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AuthShell({
  mode,
  children,
}: {
  mode: 'login' | 'register'
  children: ReactNode
}) {
  return (
    <main className="auth-main bg-cream-50 text-ink-900">
      <style>{`
        .auth-main{position:relative;overflow:hidden;isolation:isolate;
          min-height:100vh;padding:20px 20px 48px}
        .auth-sky{position:absolute;top:0;bottom:0;right:0;width:100%;z-index:-1;
          pointer-events:none;
          -webkit-mask-image:linear-gradient(to right,transparent 0%,#000 60%);
          mask-image:linear-gradient(to right,transparent 0%,#000 60%)}
        .auth-sky-img{position:absolute;left:0;right:0;bottom:0;top:35%;
          background-image:url('/images/harare-cbd-background.jpg');
          background-size:cover;background-position:85% bottom;
          background-repeat:no-repeat;opacity:.26;
          -webkit-mask-image:linear-gradient(to bottom,transparent 0%,#000 40%,#000 100%);
          mask-image:linear-gradient(to bottom,transparent 0%,#000 40%,#000 100%)}
        .auth-inner{position:relative;max-width:1180px;margin:0 auto}
        .auth-grid{display:grid;gap:40px;align-items:center;margin-top:20px}
        .auth-form{order:-1;width:100%;max-width:448px;margin:0 auto}
        .auth-intro{display:flex;flex-direction:column;gap:20px;min-width:0}
        .auth-pills{display:flex;flex-wrap:wrap;gap:10px;margin:0;padding:0;
          list-style:none}
        .auth-vid{position:relative;aspect-ratio:16/9;overflow:hidden;
          border-radius:24px 24px 24px 64px;background:#5A341D;
          box-shadow:0 24px 48px rgba(90,52,29,.28)}
        .auth-video{position:absolute;inset:0;width:100%;height:100%;
          object-fit:cover}
        .auth-vid-shade{position:absolute;inset:0;
          background:linear-gradient(to top,rgba(30,15,6,.55),transparent 55%)}
        .auth-steam{position:absolute;bottom:26%;width:46px;height:120px;
          border-radius:50%;background:rgba(255,247,239,.2);filter:blur(14px);
          animation:auth-rise 5s ease-in-out infinite}
        @keyframes auth-rise{
          0%{transform:translateY(14px) scaleX(.9);opacity:0}
          35%{opacity:.9}
          100%{transform:translateY(-60px) scaleX(1.25);opacity:0}}
        @media (prefers-reduced-motion:reduce){.auth-steam{animation:none;opacity:.5}}
        .auth-caption{position:absolute;left:28px;bottom:22px;margin:0;
          font-size:28px;line-height:1.05;color:#FFF7EF}
        .auth-caption i{display:block;width:70px;height:3px;border-radius:2px;
          background:#E8A030;margin-top:4px}
        .auth-controls{position:absolute;right:16px;bottom:16px;display:flex;gap:10px}
        .auth-round{width:44px;height:44px;border-radius:50%;border:0;cursor:pointer;
          background:rgba(250,245,239,.94);color:#2A211C;display:flex;
          align-items:center;justify-content:center}
        .auth-round:focus-visible{outline:2px solid #B4472B;outline-offset:2px}
        .auth-playbig{position:absolute;left:50%;top:50%;width:64px;height:64px;
          transform:translate(-50%,-50%)}
        .auth-bubble{position:absolute;top:-18px;right:16px;max-width:230px;
          background:#fff;border-radius:18px 18px 18px 4px;padding:12px 16px;
          box-shadow:0 10px 24px rgba(120,70,30,.18)}
        .auth-cook{display:flex;align-items:center;gap:14px;margin-top:16px;
          background:#FDF4E9;border-radius:18px;padding:14px 18px;
          text-decoration:none;color:inherit;transition:box-shadow .2s}
        .auth-cook:hover{box-shadow:0 8px 20px rgba(120,70,30,.14)}
        .auth-cook:focus-visible{outline:2px solid #B4472B;outline-offset:2px}
        .auth-cook-icon{flex:none;width:44px;height:44px;border-radius:50%;
          background:#fff;border:2px solid #E8A030;display:flex;
          align-items:center;justify-content:center}
        @media (min-width:640px){
          .auth-main{padding:28px 32px 56px}
          .auth-caption{left:36px;bottom:26px;font-size:34px}
        }
        @media (min-width:1024px){
          .auth-main{padding:32px 48px 64px}
          .auth-grid{grid-template-columns:1.12fr 1fr;gap:56px}
          .auth-form{order:0}
          .auth-sky{width:46%}
          .auth-vid{border-radius:28px 28px 28px 90px}
        }
      `}</style>

      <div aria-hidden="true" className="auth-sky">
        <div className="auth-sky-img" />
      </div>

      <div className="auth-inner">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
          aria-label="StewRun home"
        >
          <BrandLogo className="h-[42px] w-[150px]" />
        </Link>

        <div className="auth-grid">
          {/* Left: introduction + video */}
          <section className="auth-intro">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="h-0.5 w-12 bg-ink-900/70 sm:w-[70px]"
              />
              <p className="text-sm font-bold uppercase tracking-[0.07em] text-sage-500">
                A pre-order lunch marketplace for Harare
              </p>
            </div>

            <h1 className="font-display text-4xl leading-[1.06] tracking-tight text-ink-900 sm:text-5xl">
              {mode === 'login' ? (
                <>
                  Your next lunch
                  <span className="block">
                    starts <span className="text-clay-500">here.</span>
                  </span>
                </>
              ) : (
                <>
                  Make room for
                  <span className="block">
                    a lunch made <span className="text-clay-500">local.</span>
                  </span>
                </>
              )}
            </h1>
            <span
              aria-hidden="true"
              className="block h-1 w-[102px] rounded-full bg-saffron-500"
            />

            <p className="max-w-lg text-base leading-7 text-ink-900/75">
              Tell Ziva what you would like, compare offers from home cooks and
              small caterers, then collect your scheduled meal at a Harare hub.
            </p>

            <div style={{ position: 'relative', marginTop: 8 }}>
              <KitchenVideo />
              <div aria-hidden="true" className="auth-bubble">
                <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-clay-500">
                  Ziva
                </p>
                <p className="text-sm leading-snug text-ink-900">
                  Mhoroi! What are you craving for lunch today?
                </p>
              </div>
            </div>

            <ul className="auth-pills">
              {pills.map((pill) => (
                <li
                  key={pill}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900"
                >
                  {pill}
                </li>
              ))}
            </ul>
          </section>

          {/* Right: the form card passed in by each page */}
          <div className="auth-form">
            {children}

            {mode === 'login' && (
              <Link href="/register?role=cook" className="auth-cook">
                <span aria-hidden="true" className="auth-cook-icon">
                  <ChefHat className="size-[22px] text-clay-500" strokeWidth={1.6} />
                </span>
                <span style={{ flex: 1 }}>
                  <span className="block font-display text-lg leading-tight text-ink-900">
                    Cook with StewRun
                  </span>
                  <span className="text-sm text-ink-900/70">
                    Share your cooking, reach more customers.
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-clay-500" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}