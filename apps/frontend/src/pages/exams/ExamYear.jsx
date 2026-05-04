import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, Clock, Users, FileText, Download, ChevronRight, ArrowLeft, BookOpen } from 'lucide-react'
import api from '../../shared/lib/dataService'

export default function ExamYear() {
  const { examId, year } = useParams()
  const [examData, setExamData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchExamYearData()
  }, [examId, year])

  const fetchExamYearData = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/exams/${examId}/year?year=${year}`)
      if (response.data?.success) {
        setExamData(response.data.data)
      } else {
        setExamData(getSampleExamData())
      }
    } catch (error) {
      console.error('Failed to fetch exam year data:', error)
      setExamData(getSampleExamData())
    } finally {
      setLoading(false)
    }
  }

  const getSampleExamData = () => ({
    examId,
    year: parseInt(year),
    notification: 'June 2025',
    applicationStart: '2025-07-01',
    applicationEnd: '2025-07-25',
    tier1ExamDate: '2025-09-15',
    tier2ExamDate: '2025-12-01',
    vacancy: 9374,
    description: `Complete information about ${examId} ${year} examination including important dates, syllabus, and preparation strategy.`,
    eligibility: 'Bachelor\'s degree in any discipline',
    ageLimit: '18-32 years',
    patternChanges: 'No major changes from previous year',
    syllabusChanges: 'Some topics added to General Awareness section',
    previousYearPapers: [
      { id: 1, title: `${year} Shift 1`, date: `${year}-12-01`, questions: 100 },
      { id: 2, title: `${year} Shift 2`, date: `${year}-12-02`, questions: 100 },
      { id: 3, title: `${year} Shift 3`, date: `${year}-12-03`, questions: 100 },
    ],
    importantTopics: [
      'Quantitative Aptitude',
      'English Comprehension',
      'General Intelligence & Reasoning',
      'General Awareness'
    ],
    preparationStrategy: [
      'Start with basics and fundamentals',
      'Practice previous year questions',
      'Take regular mock tests',
      'Focus on time management',
      'Revise regularly'
    ]
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 w-1/3 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 w-1/2 rounded mb-8"></div>
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
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
          <span className="text-gray-900 dark:text-white font-medium">{year}</span>
        </div>

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 rounded-3xl p-8 md:p-12 text-white mb-8 shadow-xl">
          <div className="absolute inset-0 pointer-events-none">
             <div className="absolute -top-32 -right-32 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl mix-blend-screen opacity-50"></div>
             <div className="absolute top-32 -left-16 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl mix-blend-screen opacity-40"></div>
             <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="animate-slide-in-right">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-sm font-semibold mb-5 shadow-sm">
                 <Calendar className="w-4 h-4 text-amber-300" />
                 Target Year {year}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4 capitalize tracking-tight leading-tight">
                {examId.replace(/-/g, ' ')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400">{year}</span>
              </h1>
              <p className="text-white/80 text-lg md:text-xl font-medium max-w-2xl leading-relaxed">
                Comprehensive guide, latest syllabus updates, and preparation resources for the {year} examination.
              </p>
            </div>
            
            <div className="flex items-center gap-4 animate-slide-in-up md:self-end">
               <div className="bg-white/10 backdrop-blur-xl border border-white/20 py-4 px-6 rounded-2xl text-center min-w-[140px] shadow-lg">
                 <div className="text-4xl font-black text-white mb-1 tracking-tight">
                   {examData?.vacancy ? (examData.vacancy > 1000 ? `${(examData.vacancy / 1000).toFixed(1)}k+` : examData.vacancy) : 'TBA'}
                 </div>
                 <div className="text-white/70 text-xs uppercase tracking-wider font-bold">Total Vacancies</div>
               </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/40 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-1">Application</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
                  {examData?.applicationStart ? new Date(examData.applicationStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'TBA'} - <br className="sm:hidden" />
                  {examData?.applicationEnd ? new Date(examData.applicationEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'TBA'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/40 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-1">Tier-1 Exam</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
                  {examData?.tier1ExamDate ? new Date(examData.tier1ExamDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/40 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-1">Total Vacancy</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
                  {examData?.vacancy?.toLocaleString() || 'TBA'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/40 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-1">Notification</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
                  {examData?.notification || 'TBA'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Overview</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">{examData?.description}</p>
            </div>

            {/* Eligibility */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Eligibility Criteria</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <span className="font-bold text-gray-900 dark:text-white min-w-[120px] pt-1">Education</span>
                  <span className="text-gray-600 dark:text-gray-300 flex-1">{examData?.eligibility}</span>
                </div>
                <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <span className="font-bold text-gray-900 dark:text-white min-w-[120px] pt-1">Age Limit</span>
                  <span className="text-gray-600 dark:text-gray-300 flex-1">{examData?.ageLimit}</span>
                </div>
              </div>
            </div>

            {/* Changes */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Changes in {year}</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-5 border border-indigo-100 dark:border-indigo-800/50">
                  <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    Pattern Changes
                  </h3>
                  <p className="text-indigo-700 dark:text-indigo-200/80">{examData?.patternChanges || 'No major changes'}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-5 border border-purple-100 dark:border-purple-800/50">
                  <h3 className="font-bold text-purple-900 dark:text-purple-300 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    Syllabus Changes
                  </h3>
                  <p className="text-purple-700 dark:text-purple-200/80">{examData?.syllabusChanges || 'No major changes'}</p>
                </div>
              </div>
            </div>

            {/* Important Topics */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 md:p-8 shadow-inner border border-blue-100 dark:border-blue-800/50">
              <h2 className="text-2xl font-bold text-blue-950 dark:text-blue-200 mb-6">Important Topics</h2>
              <div className="flex flex-wrap gap-3">
                {examData?.importantTopics?.map((topic, idx) => (
                  <span key={idx} className="px-5 py-2.5 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-bold shadow-sm border border-blue-100 dark:border-blue-800/50 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-default animate-slide-in-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            {/* Preparation Strategy */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Preparation Strategy</h2>
              <div className="space-y-4 relative before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-0.5 before:bg-indigo-100 dark:before:bg-indigo-900/50">
                {examData?.preparationStrategy?.map((strategy, idx) => (
                  <div key={idx} className="flex items-start gap-5 relative group animate-slide-in-right" style={{ animationDelay: `${idx * 0.1}s` }}>
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-700 flex flex-shrink-0 items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 z-10 group-hover:bg-indigo-600 group-hover:border-indigo-600 group-hover:text-white transition-all shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl flex-1 border border-transparent group-hover:border-indigo-100 dark:group-hover:border-indigo-800/50 transition-colors">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{strategy}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Previous Year Papers */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-start" />
                Previous Year Papers
              </h3>
              <div className="space-y-3">
                {examData?.previousYearPapers?.map(paper => (
                  <div key={paper.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{paper.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{paper.questions} Questions</p>
                    </div>
                    <button className="p-2 text-brand-start hover:bg-brand-start/10 rounded-lg">
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
              <Link
                to="/previous-year-papers"
                className="block text-center text-brand-start font-medium mt-4 hover:underline"
              >
                View All →
              </Link>
            </div>

            {/* Quick Links */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link
                  to={`/test-series/${examId}-${year}`}
                  className="block p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                >
                  <p className="font-medium text-gray-900 dark:text-white">Mock Tests</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Practice with mock tests</p>
                </Link>
                <Link
                  to={`/study?exam=${examId}`}
                  className="block p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                >
                  <p className="font-medium text-gray-900 dark:text-white">Study Materials</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Comprehensive notes</p>
                </Link>
                <Link
                  to="/current-affairs"
                  className="block p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                >
                  <p className="font-medium text-gray-900 dark:text-white">Current Affairs</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Stay updated</p>
                </Link>
              </div>
            </div>

            {/* Back to Exam */}
            <Link
              to={`/exam/${examId}`}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-brand-start transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {examId.replace(/-/g, ' ')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
