'use client'

import { useMemo, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table'
import { Loader2, AlertCircle, Check, AlertTriangle } from 'lucide-react'
import type { AnalysisResult, BaseEntity } from '@/app/lib/schema/analysis'
import {
  useStreamTableEngine,
  CellStatus,
  type TableCell,
} from '@/app/hooks/useStreamTableEngine'

// ── 维度配置（与钩子保持一致） ──────────────────────────────
const DIMENSION_CONFIGS = [
  { key: 'target' as const, label: 'Target', color: 'text-violet-500' },
  { key: 'animal_model' as const, label: 'Model', color: 'text-emerald-500' },
  { key: 'dose' as const, label: 'Dose', color: 'text-amber-500' },
  { key: 'efficacy' as const, label: 'Efficacy', color: 'text-rose-500' },
  { key: 'source_text' as const, label: 'Source', color: 'text-sky-500' },
]

// ── 组件属性 ──────────────────────────────────────────────
interface DataGridProps {
  /** 流式分析结果 */
  result?: AnalysisResult
  /** 是否正在加载（流式传输中） */
  isLoading: boolean
  /** 错误对象 */
  error?: Error
}

// ── 表格列定义 ────────────────────────────────────────────
type DataGridColumn = {
  /** 列 ID */
  id: string
  /** 列标题（文献索引或标题） */
  header: string
  /** 列宽 */
  width?: number
  /** 是否为维度列（第一列） */
  isDimensionColumn: boolean
}

// ── 表格行数据 ────────────────────────────────────────────
interface DataGridRow {
  /** 行 ID */
  id: string
  /** 维度键 */
  dimensionKey: keyof BaseEntity
  /** 维度标签 */
  dimensionLabel: string
  /** 维度颜色 */
  dimensionColor: string
  /** 各列单元格数据 */
  cells: Record<string, TableCell>
}

// ── 状态图标组件 ──────────────────────────────────────────
function StatusIcon({ status }: { status: CellStatus }) {
  switch (status) {
    case CellStatus.SYNCING:
      return <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
    case CellStatus.DONE:
      return <Check className="w-3 h-3 text-green-500" />
    case CellStatus.STALE_CONFLICT:
      return <AlertTriangle className="w-3 h-3 text-amber-500" />
    default:
      return null
  }
}

// ── 主组件 ────────────────────────────────────────────────
export default function DataGrid({ result, isLoading, error }: DataGridProps) {
  // 使用流式表格引擎钩子
  const { rows, columnCount, isStreaming, conflictCellIds } = useStreamTableEngine({
    streamingEntities: result?.entities ?? [],
    isStreamingComplete: !isLoading,
    initialColumnCount: result?.entities?.length ?? 0,
  })

  // 滚动容器引用（用于纵向虚拟化占位）
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 构建表格列
  const columns = useMemo<ColumnDef<DataGridRow>[]>(() => {
    // 第一列：维度列
    const dimensionColumn: ColumnDef<DataGridRow> = {
      id: 'dimension',
      header: () => (
        <div className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
          Dimension
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <span className={`text-xs font-medium ${row.original.dimensionColor}`}>
            {row.original.dimensionLabel}
          </span>
          {isStreaming && row.original.dimensionKey === 'target' && (
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          )}
        </div>
      ),
      size: 180,
      enableResizing: false,
    }

    // 动态文献列
    const literatureColumns: ColumnDef<DataGridRow>[] = Array.from(
      { length: columnCount },
      (_, colIdx) => ({
        id: `literature_${colIdx}`,
        header: () => (
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 truncate">
              #{colIdx + 1}
            </span>
            {isStreaming && colIdx === columnCount - 1 && (
              <Loader2 className="w-3 h-3 animate-spin text-blue-500 ml-1" />
            )}
          </div>
        ),
        cell: ({ row }) => {
          const cell = row.original.cells[`literature_${colIdx}`]
          if (!cell) return null

          const isSourceText = row.original.dimensionKey === 'source_text'
          const hasConflict = cell.status === CellStatus.STALE_CONFLICT

          return (
            <div className="relative group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {isSourceText ? (
                    <p className="text-[12px] leading-relaxed text-neutral-500 italic line-clamp-3">
                      &ldquo;{cell.rawValue}&rdquo;
                    </p>
                  ) : (
                    <p
                      className={`text-[13px] leading-snug break-words ${
                        hasConflict
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {cell.rawValue || (
                        <span className="text-neutral-300 dark:text-neutral-600 italic text-[11px]">
                          —
                        </span>
                      )}
                    </p>
                  )}
                  {/* 解析后的数值信息 */}
                  {cell.parsedValue.numeric_value !== null && (
                    <div className="mt-1">
                      <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 rounded">
                        {cell.parsedValue.numeric_value}
                        {cell.parsedValue.unit && ` ${cell.parsedValue.unit}`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <StatusIcon status={cell.status} />
                </div>
              </div>
              {/* 冲突提示 */}
              {hasConflict && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                </div>
              )}
            </div>
          )
        },
        size: 240,
        minSize: 200,
        maxSize: 320,
      })
    )

    return [dimensionColumn, ...literatureColumns]
  }, [columnCount, isStreaming])

  // 构建表格行数据
  const tableData = useMemo<DataGridRow[]>(() => {
    return rows.map((row) => {
      const config = DIMENSION_CONFIGS.find((c) => c.key === row.dimensionKey)
      const cells: Record<string, TableCell> = {}
      row.cells.forEach((cell) => {
        cells[`literature_${cell.columnIndex}`] = cell
      })

      return {
        id: row.dimensionKey,
        dimensionKey: row.dimensionKey,
        dimensionLabel: config?.label ?? row.dimensionKey,
        dimensionColor: config?.color ?? 'text-neutral-500',
        cells,
      }
    })
  }, [rows])

  // 初始化 TanStack Table
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  })

  // 自动滚动到最新列
  useEffect(() => {
    if (scrollContainerRef.current && columnCount > 0 && isStreaming) {
      const container = scrollContainerRef.current
      container.scrollLeft = container.scrollWidth
    }
  }, [columnCount, isStreaming])

  // ── 空状态 ──────────────────────────────────────────────
  if (!isLoading && !error && columnCount === 0) {
    return null
  }

  // ── 加载骨架屏 ──────────────────────────────────────────
  if (isLoading && columnCount === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-6 flex items-center justify-center gap-3 text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analyzing paper...</span>
        </div>
      </div>
    )
  }

  // ── 错误状态 ────────────────────────────────────────────
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

  // 表格列样式
  const gridTemplateColumns = `180px repeat(${columnCount}, minmax(240px, 1fr))`

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* 表格标题 */}
      <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Extracted Entities
            {isStreaming && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-neutral-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                streaming
              </span>
            )}
          </h3>
          <div className="flex items-center gap-4">
            {conflictCellIds.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {conflictCellIds.length} conflict{conflictCellIds.length !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs text-neutral-400 tabular-nums">
              {columnCount} paper{columnCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 可滚动表格容器 */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{
          scrollBehavior: 'smooth',
          // 启用 GPU 硬件加速
          transform: 'translateZ(0)',
          willChange: 'scroll-position',
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns,
            minWidth: '100%',
          }}
        >
          {/* 表头 */}
          {table.getHeaderGroups().map((headerGroup) => (
            <div
              key={headerGroup.id}
              className="contents"
            >
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  className={`sticky top-0 z-20 bg-neutral-50 dark:bg-neutral-800/50 border-r border-neutral-100 dark:border-neutral-800 ${
                    header.id === 'dimension' ? 'left-0 z-30' : ''
                  }`}
                  style={{
                    width: header.getSize(),
                  }}
                >
                  <div className="h-10 px-4 flex items-center">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* 表格行 */}
          {table.getRowModel().rows.map((row) => (
            <div
              key={row.id}
              className="contents"
            >
              {row.getVisibleCells().map((cell) => (
                <div
                  key={cell.id}
                  className={`border-r border-b border-neutral-100 dark:border-neutral-800 ${
                    cell.column.id === 'dimension'
                      ? 'sticky left-0 z-10 bg-white dark:bg-neutral-900'
                      : ''
                  }`}
                  style={{
                    width: cell.column.getSize(),
                  }}
                >
                  <div className="px-4 py-3 min-h-[52px]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 纵向虚拟化占位（预留结构） */}
      <div
        className="h-0 overflow-hidden"
        style={{
          // 纵向虚拟化占位，后续可接入 react-virtual 或 tanstack-virtual
          contain: 'strict',
          contentVisibility: 'auto',
        }}
      />

      {/* 页脚：论文标题 */}
      {result?.paper_title && (
        <div className="px-5 py-2.5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
          <p className="text-[11px] text-neutral-400 truncate">{result.paper_title}</p>
        </div>
      )}
    </div>
  )
}
