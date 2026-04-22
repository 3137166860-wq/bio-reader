'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { AnalysisResult, BaseEntity } from '@/app/lib/schema/analysis'
import { normalizeWhitespace } from '@/app/lib/parser/pdf-service'
import {
  FlaskConical,
  Dna,
  Syringe,
  Activity,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react'

// ── Dimension row config ───────────────────────────────

interface DimensionRow {
  key: keyof BaseEntity
  label: string
  icon: typeof FlaskConical
  color: string
}

const DIMENSIONS: DimensionRow[] = [
  { key: 'target', label: 'Target', icon: Dna, color: 'text-violet-500' },
  {
    key: 'animal_model',
    label: 'Model',
    icon: FlaskConical,
    color: 'text-emerald-500',
  },
  { key: 'dose', label: 'Dose', icon: Syringe, color: 'text-amber-500' },
  {
    key: 'efficacy',
    label: 'Efficacy',
    icon: Activity,
    color: 'text-rose-500',
  },
  {
    key: 'source_text',
    label: 'Source',
    icon: FileText,
    color: 'text-sky-500',
  },
]

// ── Highlight component ────────────────────────────────

function HighlightedText({
  text,
  highlight,
}: {
  text: string
  highlight?: string
}) {
  if (!highlight || !text) {
    return <>{text}</>
  }

  const normalizedText = normalizeWhitespace(text).toLowerCase()
  const normalizedHighlight = normalizeWhitespace(highlight).toLowerCase()

  if (!normalizedHighlight || !normalizedText.includes(normalizedHighlight)) {
    return <>{text}</>
  }

  // Find the match position in the normalized text
  const matchIndex = normalizedText.indexOf(normalizedHighlight)

  // Reconstruct the original text with highlighting
  // We need to map back to original text positions accounting for whitespace differences
  const parts: { text: string; highlight: boolean }[] = []
  let currentPos = 0
  let normalizedPos = 0
  let highlightPos = 0
  let inHighlight = false

  while (currentPos < text.length) {
    const char = text[currentPos]
    const isWhitespace = /\s/.test(char)

    if (!inHighlight && normalizedPos >= matchIndex && normalizedPos < matchIndex + normalizedHighlight.length) {
      inHighlight = true
      parts.push({ text: '', highlight: true })
    }

    if (inHighlight && normalizedPos >= matchIndex + normalizedHighlight.length) {
      inHighlight = false
      parts.push({ text: '', highlight: false })
    }

    // Add character to current part
    const lastPart = parts[parts.length - 1]
    if (!lastPart || lastPart.highlight !== inHighlight) {
      parts.push({ text: char, highlight: inHighlight })
    } else {
      lastPart.text += char
    }

    if (!isWhitespace || (isWhitespace && text[currentPos + 1] && !/\s/.test(text[currentPos + 1]))) {
      normalizedPos++
    }
    currentPos++
  }

  return (
    <>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark
            key={i}
            className="bg-yellow-200/80 dark:bg-yellow-500/30 rounded-sm px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

// ── Props ──────────────────────────────────────────────

interface DataGridProps {
  result: AnalysisResult | undefined
  isLoading: boolean
  error: Error | undefined
}

// ── Data Grid Component ────────────────────────────────

export default function DataGrid({ result, isLoading, error }: DataGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const entities = result?.entities ?? []

  // Auto-scroll to latest entity as they stream in
  const prevLengthRef = useRef(0)
  useEffect(() => {
    if (entities.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
    prevLengthRef.current = entities.length
  }, [entities.length])

  const getCellValue = useCallback(
    (entity: BaseEntity, key: keyof BaseEntity): string => {
      return String(entity[key] ?? '')
    },
    []
  )

  // ── Empty state ──────────────────────────────────────
  if (!isLoading && !error && entities.length === 0) {
    return null
  }

  // ── Loading skeleton ─────────────────────────────────
  if (isLoading && entities.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-6 flex items-center justify-center gap-3 text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analyzing paper...</span>
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900 p-6">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Analysis failed: {error.message}</p>
        </div>
      </div>
    )
  }

  const gridTemplateColumns = `180px repeat(${entities.length}, minmax(240px, 1fr))`

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Extracted Entities
            {isLoading && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-neutral-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                streaming
              </span>
            )}
          </h3>
          <span className="text-xs text-neutral-400 tabular-nums">
            {entities.length} entity{entities.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>
      </div>

      {/* Scrollable grid container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns,
            minWidth: '100%',
          }}
        >
          {/* ── Column headers ─────────────────────────── */}
          <div className="sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-800/50 border-r border-neutral-100 dark:border-neutral-800">
            <div className="h-10 px-4 flex items-center">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                Dimension
              </span>
            </div>
          </div>

          {entities.map((_, colIdx) => (
            <div
              key={colIdx}
              className="h-10 px-4 flex items-center border-r border-neutral-100 dark:border-neutral-800 last:border-r-0"
            >
              <span className="text-[11px] font-medium text-neutral-500 truncate">
                #{colIdx + 1}
              </span>
            </div>
          ))}

          {/* ── Data rows ──────────────────────────────── */}
          {DIMENSIONS.map((dim) => (
            <DimensionRowContent
              key={dim.key}
              dim={dim}
              entities={entities}
              getCellValue={getCellValue}
            />
          ))}
        </div>
      </div>

      {/* Footer with paper info */}
      {result?.paper_title && (
        <div className="px-5 py-2.5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
          <p className="text-[11px] text-neutral-400 truncate">
            {result.paper_title}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Dimension Row Sub-component ────────────────────────

function DimensionRowContent({
  dim,
  entities,
  getCellValue,
}: {
  dim: DimensionRow
  entities: BaseEntity[]
  getCellValue: (entity: BaseEntity, key: keyof BaseEntity) => string
}) {
  const Icon = dim.icon

  return (
    <>
      {/* Fixed first column */}
      <div className="sticky left-0 z-10 bg-white dark:bg-neutral-900 border-r border-b border-neutral-100 dark:border-neutral-800">
        <div className="h-full min-h-[52px] px-4 py-3 flex items-start gap-2.5">
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dim.color}`} />
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {dim.label}
          </span>
        </div>
      </div>

      {/* Scrollable cells */}
      {entities.map((entity, colIdx) => {
        const value = getCellValue(entity, dim.key)
        const sourceText =
          dim.key === 'source_text' ? value : entity.source_text

        return (
          <div
            key={colIdx}
            className="border-r border-b border-neutral-100 dark:border-neutral-800 last:border-r-0 min-h-[52px]"
          >
            <div className="px-4 py-3">
              {dim.key === 'source_text' ? (
                <p className="text-[12px] leading-relaxed text-neutral-500 italic line-clamp-3">
                  &ldquo;
                  <HighlightedText text={value} />
                  &rdquo;
                </p>
              ) : (
                <p className="text-[13px] leading-snug text-neutral-800 dark:text-neutral-200 break-words">
                  {value || (
                    <span className="text-neutral-300 dark:text-neutral-600 italic text-[11px]">
                      —
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
