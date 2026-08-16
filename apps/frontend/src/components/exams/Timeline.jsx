import { Clock, CheckCircle, Circle, AlertCircle } from 'lucide-react'

export default function Timeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-gray-500">No timeline events available.</p>
      </div>
    )
  }

  const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date))
  const now = new Date()

  const getEventStatus = (eventDate) => {
    const date = new Date(eventDate)
    if (date < now) return 'completed'
    if (date.toDateString() === now.toDateString()) return 'current'
    return 'upcoming'
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'current':
        return <AlertCircle className="w-5 h-5 text-amber-500" />
      default:
        return <Circle className="w-5 h-5 text-gray-300" />
    }
  }

  const _getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'current':
        return 'bg-amber-500'
      default:
        return 'bg-gray-300'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-indigo-600" />
        Exam Timeline
      </h3>

      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* Events */}
        <div className="space-y-6">
          {sortedEvents.map((event, index) => {
            const status = getEventStatus(event.date)
            return (
              <div key={index} className="relative flex gap-4">
                {/* Status Icon */}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  status === 'completed' ? 'bg-green-100' :
                  status === 'current' ? 'bg-amber-100' :
                  'bg-gray-100'
                }`}>
                  {getStatusIcon(status)}
                </div>

                {/* Event Content */}
                <div className="flex-1 pb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <h4 className="font-semibold text-gray-900">{event.event}</h4>
                    <span className={`text-sm font-medium ${
                      status === 'completed' ? 'text-green-600' :
                      status === 'current' ? 'text-amber-600' :
                      'text-gray-500'
                    }`}>
                      {new Date(event.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                  )}
                  {status === 'current' && (
                    <span className="inline-block mt-2 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                      Today
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
