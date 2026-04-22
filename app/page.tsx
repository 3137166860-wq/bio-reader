import { createClient } from '@/app/lib/supabase/server'
import HistoryPanel from './components/HistoryPanel'
import LoginForm from './components/auth/LoginForm'
import ClientUploadForm from './components/ClientUploadForm'
import SignOutButton from './components/auth/SignOutButton'
import { Dna } from 'lucide-react'

export const maxDuration = 60

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900">
        <div className="max-w-sm mx-auto px-4 pt-24 pb-16">
          {/* Logo */}
          <div className="flex flex-col items-center mb-12">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-2xl mb-4">
              <Dna className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Bio‑Reader
            </h1>
            <p className="text-sm text-neutral-500 mt-2 text-center max-w-[260px]">
              AI-powered biomedical entity extraction from PDF papers
            </p>
          </div>

          <LoginForm />

          <footer className="mt-16 text-center">
            <p className="text-[11px] text-neutral-400">
              Supabase Auth + DeepSeek AI + Next.js Edge
            </p>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Header ──────────────────────────────────── */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
              <Dna className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                Bio‑Reader
              </h1>
              <p className="text-[11px] text-neutral-500">
                {user.email?.split('@')[0]}
              </p>
            </div>
          </div>
          <SignOutButton />
        </header>

        {/* ── Main grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Upload + Analysis */}
          <div className="lg:col-span-3 space-y-6">
            {/* Upload section */}
            <section className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Upload Paper
              </h2>
              <ClientUploadForm />
            </section>
          </div>

          {/* Right: History */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <HistoryPanel />
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────── */}
        <footer className="mt-12 pb-6 text-center">
          <p className="text-[11px] text-neutral-400 flex items-center justify-center gap-1.5">
            Powered by Next.js Edge · DeepSeek AI · Supabase
          </p>
        </footer>
      </div>
    </div>
  )
}
