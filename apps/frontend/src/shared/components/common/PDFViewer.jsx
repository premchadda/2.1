import { X, Download, ExternalLink } from 'lucide-react'

function getEmbedUrl(url) {
  if (!url) return null
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
  // Convert absolute localhost URLs to relative paths so the Vite proxy serves them
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.pathname
    }
  } catch {
    // Not an absolute URL — already relative, use as-is
  }
  return url
}

export default function PDFViewer({ isOpen, onClose, pdfData }) {
  if (!isOpen) return null

  const rawUrl = pdfData?.url || null
  const src = rawUrl ? getEmbedUrl(rawUrl) : null

  const handleDownload = () => {
    if (rawUrl) {
      const link = document.createElement('a')
      link.href = src || rawUrl
      link.download = pdfData.fileName || 'document.pdf'
      link.click()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors shrink-0" aria-label="Close PDF viewer">
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">{pdfData?.title || 'PDF Document'}</h3>
            {pdfData?.description && (
              <p className="text-gray-400 text-xs truncate">{pdfData.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={src || rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </a>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors"
            aria-label="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* PDF Viewer — native browser (Edge/Chrome) PDF renderer */}
      <div className="flex-1 bg-gray-800">
        {src ? (
          <iframe
            src={src}
            className="w-full h-full border-0"
            title={pdfData?.title || 'PDF'}
            allow="fullscreen"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white/60 gap-3">
            <div className="text-5xl">📄</div>
            <p className="text-sm">No PDF file loaded</p>
          </div>
        )}
      </div>
    </div>
  )
}
