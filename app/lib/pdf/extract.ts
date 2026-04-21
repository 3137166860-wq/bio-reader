/**
 * Extracts text from a PDF file with truncation to prevent explosion.
 * @param file The PDF File object
 * @param maxChars Maximum characters to extract (default 10000)
 * @returns Extracted text (truncated if necessary)
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

    // Early truncation if we already exceed maxChars
    if (fullText.length > maxChars) {
      fullText = fullText.substring(0, maxChars)
      break
    }
  }

  // Final truncation (in case the last page pushed us over)
  if (fullText.length > maxChars) {
    fullText = fullText.substring(0, maxChars)
  }

  return fullText.trim()
}