'use client'

import { getHistory, deleteHistory, AnalysisResult } from '@/app/actions/analyze'
import { useEffect, useState, useCallback } from 'react'

type HistoryItem = {
  id: string
  pdf_name: string
  extracted_json: AnalysisResult
  created_at: string
}

export default function HistoryPanel() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    const data = await getHistory()
    setHistory(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">分析历史</h2>
        <button
          onClick={loadHistory}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">加载中…</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>暂无历史记录</p>
          <p className="text-sm mt-1">上传 PDF 后，分析结果将出现在这里</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900 truncate">
                    {item.pdf_name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(item.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-400 hover:text-red-500"
                  title="删除"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3 text-sm text-gray-700">
                <p className="truncate">
                  <strong>结论:</strong>{' '}
                  {item.extracted_json?.core_conclusion?.substring(0, 60)}…
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    {item.extracted_json?.materials?.length || 0} 材料
                  </span>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    {item.extracted_json?.protocol_steps?.length || 0} 步骤
                  </span>
                </div>
              </div>
              <button
                onClick={() =>
                  alert(
                    JSON.stringify(item.extracted_json, null, 2)
                  )
                }
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                查看完整结果
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200 text-sm text-gray-500">
        <p>
          共 <strong>{history.length}</strong> 条记录，仅您本人可见。
        </p>
      </div>
    </div>
  )
}