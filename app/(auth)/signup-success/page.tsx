import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, MailCheck } from "lucide-react";

type SignupSuccessPageProps = {
  searchParams: Promise<{ confirmed?: string }>;
};

async function SignupConfirmation({
  searchParams,
}: SignupSuccessPageProps) {
  const { confirmed } = await searchParams;
  const isConfirmed = confirmed === "true";

  return (
    <section className="w-full max-w-lg rounded-xl border border-ink-900/10 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-full bg-sage-500/10 text-sage-700">
          {isConfirmed ? (
            <CheckCircle2 aria-hidden="true" className="size-6" />
          ) : (
            <MailCheck aria-hidden="true" className="size-6" />
          )}
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink-900">
          {isConfirmed ? "Email confirmed" : "Check your email"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-900/70">
          {isConfirmed
            ? "Your email is confirmed. Sign in to continue to StewRun."
            : "Use the confirmation link in your email. If you already confirmed it, you can sign in below."}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-clay-500 px-5 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
        >
          Go to sign in
        </Link>
        <Link
          href="/"
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md px-5 text-sm font-semibold text-ink-900/70 hover:bg-cream-50"
        >
          Back to StewRun
        </Link>
    </section>
  );
}

export default function SignupSuccessPage(props: SignupSuccessPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-50 px-5 py-10">
      <Suspense
        fallback={
          <section className="w-full max-w-lg rounded-xl border border-ink-900/10 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm text-ink-900/70">Checking your email confirmation…</p>
          </section>
        }
      >
        <SignupConfirmation {...props} />
      </Suspense>
    </main>
  );
}
