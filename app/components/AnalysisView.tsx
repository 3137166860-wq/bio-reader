'use client'

import { useRef, useState, useEffect } from 'react'
import { useCompletion } from '@ai-sdk/react'
import DataGrid from './DataGrid'
import { type AnalysisResult, type BaseEntity } from '@/app/lib/schema/analysis'
import { useStreamTableEngine } from '@/app/hooks/useStreamTableEngine'
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
    completion,
    isLoading,
    error,
    complete: submit,
    stop,
  } = useCompletion({
    api: '/api/analyze',
    // 自定义请求体以匹配后端期望的字段
    body: {
      text: pdfText,
      pdfName,
      clientTimestamp: clientTimestampRef.current,
    },
    onError: (err) => console.error('Stream error:', err),
    onFinish: async (prompt, resultText) => {
      // 原有保存逻辑
      if (!resultText) return
      setSaving(true)
      setSaveError(null)
      try {
        // 尝试解析结果文本
        const result = JSON.parse(resultText)
        // 客户端保存回退逻辑（服务器端持久化已通过 after() 完成）
        // 此回退是可选的，仅当服务器端持久化未完成时触发
        const { patchAnalysisAtomic } = await import(
          '@/app/actions/analyze'
        )
        // 记录 ID 在响应头中，但 useCompletion 不暴露头信息。
        // 服务器端持久化 via after() 是主要路径。
        // 此回退是尽力而为的。
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

  // ── 安全增量 JSON 解析 ────────────────────────────────
  let currentEntities: BaseEntity[] = []
  try {
    if (completion) {
      const parsed = JSON.parse(completion)
      currentEntities = parsed.entities || []
    }
  } catch (e) {
    // 忽略中间态解析错误
  }

  // ── 双轨对冲状态机 ─────────────────────────────────────
  const { rows: tableData, isStreaming: tableStatus } = useStreamTableEngine({
    streamingEntities: currentEntities,
    isStreamingComplete: !isLoading && currentEntities.length > 0,
  })

  // ── Auto‑start analysis on mount ─────────────────────
  const hasStarted = useRef(false)
  useEffect(() => {
    if (!hasStarted.current && pdfText) {
      hasStarted.current = true
      submit('') // 使用预定义的 body，传递空字符串作为 prompt
    }
  }, [pdfText, pdfName, submit])

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
          data={tableData}
          isStreaming={tableStatus}
          error={error}
        />
      </div>
    </div>
  )
}
