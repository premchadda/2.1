import { useState } from 'react'
import { Upload, X, FileJson, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Shield, Info } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '../../../../shared/lib/dataService'

const FullTestImportModal = ({ isOpen, onClose, onImported }) => {
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [showWarnings, setShowWarnings] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [result, setResult] = useState(null)
  const [strict, setStrict] = useState(false)

  if (!isOpen) return null

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null
    setFile(selected)
    setPreview(null)
    setResult(null)
  }

  const handlePreview = async () => {
    if (!file) {
      toast.error('Please select a JSON file first')
      return
    }
    setPreviewing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (strict) fd.append('strict', 'true')
      const res = await adminAPI.previewFullTest(fd)
      setPreview(res.data.data)
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a JSON file')
      return
    }
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('skipDuplicates', 'true')
      if (strict) fd.append('strict', 'true')
      const res = await adminAPI.importFullTest(fd)
      setResult(res.data.data)
      toast.success(res.data.message)
      onImported?.()
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setShowWarnings(false)
    setShowErrors(false)
    setShowDiscarded(false)
    setStrict(false)
    onClose()
  }

  const hasIssues = preview?.warnings?.length > 0 || preview?.errors?.length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
              <FileJson className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Import Full Test JSON</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Upload a structured test with sections and questions</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select JSON File</label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="full-test-file-input"
              />
              <label htmlFor="full-test-file-input" className="cursor-pointer">
                <FileJson className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                {file ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Click to select a JSON file</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Max 50 MB</p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Strict mode toggle */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={strict}
                  onChange={(e) => setStrict(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Strict mode</span>
              </label>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                When enabled, missing taxonomy slugs (exam, stage, series, subject) will NOT be auto-created. Create them first in the admin panel.
              </p>
            </div>
          </div>

          {/* Expected structure hint */}
          <details className="bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <summary className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none">
              Expected JSON structure
            </summary>
            <div className="px-4 pb-3">
              <pre className="text-[11px] text-gray-500 dark:text-gray-400 overflow-x-auto">{`{
  "id": "...", "title": "...", "slug": "...",
  "examCategoryId": "ssc", "examId": "ssc-cgl",
  "stageId": "tier-1", "testSeriesId": "SSC-CGL-...",
  "categoryId": "mock-test", "testType": "full-length",
  "duration": 60, "totalQuestions": 100,
  "totalMarks": 200, "negativeMarking": 0.5,
  "sections": [{
    "id": "...", "name": "...", "subjectId": "...",
    "questions": [{
      "id": "Q1", "question": "...", "options": [...],
      "correctAnswer": 1, "solution": "...",
      "text": {"en":"...","hn":"..."},
      "options_bilingual": {"en":[...],"hn":[...]}
    }]
  }]
}`}</pre>
            </div>
          </details>

          {/* Preview result */}
          {preview && (
            <div className={`rounded-lg p-4 ${hasIssues ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                {hasIssues ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
                <p className={`font-medium ${hasIssues ? 'text-amber-800 dark:text-amber-200' : 'text-green-800 dark:text-green-200'}`}>
                  {hasIssues ? 'Issues found' : 'Preview looks good'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white dark:bg-gray-800 rounded p-2">
                  <span className="text-xs text-gray-500">Test Title</span>
                  <p className="font-medium text-gray-900 dark:text-white text-xs truncate">{preview.testTitle}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded p-2">
                  <span className="text-xs text-gray-500">Sections</span>
                  <p className="font-medium text-gray-900 dark:text-white">{preview.sectionsFound}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded p-2">
                  <span className="text-xs text-gray-500">Questions</span>
                  <p className="font-medium text-gray-900 dark:text-white">{preview.questionsFound}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded p-2">
                  <span className="text-xs text-gray-500">Warnings</span>
                  <p className={`font-medium ${preview.warnings?.length ? 'text-amber-600' : 'text-green-600'}`}>
                    {preview.warnings?.length || 0}
                  </p>
                </div>
              </div>

              {/* Warnings expandable */}
              {preview.warnings?.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => setShowWarnings(!showWarnings)} className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 hover:underline">
                    {showWarnings ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {showWarnings ? 'Hide' : 'Show'} warnings ({preview.warnings.length})
                  </button>
                  {showWarnings && (
                    <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                      {preview.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Errors expandable */}
              {preview.errors?.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => setShowErrors(!showErrors)} className="flex items-center gap-1 text-xs text-red-700 dark:text-red-300 hover:underline">
                    {showErrors ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {showErrors ? 'Hide' : 'Show'} errors ({preview.errors.length})
                  </button>
                  {showErrors && (
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                      {preview.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-700 dark:text-red-300">
                          {e.questionId ? `[Q: ${e.questionId}] ` : ''}{e.message || e}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Discarded fields info */}
              <div className="mt-3">
                <button onClick={() => setShowDiscarded(!showDiscarded)} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:underline">
                  {showDiscarded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {showDiscarded ? 'Hide' : 'Show'} fields that will be imported
                </button>
                {showDiscarded && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
                    <p className="font-medium text-gray-700 dark:text-gray-300">Imported to DB:</p>
                    <p>Test: title, slug, description, examId, stageId, seriesId, categoryId, testType, status, difficulty, duration, totalQuestions, totalMarks, negativeMarking, isPyq, pyqYear, isPro, isLive, isComingSoon, isFeatured, passingMarks, seo, proctoring, adaptive, features, show_config, timing_config, attempt_rules, analysis_config, access_config, availability, languages, tags, instructions</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300 mt-1">Per question: questionText, questionTextHi, options, optionsHi, correctOption, explanation, explanationHi, difficulty, marks, negativeMarks, type, estimatedTime, languages, tags, sourceConfig, examCategoryIds, examIds, questionStageIds, chapterId, topicId, subtopicId, conceptIds, skillIds, aiGenerated</p>
                    <p className="font-medium text-red-600 dark:text-red-400 mt-1">Not imported (server-managed):</p>
                    <p>createdAt, updatedAt, createdBy, updatedBy, statistics, resultPublished, analysisPublished, attemptCount, proctoringEnabled (cameraMonitoring, tabSwitchLimit, copyPasteDisabled mapped to proctoring JSONB)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="font-medium text-green-800 dark:text-green-200">Import Complete</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-white dark:bg-gray-800 rounded p-2">
                  <span className="text-xs text-gray-500">Test Created</span>
                  <p className="font-medium text-gray-900 dark:text-white text-xs">{result.testTitle}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded p-2">
                  <span className="text-xs text-gray-500">Sections</span>
                  <p className="font-medium text-gray-900 dark:text-white">{result.sectionsCreated}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded p-2">
                  <span className="text-xs text-gray-500">Questions Imported</span>
                  <p className="font-medium text-green-600 dark:text-green-400">{result.questionsCreated}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded p-2">
                  <span className="text-xs text-gray-500">Skipped</span>
                  <p className="font-medium text-gray-500">{result.questionsSkipped}</p>
                </div>
              </div>
              {result.warnings?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{result.warnings.length} warnings</p>
                </div>
              )}
              {result.errors?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-red-700 dark:text-red-300">{result.errors.length} errors</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={handleClose} disabled={importing} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-sm">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <>
              <button
                type="button"
                onClick={handlePreview}
                disabled={!file || previewing || importing}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-sm"
              >
                {previewing ? 'Checking...' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!file || importing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                <Upload className="w-4 h-4" />
                {importing ? 'Importing...' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default FullTestImportModal
