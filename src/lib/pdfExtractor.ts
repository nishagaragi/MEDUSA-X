/**
 * TRUST-MED AI — PDF Text Extractor
 * Uses PDF.js to extract real text from uploaded PDFs, page by page.
 * For TXT/plain text files, reads directly via FileReader.
 * No text is fabricated — if extraction fails the error is surfaced.
 */

export interface ExtractedPage {
  pageNumber: number
  text: string
}

export interface ExtractionResult {
  pages: ExtractedPage[]
  fullText: string
  pageCount: number
  method: 'pdfjs' | 'text' | 'failed'
  error?: string
}

/**
 * Extract text from a File object.
 * Supports PDF, TXT, and plain text DOCX (falls back to raw text for DOCX).
 */
export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  if (file.type === 'application/pdf') {
    return extractFromPDF(file)
  }
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    return extractFromText(file)
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    // DOCX: read as text — works for simple DOCX files
    return extractFromText(file)
  }
  // For images (PNG/JPG) we cannot extract text client-side without OCR
  return {
    pages: [{ pageNumber: 1, text: `[Image file: ${file.name} — text extraction requires OCR which is not configured]` }],
    fullText: `[Image file: ${file.name} — OCR not configured]`,
    pageCount: 1,
    method: 'failed',
    error: 'Image OCR not available. AI analysis will be skipped for this file.',
  }
}

async function extractFromPDF(file: File): Promise<ExtractionResult> {
  try {
    // Dynamic import to avoid bundling the full PDF.js at startup
    const pdfjs = await import('pdfjs-dist')

    // Set the worker source — use the bundled worker
    const pdfjsVersion = pdfjs.version
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`

    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise

    const pages: ExtractedPage[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => {
          if ('str' in item) return item.str
          return ''
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      pages.push({ pageNumber: pageNum, text: pageText })
    }

    const fullText = pages.map(p => p.text).join('\n\n')

    return {
      pages,
      fullText,
      pageCount: pdf.numPages,
      method: 'pdfjs',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF extraction failed'
    return {
      pages: [],
      fullText: '',
      pageCount: 0,
      method: 'failed',
      error: `PDF extraction error: ${message}`,
    }
  }
}

async function extractFromText(file: File): Promise<ExtractionResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? ''
      // Split into rough "pages" of ~3000 characters for compatibility
      const pageSize = 3000
      const pages: ExtractedPage[] = []
      for (let i = 0; i < Math.max(1, Math.ceil(text.length / pageSize)); i++) {
        pages.push({
          pageNumber: i + 1,
          text: text.slice(i * pageSize, (i + 1) * pageSize),
        })
      }
      resolve({
        pages,
        fullText: text,
        pageCount: pages.length,
        method: 'text',
      })
    }
    reader.onerror = () => {
      resolve({
        pages: [],
        fullText: '',
        pageCount: 0,
        method: 'failed',
        error: 'Failed to read file',
      })
    }
    reader.readAsText(file)
  })
}
