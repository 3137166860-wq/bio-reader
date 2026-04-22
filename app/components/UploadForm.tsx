'use client'

import { useState, useCallback } from 'react'
import { extractTextFromPDF } from '@/app/lib/parser/pdf-service'
import AnalysisView from './AnalysisView'
import {
  Upload,
  FileText,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState(0)
  const [pdfText, setPdfText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(e.target.files?.[0])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    validateAndSetFile(e.dataTransfer.files?.[0])
  }

  const validateAndSetFile = (selected: File | undefined) => {
    setError(null)
    if (!selected) return
    if (selected.type !== 'application/pdf') {
      setError('仅支持 PDF 文件')
      return
    }
    if (selected.size > 50 * 1024 * 1024) {
      setError('文件大小不能超过 50MB')
      return
    }
    setFile(selected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setExtracting(true)
    setExtractProgress(0)
    setError(null)

    try {
      // Simulate progress since pdfjs-dist doesn't provide real progress
      const progressInterval = setInterval(() => {
        setExtractProgress((p) => Math.min(p + 15, 85))
      }, 500)

      const text = await extractTextFromPDF(file, 10000)

      clearInterval(progressInterval)
      setExtractProgress(100)

      if (!text || text.length < 50) {
        throw new Error('PDF 内容过少或无法解析')
      }

      // Small delay so the user sees 100% before transition
      await new Promise((r) => setTimeout(r, 300))
      setPdfText(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 解析失败')
    } finally {
      setExtracting(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setPdfText(null)
    setError(null)
    setExtractProgress(0)
  }

  // ── After extraction → show upload summary and AnalysisView below ──
  if (pdfText) {
    return (
      <div className="space-y-6">
        {/* Upload summary card with smooth transition */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {file?.name ?? 'Untitled'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                {pdfText.substring(0, 200)}...
              </p>
              <p className="text-[11px] text-neutral-400 mt-1.5">
                {pdfText.length.toLocaleString()} chars extracted
              </p>
            </div>
            <button
              onClick={handleClear}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AnalysisView with DataGrid */}
        <AnalysisView
          pdfText={pdfText}
          pdfName={file?.name ?? 'Untitled'}
          onClear={handleClear}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Drop zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault()
          e.currentTarget.classList.add(
            'border-blue-400',
            'bg-blue-50/50',
            'dark:bg-blue-950/20'
          )
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove(
            'border-blue-400',
            'bg-blue-50/50',
            'dark:bg-blue-950/20'
          )
        }}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer
          ${
            file
              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20'
              : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50 hover:border-neutral-400 dark:hover:border-neutral-600'
          }`}
      >
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {file ? (
          <>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-full">
              <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {file.name}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="absolute top-3 right-3 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-full">
              <Upload className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-center">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                拖放 PDF 文件到此处，或点击选择
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                支持最大 50MB 的 PDF 文件
              </p>
            </div>
          </>
        )}
      </label>

      {/* Extraction progress */}
      {extracting && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              正在解析 PDF...
            </span>
            <span>{extractProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${extractProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={!file || extracting}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {extracting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            解析中...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            开始分析
          </>
        )}
      </button>
    </form>
  )
}
