import { useState } from 'react'
import { X, Upload } from 'lucide-react'
import { toast } from 'react-hot-toast'

// Bulk Import Modal
export const BulkImportModal = ({ isOpen, onClose, onImport, context, title = 'Bulk Import Questions', expectedColumns = 'question, option1, option2, option3, option4, correct_option, explanation, subject, difficulty' }) => {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File exceeds the maximum size of 50MB')
      return
    }

    setUploading(true)
    try {
      await onImport(file)
      setFile(null)
    } catch (err) {
      toast.error(err.message || 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload File (CSV/Excel/JSON)</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Supported formats: CSV, XLSX, XLS, JSON. Max file size: 50MB
            </p>
            <div className="mt-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Expected CSV columns:</p>
              <code className="text-xs text-gray-500 dark:text-gray-400">
                {expectedColumns}
              </code>
            </div>
            {context?.testTitle && (
              <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 p-3 rounded-lg">
                <p className="text-xs font-semibold text-indigo-800">Import target</p>
                <p className="text-sm text-indigo-900 mt-1">{context.testTitle}</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                  {context.section && context.section !== 'all' ? `Section: ${context.section}` : 'Section will use each row value, or stay blank.'}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BulkImportModal
