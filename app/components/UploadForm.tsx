'use client'

import { useState } from 'react'
import type { AnalysisResult } from '@/app/actions/analyze'

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected && selected.type === 'application/pdf') {
      setFile(selected)
      setError(null)
    } else {
      setFile(null)
      setError('请选择 PDF 文件')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('请先选择 PDF 文件')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // 极致懒加载：仅在需要解析 PDF 时才引入 pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist')
      // 配置 worker（这一步很重要，否则浏览器会报缺少 worker 的错）
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

      // 提取 PDF 文本（浏览器端）
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let pdfText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items
          .map((item: unknown) => (item as { str: string }).str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        pdfText += pageText + '\n'
      }
      pdfText = pdfText.trim()
      // 限制文本长度，防止请求过大
      if (pdfText.length > 10000) {
        pdfText = pdfText.substring(0, 10000)
      }

      // 动态引入 Server Action，避免任何可能的顶层依赖
      const { analyzePDF } = await import('@/app/actions/analyze')
      const analysis = await analyzePDF(pdfText, file.name)
      setResult(analysis)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            选择 PDF 文件
          </label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              已选择: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '分析中…' : '开始 AI 分析'}
        </button>
      </form>

      {result && (
        <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl">
          <h3 className="text-xl font-bold text-gray-900 mb-4">分析结果</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-800">核心结论</h4>
              <p className="text-gray-700 mt-1">{result.core_conclusion}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">材料列表</h4>
              <ul className="list-disc pl-5 text-gray-700 mt-1">
                {result.materials.map((m: string, i: number) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">实验步骤</h4>
              <ol className="list-decimal pl-5 text-gray-700 mt-1">
                {result.protocol_steps.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            此记录已保存至您的历史记录。
          </p>
        </div>
      )}
    </div>
  )
}