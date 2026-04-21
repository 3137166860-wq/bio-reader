'use client'

import { useState } from 'react'
import type { AnalysisResult } from '@/app/actions/analyze'

type ProcessStep = 'idle' | 'reading_pdf' | 'analyzing_ai'

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [processStep, setProcessStep] = useState<ProcessStep>('idle')
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

    setProcessStep('reading_pdf')
    setError(null)
    setResult(null)

    let pdfText = ''
    try {
      // 极致懒加载：仅在需要解析 PDF 时才引入 pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist')
      
      // 优先尝试新版 .mjs Worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`
      
      // 提取 PDF 文本（浏览器端） - 防弹版本
      const arrayBuffer = await file.arrayBuffer()
      const typedarray = new Uint8Array(arrayBuffer) // 强类型字节数组，防止底层遍历崩溃
      let pdf
      try {
        // 极其关键：必须 await .promise
        const loadingTask = pdfjsLib.getDocument(typedarray)
        pdf = await loadingTask.promise
      } catch (workerError) {
        // 如果 .mjs Worker 加载失败，回退到稳定的 v3 版本 CDN
        console.warn('mjs Worker 加载失败，回退到 v3 版本', workerError)
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        const loadingTask = pdfjsLib.getDocument(typedarray)
        pdf = await loadingTask.promise
      }
      
      // 逐页提取文字 - 使用最原始的 for 循环，绝对避免 for...of 或 map 引起的编译报错
      pdfText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        
        let pageText = ''
        if (textContent && textContent.items) {
          for (let j = 0; j < textContent.items.length; j++) {
            // @ts-ignore
            const itemStr = textContent.items[j].str
            if (itemStr) {
              pageText += itemStr + ' '
            }
          }
        }
        pdfText += pageText + '\n'
      }
      pdfText = pdfText.trim()
      // 限制文本长度，防止请求过大
      if (pdfText.length > 10000) {
        pdfText = pdfText.substring(0, 10000)
      }
      // 打印提取结果以供调试
      console.log('PDF 提取完毕，总字数:', pdfText.length)
    } catch (err: unknown) {
      setError(`PDF 解析失败：${err instanceof Error ? err.message : '未知错误'}`)
      setProcessStep('idle')
      return
    }

    try {
      setProcessStep('analyzing_ai')
      // 动态引入 Server Action，避免任何可能的顶层依赖
      const { analyzePDF } = await import('@/app/actions/analyze')
      const analysis = await analyzePDF(pdfText, file.name)
      setResult(analysis)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setProcessStep('idle')
    }
  }

  const stepMessages = {
    idle: '',
    reading_pdf: '步骤 1/2：正在努力阅读 PDF 内容...',
    analyzing_ai: '步骤 2/2：AI 正在深度思考中，大概需要 30-60 秒，请耐心等待...',
  }

  const loading = processStep !== 'idle'

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

        {/* 进度提示 */}
        {processStep !== 'idle' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-blue-800 font-medium">{stepMessages[processStep]}</p>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  processStep === 'reading_pdf' ? 'w-1/2 bg-blue-500' : 'w-full bg-green-500'
                }`}
              ></div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '处理中…' : '开始 AI 分析'}
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