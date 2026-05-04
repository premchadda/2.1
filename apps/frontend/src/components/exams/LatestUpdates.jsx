import { Bell, Calendar, ArrowRight } from 'lucide-react'

export default function LatestUpdates({ updates = [] }) {
  // Demo updates if none provided
  const demoUpdates = [
    { _id: '1', title: 'Notification Released', description: 'SSC CGL 2026 notification expected to release in March 2026', date: '2026-02-15', type: 'notification' },
    { _id: '2', title: 'Exam Date Announced', description: 'Exam dates have been officially announced for upcoming cycle', date: '2026-02-10', type: 'date' },
    { _id: '3', title: 'Syllabus Changed', description: 'New syllabus has been released with updated topics', date: '2026-01-28', type: 'syllabus' },
    { _id: '4', title: 'Vacancies Increased', description: 'Number of vacancies increased from 7000 to 8000', date: '2026-01-20', type: 'vacancy' }
  ]

  const displayUpdates = updates.length > 0 ? updates : demoUpdates

  const getTypeColor = (type) => {
    switch (type) {
      case 'notification': return 'bg-blue-100 text-blue-700'
      case 'date': return 'bg-green-100 text-green-700'
      case 'syllabus': return 'bg-purple-100 text-purple-700'
      case 'vacancy': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Bell className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Latest Updates</h3>
          <p className="text-sm text-gray-500">Stay informed about the exam</p>
        </div>
      </div>

      <div className="space-y-4">
        {displayUpdates.map((update) => (
          <div key={update._id} className="flex gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="flex-shrink-0">
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getTypeColor(update.type)}`}>
                {update.type}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 mb-1">{update.title}</h4>
              <p className="text-sm text-gray-600 line-clamp-2">{update.description}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(update.date)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <a href="#updates" className="flex items-center justify-center gap-2 mt-6 text-indigo-600 hover:text-indigo-700 font-medium">
        View All Updates <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  )
}
