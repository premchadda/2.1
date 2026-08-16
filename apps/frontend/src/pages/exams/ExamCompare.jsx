import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Scale, Calendar, Users, Clock, FileText, Check } from 'lucide-react';
import api from '../../shared/lib/dataService'

export default function ExamCompare() {
  const { examId } = useParams()
  const [examData, setExamData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedYears, _setSelectedYears] = useState(['2026', '2025'])

  useEffect(() => {
    const controller = new AbortController()
    fetchExamData(controller.signal)
    return () => controller.abort()
  }, [examId])

  const fetchExamData = async (signal) => {
    try {
      setLoading(true)
      const response = await api.get(`/api/exams/${examId}/compare?years=${selectedYears.join(',')}`, { signal })
      if (signal?.aborted) return
      if (response.data?.success) {
        setExamData(response.data.data)
      } else {
        setExamData(getSampleData())
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch exam compare data:', error)
        setExamData(getSampleData())
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const getSampleData = () => ({
    examName: examId.replace(/-/g, ' ').toUpperCase(),
    years: [
      {
        year: '2026',
        notification: 'June 2025',
        applicationStart: '2025-07-01',
        applicationEnd: '2025-07-25',
        examDate: '2025-09-15',
        vacancy: 9374,
        eligibility: 'Bachelor\'s degree',
        ageLimit: '18-32 years',
        papers: 2,
        totalMarks: 400
      },
      {
        year: '2025',
        notification: 'June 2024',
        applicationStart: '2024-07-01',
        applicationEnd: '2024-07-25',
        examDate: '2024-09-15',
        vacancy: 8500,
        eligibility: 'Bachelor\'s degree',
        ageLimit: '18-32 years',
        papers: 2,
        totalMarks: 400
      },
      {
        year: '2024',
        notification: 'June 2023',
        applicationStart: '2023-07-01',
        applicationEnd: '2023-07-25',
        examDate: '2023-09-15',
        vacancy: 7500,
        eligibility: 'Bachelor\'s degree',
        ageLimit: '18-32 years',
        papers: 2,
        totalMarks: 400
      }
    ],
    comparisonFields: [
      { label: 'Notification Date', key: 'notification' },
      { label: 'Application Start', key: 'applicationStart', isDate: true },
      { label: 'Application End', key: 'applicationEnd', isDate: true },
      { label: 'Exam Date', key: 'examDate', isDate: true },
      { label: 'Total Vacancy', key: 'vacancy', isNumber: true },
      { label: 'Eligibility', key: 'eligibility' },
      { label: 'Age Limit', key: 'ageLimit' },
      { label: 'Number of Papers', key: 'papers', isNumber: true },
      { label: 'Total Marks', key: 'totalMarks', isNumber: true }
    ]
  })

  const getValue = (yearData, field) => {
    if (!yearData) return '-'
    const value = yearData[field.key]
    if (!value) return '-'
    if (field.isDate) {
      return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    }
    if (field.isNumber) {
      return value.toLocaleString()
    }
    return value
  }

  const getChangeIndicator = (current, previous) => {
    if (!current || !previous) return null
    if (current === previous) return null
    const isIncrease = parseInt(current) > parseInt(previous)
    return {
      type: isIncrease ? 'increase' : 'decrease',
      text: isIncrease ? '↑' : '↓'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link to="/exams" className="hover:text-brand-start">Exams</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to={`/exam/${examId}`} className="hover:text-brand-start capitalize">{examId.replace(/-/g, ' ')}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 dark:text-white font-medium">Compare</span>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-brand-start to-brand-end rounded-2xl p-8 text-white mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Scale className="w-8 h-8" />
            <Users className="w-6 h-6" />
            <h1 className="text-3xl md:text-4xl font-bold capitalize">
              {examId.replace(/-/g, ' ')} - Year Comparison
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <Clock className="w-4 h-4" />
            <p className="text-white/90 text-lg">
              Compare exam details across different years
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-8"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        ) : (
          /* Comparison Table */
          <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Parameter
                    </th>
                    {examData?.years?.map(year => (
                      <th key={year.year} className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                        <div className="flex flex-col items-center">
                          <Calendar className="w-6 h-6 text-indigo-500 mb-1" />
                          <span className="text-2xl font-bold">{year.year}</span>
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">Year</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {examData?.comparisonFields?.map((field, idx) => (
                    <tr key={field.key} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/50'}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {field.key === 'eligibility' ? <Check className="w-4 h-4 text-green-500" /> : null}
                          {field.key === 'ageLimit' ? <Clock className="w-4 h-4 text-blue-500" /> : null}
                          {field.label}
                        </div>
                      </td>
                      {examData?.years?.map((year, yearIdx) => {
                        const currentValue = getValue(year, field)
                        const previousValue = yearIdx < examData.years.length - 1 
                          ? getValue(examData.years[yearIdx + 1], field) 
                          : null
                        const change = getChangeIndicator(currentValue, previousValue)
                        
                        return (
                          <td key={year.year} className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                {currentValue}
                              </span>
                              {change && (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  change.type === 'increase' 
                                    ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                                    : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
                                }`}>
                                  {change.text}
                                </span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8">
          <Link
            to={`/exam/${examId}`}
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-brand-start transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {examId.replace(/-/g, ' ')}
          </Link>
        </div>
      </div>
    </div>
  )
}
