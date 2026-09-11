import { Bell, Calendar, ArrowRight } from "lucide-react";

export default function LatestUpdates({ updates = [] }) {
  const getTypeColor = (type) => {
    switch (type) {
      case "notification":
        return "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300";
      case "date":
        return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
      case "syllabus":
        return "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300";
      case "vacancy":
        return "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300";
      default:
        return "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200";
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
          <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Latest Updates
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Stay informed about the exam
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {updates.length > 0 ? (
          updates.map((update) => (
            <div
              key={update._id || update.id}
              className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex-shrink-0">
                <span
                  className={`inline-block px-2 py-1 text-xs font-medium rounded ${getTypeColor(update.type)}`}
                >
                  {update.type}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                  {update.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {update.description}
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {formatDate(
                      update.date || update.updateDate || update.createdAt,
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            No exam updates are available.
          </p>
        )}
      </div>

      <a
        href="#updates"
        className="flex items-center justify-center gap-2 mt-6 text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
      >
        View All Updates <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}
