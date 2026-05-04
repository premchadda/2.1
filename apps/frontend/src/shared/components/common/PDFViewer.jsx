import { useState } from 'react'
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight, RotateCw, Maximize2 } from 'lucide-react'

export default function PDFViewer({ isOpen, onClose, pdfData }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)

  if (!isOpen) return null

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleDownload = () => {
    if (pdfData?.url) {
      const link = document.createElement('a')
      link.href = pdfData.url
      link.download = pdfData.fileName || 'document.pdf'
      link.click()
    }
  }

  const nextPage = () => {
    if (currentPage < (pdfData?.totalPages || 1)) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <div>
              <h3 className="text-white font-semibold">{pdfData?.title}</h3>
              <p className="text-gray-400 text-sm">{pdfData?.description || 'PDF Document'}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Zoom Out */}
            <button
              onClick={handleZoomOut}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5 text-white" />
            </button>

            {/* Zoom Level Display */}
            <span className="text-white text-sm min-w-[3rem] text-center">{zoom}%</span>

            {/* Zoom In */}
            <button
              onClick={handleZoomIn}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5 text-white" />
            </button>

            {/* Rotate */}
            <button
              onClick={handleRotate}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Rotate"
            >
              <RotateCw className="w-5 h-5 text-white" />
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5 text-white" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => {/* Implement fullscreen */}}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-hidden bg-gray-800 sm:p-4">
        <div className="w-full max-w-7xl mx-auto h-full">
          {pdfData?.url ? (() => {
            // Convert Google Drive share links to embeddable preview URLs
            const driveMatch = pdfData.url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
            const isGoogleDrive = !!driveMatch
            const embedUrl = isGoogleDrive
              ? `https://drive.google.com/file/d/${driveMatch[1]}/preview`
              : pdfData.url

            return (
              <div>
                <div
                  className="w-full bg-white shadow-2xl mx-auto transition-all overflow-hidden"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: 'center center'
                  }}
                >
                  {isGoogleDrive ? (
                    // Google Drive — must use iframe with their /preview endpoint
                    <iframe
                      src={embedUrl}
                      className="w-full h-[85vh] border-0"
                      width="100%"
                      height="100%"
                      title={pdfData.title}
                      allow="fullscreen"
                    />
                  ) : (
                    // Local/direct URL — use <embed> which the browser handles natively
                    // and doesn't suffer from X-Frame-Options cross-origin blocking
                    <embed
                      src={`${embedUrl}#page=${currentPage}&toolbar=1&navpanes=0&view=FitH`}
                      type="application/pdf"
                      className="w-full h-full border-0"
                      width="100%"
                      height="100%"
                      style={{ height: '85vh', width: '100%' }}
                      title={pdfData.title}
                    />
                  )}
                </div>

                {/* Fallback & download row */}
                <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
                  <a
                    href={pdfData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in new tab
                  </a>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                  <p className="text-gray-500 text-xs w-full text-center">If the PDF doesn't display, use the buttons above.</p>
                </div>
              </div>
            )
          })() : (
            <div className="flex flex-col items-center justify-center h-full text-white py-20">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg">No PDF file loaded</p>
            </div>
          )}
        </div>
      </div>



      {/* Footer - Page Navigation */}
      <div className="bg-gray-900 border-t border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-white text-sm">Page</span>
            <input
              type="number"
              min="1"
              max={pdfData?.totalPages || 1}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value)
                if (page >= 1 && page <= (pdfData?.totalPages || 1)) {
                  setCurrentPage(page)
                }
              }}
              className="w-16 px-2 py-1 bg-gray-800 text-white text-center rounded border border-gray-700 focus:border-brand-start focus:outline-none"
            />
            <span className="text-gray-400 text-sm">of {pdfData?.totalPages || 1}</span>
          </div>

          <button
            onClick={nextPage}
            disabled={currentPage >= (pdfData?.totalPages || 1)}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
