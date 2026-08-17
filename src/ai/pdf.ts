import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MAX_PAGES = 20

/**
 * Extracts the text layer of a PDF. Scanned/image-only PDFs have no text
 * layer and will come back empty — there's no OCR step here.
 */
export async function extractPdfText(data: ArrayBuffer, maxChars = 6000): Promise<string> {
  const loadingTask = getDocument({ data })
  try {
    const doc = await loadingTask.promise
    const parts: string[] = []
    let length = 0

    const pageCount = Math.min(doc.numPages, MAX_PAGES)
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
      parts.push(text)
      length += text.length
      if (length >= maxChars) break
    }

    return parts.join('\n').slice(0, maxChars).trim()
  } finally {
    await loadingTask.destroy()
  }
}
