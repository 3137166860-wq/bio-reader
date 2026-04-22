'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { BaseEntity } from '@/app/lib/schema/analysis'

// ── 单元格状态枚举 ──────────────────────────────────────
export enum CellStatus {
  /** 流式传输中，打字机效果 */
  SYNCING = 'SYNCING',
  /** 流结束，数据稳定 */
  DONE = 'DONE',
  /** 读写竞态，需要用户裁决 */
  STALE_CONFLICT = 'STALE_CONFLICT',
}

// ── 解析后的生物医学值 ───────────────────────────────────
export interface ParsedBiologicalValue {
  /** 原始字符串 */
  raw_value: string
  /** 提取出的数值（如 10 mg/kg 中的 10），若无则为 null */
  numeric_value: number | null
  /** 单位（如 mg/kg, μM），若无则为空字符串 */
  unit: string
}

// ── 表格单元格 ──────────────────────────────────────────
export interface TableCell {
  /** 单元格唯一标识 */
  id: string
  /** 行维度键 */
  dimensionKey: keyof BaseEntity
  /** 列索引（文献索引） */
  columnIndex: number
  /** 原始值 */
  rawValue: string
  /** 解析后的值 */
  parsedValue: ParsedBiologicalValue
  /** 单元格状态 */
  status: CellStatus
  /** 最后更新时间戳 */
  updatedAt: number
}

// ── 表格行（每个维度一行） ───────────────────────────────
export interface TableRow {
  /** 维度键 */
  dimensionKey: keyof BaseEntity
  /** 维度标签 */
  label: string
  /** 该行所有单元格 */
  cells: TableCell[]
}

// ── 流式表格引擎状态 ─────────────────────────────────────
export interface StreamTableEngineState {
  /** 所有行 */
  rows: TableRow[]
  /** 列数（文献数量） */
  columnCount: number
  /** 是否正在流式传输 */
  isStreaming: boolean
  /** 最后处理的实体索引 */
  lastProcessedIndex: number
  /** 冲突单元格 ID 数组 */
  conflictCellIds: string[]
}

// ── 钩子参数 ────────────────────────────────────────────
export interface UseStreamTableEngineOptions {
  /** 从 useObject 流式获取的 AnalysisResult.entities */
  streamingEntities?: BaseEntity[]
  /** 流式传输是否完成 */
  isStreamingComplete?: boolean
  /** 初始列数（可选） */
  initialColumnCount?: number
}

// ── 维度配置 ────────────────────────────────────────────
const DIMENSION_CONFIGS: { key: keyof BaseEntity; label: string }[] = [
  { key: 'target', label: 'Target' },
  { key: 'animal_model', label: 'Model' },
  { key: 'dose', label: 'Dose' },
  { key: 'efficacy', label: 'Efficacy' },
  { key: 'source_text', label: 'Source' },
]

// ── 解析生物医学值的占位函数 ──────────────────────────────
function parseBiologicalValue(raw: string): ParsedBiologicalValue {
  if (!raw || typeof raw !== 'string') {
    return { raw_value: raw, numeric_value: null, unit: '' }
  }

  // 简单正则匹配数字和单位
  const numericMatch = raw.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/)
  const numericValue = numericMatch ? parseFloat(numericMatch[0]) : null

  // 尝试提取单位（常见生物医学单位）
  const unitRegex = /(mg\/kg|mg\/mL|μM|nM|pM|g\/kg|mL\/kg|cells\/mouse|%|days|weeks|h|hr|hours)/i
  const unitMatch = raw.match(unitRegex)
  const unit = unitMatch ? unitMatch[0] : ''

  return {
    raw_value: raw,
    numeric_value: numericValue,
    unit,
  }
}

// ── 生成单元格 ID ───────────────────────────────────────
function generateCellId(dimensionKey: keyof BaseEntity, columnIndex: number): string {
  return `${dimensionKey}_${columnIndex}`
}

// ── 主钩子 ──────────────────────────────────────────────
export function useStreamTableEngine({
  streamingEntities = [],
  isStreamingComplete = false,
  initialColumnCount = 0,
}: UseStreamTableEngineOptions): StreamTableEngineState {
  // 状态
  const [rows, setRows] = useState<TableRow[]>(() =>
    DIMENSION_CONFIGS.map((config) => ({
      dimensionKey: config.key,
      label: config.label,
      cells: Array.from({ length: initialColumnCount }, (_, colIdx) => ({
        id: generateCellId(config.key, colIdx),
        dimensionKey: config.key,
        columnIndex: colIdx,
        rawValue: '',
        parsedValue: { raw_value: '', numeric_value: null, unit: '' },
        status: CellStatus.SYNCING,
        updatedAt: Date.now(),
      })),
    }))
  )

  const [columnCount, setColumnCount] = useState(initialColumnCount)
  const [conflictCellIds, setConflictCellIds] = useState<string[]>([])

  // 使用 useRef 追踪最后处理的索引，避免 V8 GC 抖动
  const lastProcessedIndexRef = useRef(0)

  // 处理增量实体
  useEffect(() => {
    if (streamingEntities.length === 0) return

    // 仅处理新增的实体（增量）
    const newEntities = streamingEntities.slice(lastProcessedIndexRef.current)
    if (newEntities.length === 0) return

    // 更新列数
    if (streamingEntities.length > columnCount) {
      setColumnCount(streamingEntities.length)
    }

    setRows((prevRows) => {
      const newRows = [...prevRows]

      // 为每个新列添加单元格
      if (streamingEntities.length > columnCount) {
        const columnsToAdd = streamingEntities.length - columnCount
        for (let colIdx = columnCount; colIdx < columnCount + columnsToAdd; colIdx++) {
          newRows.forEach((row) => {
            row.cells.push({
              id: generateCellId(row.dimensionKey, colIdx),
              dimensionKey: row.dimensionKey,
              columnIndex: colIdx,
              rawValue: '',
              parsedValue: { raw_value: '', numeric_value: null, unit: '' },
              status: CellStatus.SYNCING,
              updatedAt: Date.now(),
            })
          })
        }
      }

      // 更新每个新实体的单元格值
      newEntities.forEach((entity, entityOffset) => {
        const colIdx = lastProcessedIndexRef.current + entityOffset

        newRows.forEach((row) => {
          const cell = row.cells[colIdx]
          if (!cell) return

          const rawValue = String(entity[row.dimensionKey] ?? '')
          const parsedValue = parseBiologicalValue(rawValue)

          // 检查是否存在读写竞态（如果单元格已有值且与新值不同）
          const hasConflict =
            cell.rawValue !== '' &&
            cell.rawValue !== rawValue &&
            cell.status !== CellStatus.STALE_CONFLICT

          cell.rawValue = rawValue
          cell.parsedValue = parsedValue
          cell.updatedAt = Date.now()

          if (hasConflict) {
            cell.status = CellStatus.STALE_CONFLICT
          } else {
            // 如果流已完成，标记为 DONE，否则保持 SYNCING
            cell.status = isStreamingComplete ? CellStatus.DONE : CellStatus.SYNCING
          }
        })
      })

      return newRows
    })

    // 更新冲突单元格列表
    setConflictCellIds((prev) => {
      const newConflicts: string[] = []
      newEntities.forEach((_, entityOffset) => {
        const colIdx = lastProcessedIndexRef.current + entityOffset
        DIMENSION_CONFIGS.forEach((config) => {
          const cellId = generateCellId(config.key, colIdx)
          // 检查该单元格是否在 rows 中标记为冲突
          const row = rows.find((r) => r.dimensionKey === config.key)
          const cell = row?.cells[colIdx]
          if (cell?.status === CellStatus.STALE_CONFLICT && !prev.includes(cellId)) {
            newConflicts.push(cellId)
          }
        })
      })
      return [...prev, ...newConflicts]
    })

    // 更新最后处理的索引
    lastProcessedIndexRef.current = streamingEntities.length
  }, [streamingEntities, columnCount, isStreamingComplete, rows])

  // 当流完成时，将所有 SYNCING 单元格标记为 DONE
  useEffect(() => {
    if (isStreamingComplete) {
      setRows((prevRows) =>
        prevRows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) =>
            cell.status === CellStatus.SYNCING
              ? { ...cell, status: CellStatus.DONE }
              : cell
          ),
        }))
      )
    }
  }, [isStreamingComplete])

  return {
    rows,
    columnCount,
    isStreaming: !isStreamingComplete,
    lastProcessedIndex: lastProcessedIndexRef.current,
    conflictCellIds,
  }
}
