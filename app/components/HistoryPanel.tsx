'use client'

import { getHistory, deleteHistory } from '@/app/actions/analyze'
import { useEffect, useState, useCallback } from 'react'
import type { AnalysisResult, PaperCategory } from '@/app/lib/schema/analysis'
import { History, RefreshCw, Trash2, ChevronRight, Dna } from 'lucide-react'

type HistoryItem = {
  id: string
  pdf_name: string
  extracted_json: AnalysisResult
  category: PaperCategory
  created_at: string
}

export default function HistoryPanel() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    const data = await getHistory()
    setHistory(data as unknown as HistoryItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleDelete = async (id: string) => {
    if (confirm('确定删除此记录？')) {
      try {
        await deleteHistory(id)
        await loadHistory()
      } catch (error) {
        console.error(error)
      }
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const entityCount = (item: HistoryItem) =>
    item.extracted_json?.entities?.length ?? 0

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-5 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-neutral-500" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            History
          </h2>
        </div>
        <button
          onClick={loadHistory}
          className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-10 gap-3">
          <div className="w-6 h-6 border-2 border-neutral-200 dark:border-neutral-700 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-xs text-neutral-400">Loading...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2 text-center">
          <Dna className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
          <p className="text-sm text-neutral-500">No analyses yet</p>
          <p className="text-[11px] text-neutral-400 max-w-[180px]">
            Upload a PDF to extract bio-med entities
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {history.map((item) => (
            <div
              key={item.id}
              className="group border border-neutral-100 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <button
                onClick={() =>
                  setExpandedId(
                    expandedId === item.id ? null : item.id
                  )
                }
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {item.pdf_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-neutral-400">
                      {formatDate(item.created_at)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium">
                      {entityCount(item)} entities
                    </span>
                    {item.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(item.id)
                    }}
                    className="p-1.5 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight
                    className={`w-4 h-4 text-neutral-300 transition-transform ${
                      expandedId === item.id ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Expanded detail */}
              {expandedId === item.id && item.extracted_json && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-neutral-100 dark:border-neutral-800 pt-2.5 mt-0">
                  {item.extracted_json.entities?.map((entity, i) => (
                    <div
                      key={i}
                      className="text-[11px] bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2.5 space-y-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          Target:
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {entity.target || '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          Model:
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {entity.animal_model || '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          Dose:
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {entity.dose || '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          Efficacy:
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {entity.efficacy || '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
        <p className="text-[11px] text-neutral-400">
          {history.length} record{history.length !== 1 ? 's' : ''} — private to
          you
        </p>
      </div>
    </div>
  )
}
