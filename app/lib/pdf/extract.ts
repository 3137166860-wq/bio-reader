/**
 * Extracts text from a PDF file with Smart Density Truncation.
 *
 * Strategy:
 * 1. Extract all text from the PDF
 * 2. Apply "Smart Density Truncation" — strip trailing sections like
 *    References, Acknowledgements, Figure Legends, and Supplementary
 *    that carry low entity-density for bio-med NER.
 * 3. Truncate to maxChars if still over limit.
 *
 * @param file The PDF File object
 * @param maxChars Maximum characters to retain (default 10000)
 * @returns Extracted and cleaned text
 */
export async function extractTextFromPDF(
  file: File,
  maxChars: number = 10000
): Promise<string> {
  // Dynamically import pdfjs-dist only when needed
  const pdfjs = await import('pdfjs-dist')
  // Configure worker
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: unknown) => (item as { str: string }).str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    fullText += pageText + '\n'
  }

  // ── Smart Density Truncation ──────────────────────────
  // Strip low-density trailing sections commonly found in
  // bio-med papers (case-insensitive).
  const lowDensityHeaders = [
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

  let strippedText = fullText
  for (const pattern of lowDensityHeaders) {
    const match = strippedText.match(pattern)
    if (match && match.index !== undefined) {
      // Keep everything before the low-density header
      strippedText = strippedText.substring(0, match.index).trim()
      break // Only strip the first occurrence
    }
  }

  // Fall back to original if stripping removed everything
  const cleanedText = strippedText.length > 200 ? strippedText : fullText

  // ── Final length limit ────────────────────────────────
  if (cleanedText.length > maxChars) {
    return cleanedText.substring(0, maxChars).trim()
  }

  return cleanedText.trim()
}

/**
 * Normalize whitespace for highlighting comparison.
 * Collapses multiple spaces, newlines, and tabs into a single space.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
