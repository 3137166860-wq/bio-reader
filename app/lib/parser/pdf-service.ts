/**
 * Modular PDF Parser Service
 *
 * Provides a standardised interface for PDF text extraction with
 * swappable backends:
 *   - pdfjs-dist (client-side, current default)
 *   - MinerU API (server-side, future)
 *
 * Standard output format:
 *   { text: string, page: number, index: number }
 *
 * Each block represents a contiguous text segment from a specific
 * page and position, enabling page-level provenance for the UI.
 */

// ── Types ──────────────────────────────────────────────

export interface PDFParseBlock {
  /** Extracted text content */
  text: string
  /** 1-based page number */
  page: number
  /** Character index within the concatenated full text */
  index: number
}

export interface PDFParseResult {
  blocks: PDFParseBlock[]
  metadata: PDFMetadata
}

export interface PDFMetadata {
  /** Total number of pages */
  pages: number
  /** Total characters across all blocks */
  totalChars: number
  /** Parser backend identifier */
  parser: string
}

// ── Abstract interface ─────────────────────────────────

export interface PDFParser {
  /** Parse a PDF File into structured text blocks */
  parse(file: File): Promise<PDFParseResult>

  /** Reconstruct full text from blocks (space-joined) */
  getFullText(blocks: PDFParseBlock[]): string

  /**
   * Smart Density Truncation.
   * Strips low-entity-density trailing sections (References,
   * Acknowledgements, Figure Legends, Supplementary, etc.).
   */
  truncate(blocks: PDFParseBlock[]): PDFParseBlock[]

  /**
   * Extract a contiguous text range for highlighting context.
   * Returns a window of blocks surrounding the given source_text.
   */
  getContextWindow(
    blocks: PDFParseBlock[],
    sourceText: string,
    windowChars?: number
  ): PDFParseBlock[]
}

// ── pdfjs-dist implementation ─────────────────────────

const LOW_DENSITY_PATTERNS: RegExp[] = [
  /(?:^|\n)\s*references\b/i,
  /(?:^|\n)\s*acknowledg(e)?ments?\b/i,
  /(?:^|\n)\s*figure\s+legends?\b/i,
  /(?:^|\n)\s*supplementary\s+(materials?|data|information|figures?|tables?)\b/i,
  /(?:^|\n)\s*conflict(s)?\s+of\s+interest\b/i,
  /(?:^|\n)\s*author\s+contributions?\b/i,
  /(?:^|\n)\s*data\s+availability\b/i,
  /(?:^|\n)\s*funding\b/i,
  /(?:^|\n)\s*ethical\s+statement\b/i,
  /(?:^|\n)\s*declaration\s+of\s+competing\s+interests?\b/i,
]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

class PDFJSParser implements PDFParser {
  async parse(file: File): Promise<PDFParseResult> {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise

    const blocks: PDFParseBlock[] = []
    let cumulativeIndex = 0

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: unknown) => (item as { str: string }).str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (pageText.length > 0) {
        blocks.push({
          text: pageText,
          page: pageNum,
          index: cumulativeIndex,
        })
        cumulativeIndex += pageText.length + 1 // +1 for the newline separator
      }
    }

    return {
      blocks,
      metadata: {
        pages: pdf.numPages,
        totalChars: cumulativeIndex,
        parser: 'pdfjs-dist',
      },
    }
  }

  getFullText(blocks: PDFParseBlock[]): string {
    return blocks.map((b) => b.text).join('\n')
  }

  truncate(blocks: PDFParseBlock[]): PDFParseBlock[] {
    const fullText = this.getFullText(blocks)

    // Find the first low-density header
    let cutIndex = fullText.length
    for (const pattern of LOW_DENSITY_PATTERNS) {
      const match = fullText.match(pattern)
      if (match && match.index !== undefined && match.index < cutIndex) {
        cutIndex = match.index
      }
    }

    if (cutIndex >= fullText.length) {
      return blocks // nothing to truncate
    }

    // Rebuild blocks up to the cut point
    const truncated: PDFParseBlock[] = []
    let runningPos = 0
    for (const block of blocks) {
      const blockEnd = runningPos + block.text.length
      if (runningPos >= cutIndex) break

      if (blockEnd <= cutIndex) {
        truncated.push(block)
      } else {
        // Partial block at the cut boundary
        const keepLen = cutIndex - runningPos
        truncated.push({
          ...block,
          text: block.text.substring(0, keepLen).trim(),
        })
      }
      runningPos = blockEnd + 1 // +1 for newline
    }

    // Fallback: if truncation removed everything, return original
    const totalChars = truncated.reduce((s, b) => s + b.text.length, 0)
    return totalChars > 200 ? truncated : blocks
  }

  getContextWindow(
    blocks: PDFParseBlock[],
    sourceText: string,
    windowChars: number = 500
  ): PDFParseBlock[] {
    const normalizedSource = normalizeWhitespace(sourceText)
    const fullText = this.getFullText(blocks)
    const normalizedFull = normalizeWhitespace(fullText)

    const matchIndex = normalizedFull.indexOf(normalizedSource)
    if (matchIndex === -1) return []

    // Walk blocks to find which block contains the match
    let runningPos = 0
    let targetBlockIdx = -1

    for (let i = 0; i < blocks.length; i++) {
      const blockEnd = runningPos + blocks[i].text.length
      // Check if match falls within this block's range
      const blockNormalizedStart = normalizeWhitespace(
        fullText.substring(runningPos, blockEnd)
      )
      const blockStartInNormalized = normalizeWhitespace(
        fullText.substring(0, runningPos)
      ).length

      const matchInBlock =
        matchIndex >= blockStartInNormalized &&
        matchIndex < blockStartInNormalized + blockNormalizedStart.length

      if (matchInBlock) {
        targetBlockIdx = i
        break
      }

      runningPos = blockEnd + 1
    }

    if (targetBlockIdx === -1) return []

    // Return a window of blocks around the match
    const start = Math.max(0, targetBlockIdx - 1)
    const end = Math.min(blocks.length, targetBlockIdx + 2)
    return blocks.slice(start, end)
  }
}

// ── Factory ────────────────────────────────────────────

/**
 * Create a PDF parser instance.
 *
 * @param type - Parser backend: 'pdfjs' (default) or 'mineru' (future)
 * @returns A PDFParser implementation
 */
export function createParser(
  type: 'pdfjs' | 'mineru' = 'pdfjs'
): PDFParser {
  switch (type) {
    case 'pdfjs':
      return new PDFJSParser()
    case 'mineru':
      throw new Error(
        'MinerU parser not yet implemented. ' +
          'Implement PDFParser interface for MinerU API integration.'
      )
  }
}

/**
 * Convenience: parse a PDF file and return the truncated full text.
 * Uses the pdfjs-dist backend by default.
 */
export async function extractTextFromPDF(
  file: File,
  maxChars: number = 10000
): Promise<string> {
  const parser = createParser('pdfjs')
  const { blocks } = await parser.parse(file)
  const truncated = parser.truncate(blocks)
  let text = parser.getFullText(truncated)

  if (text.length > maxChars) {
    text = text.substring(0, maxChars).trim()
  }

  return text.trim()
}

/**
 * Normalize whitespace for highlighting comparison.
 */
export { normalizeWhitespace }
