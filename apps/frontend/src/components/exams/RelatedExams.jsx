import { ArrowRight, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function RelatedExams({ exams, currentExamId }) {
  const relatedExams = exams?.filter(exam => exam._id !== currentExamId).slice(0, 5) || []

  if (relatedExams.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-indigo-600" />
        Related Exams
      </h3>

      <div className="space-y-3">
        {relatedExams.map((exam) => (
          <Link
            key={exam._id}
            to={`/exam/${exam.slug || exam._id}`}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">{exam.icon || '📋'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                {exam.title || exam.name}
              </h4>
              {exam.category && (
                <p className="text-xs text-gray-500">{exam.category}</p>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
          </Link>
        ))}
      </div>

      {exams?.length > 5 && (
        <Link
          to="/exams"
          className="block text-center mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          View All Exams
        </Link>
      )}
    </div>
  )
}
