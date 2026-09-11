import { Calendar, Bell, FileText, ExternalLink } from "lucide-react";

export default function DynamicContent({ yearlyData, updates }) {
  const formatDate = (dateString) => {
    if (!dateString) return "TBA";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const importantDates = [
    {
      label: "Notification Date",
      date: yearlyData?.notificationDate,
      icon: Bell,
    },
    {
      label: "Application Start",
      date: yearlyData?.applicationStart,
      icon: Calendar,
    },
    {
      label: "Application End",
      date: yearlyData?.applicationEnd,
      icon: Calendar,
    },
    {
      label: "Exam Date (Start)",
      date: yearlyData?.examDateStart,
      icon: Calendar,
    },
    { label: "Exam Date (End)", date: yearlyData?.examDateEnd, icon: Calendar },
    { label: "Result Date", date: yearlyData?.resultDate, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Important Dates Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
          Important Dates
        </h3>
        <div className="space-y-3">
          {importantDates.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-300">
                  {item.label}
                </span>
              </div>
              <span
                className={`font-medium ${item.date ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}
              >
                {formatDate(item.date)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Vacancies Card */}
      {yearlyData?.vacancies > 0 && (
        <div className="bg-gradient-to-r from-green-50 dark:from-green-900/30 to-emerald-50 dark:to-emerald-900/30 rounded-xl border border-green-200 dark:border-green-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 dark:text-green-300 font-medium">
                Total Vacancies
              </p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-700 dark:text-green-300">
                {yearlyData.vacancies.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
              <span className="text-2xl">💼</span>
            </div>
          </div>
        </div>
      )}

      {/* Official Links */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Official Links
        </h3>
        <div className="space-y-3">
          {yearlyData?.officialWebsite && (
            <a
              href={yearlyData.officialWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors group"
            >
              <span className="text-gray-700 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                Official Website
              </span>
              <ExternalLink className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-300" />
            </a>
          )}
          {yearlyData?.brochureUrl && (
            <a
              href={yearlyData.brochureUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors group"
            >
              <span className="text-gray-700 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                Official Brochure
              </span>
              <ExternalLink className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-300" />
            </a>
          )}
          {!yearlyData?.officialWebsite && !yearlyData?.brochureUrl && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No official links available for this year.
            </p>
          )}
        </div>
      </div>

      {/* Recent Updates */}
      {updates && updates.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Recent Updates
          </h3>
          <div className="space-y-3">
            {updates.slice(0, 3).map((update, index) => (
              <div
                key={index}
                className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    update.isImportant ? "bg-red-500" : "bg-indigo-500"
                  }`}
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {update.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(update.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
