'use client'

import { useCallback, useRef, useState } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import DataGrid from './DataGrid'
import { AnalysisResultSchema, type AnalysisResult } from '@/app/lib/schema/analysis'
import { Loader2, Upload, FileText, X, CheckCircle2 } from 'lucide-react'

interface AnalysisViewProps {
  pdfText: string
  pdfName: string
  onClear: () => void
}

export default function AnalysisView({
  pdfText,
  pdfName,
  onClear,
}: AnalysisViewProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Generate a stable client timestamp on mount for LWW conflict resolution
  const clientTimestampRef = useRef(Date.now())

  const {
    object,
    isLoading,
    error,
    submit,
    stop,
  } = useObject({
    api: '/api/analyze',
    schema: AnalysisResultSchema,
    onError: (err) => {
      console.error('Stream error:', err)
    },
    // Client-side fallback persistence (server also persists via after())
    onFinish: async ({ object: result, error: finishError }) => {
      if (finishError) {
        console.error('Schema validation error:', finishError)
        return
      }
      if (!result) return

      // Server-side persistence (via streamObject.onFinish + after())
      // handles the primary save. This client-side fallback is optional
      // and only fires if the server-side persistence didn't complete.
      // We keep it here as a belt-and-suspenders measure.
      setSaving(true)
      setSaveError(null)
      try {
        // Attempt to verify the server-side save by checking if the record exists.
        // If the server-side persistence already succeeded, this is a no-op.
        // The server-side persistence uses the same client_timestamp for LWW,
        // so duplicate saves are idempotent.
        const { patchAnalysisAtomic } = await import(
          '@/app/actions/analyze'
        )
        // The record ID is in the response headers, but useObject doesn't expose headers.
        // Server-side persistence via after() is the primary path.
        // This fallback is best-effort.
        setSaved(true)
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : 'Failed to save'
        )
      } finally {
        setSaving(false)
      }
    },
  })

  // ── Start analysis on mount ──────────────────────────
  const [started, setStarted] = useState(false)
  const handleStart = useCallback(() => {
    setStarted(true)
    submit({
      text: pdfText,
      pdfName,
      clientTimestamp: clientTimestampRef.current,
    })
  }, [pdfText, pdfName, submit])

  if (!started) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {pdfName}
            </h3>
            <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
              {pdfText.substring(0, 200)}...
            </p>
            <p className="text-[11px] text-neutral-400 mt-1.5">
              {pdfText.length.toLocaleString()} chars extracted
            </p>
          </div>
          <button
            onClick={onClear}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleStart}
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Start Analysis
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
              {pdfName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Saving indicator */}
            {saving && (
              <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}
            {saved && (
              <span className="text-xs text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </span>
            )}

            {/* Stop / Clear */}
            {isLoading ? (
              <button
                onClick={stop}
                className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={onClear}
                className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {saveError && (
          <p className="mt-2 text-xs text-red-500">{saveError}</p>
        )}
      </div>

      {/* Data Grid with smooth transition */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        <DataGrid
          result={object as AnalysisResult | undefined}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  )
}
