import { BookOpen, Users, Target, FileText } from "lucide-react";

export default function StaticContent({ exam, yearlyData }) {
  const sections = [
    {
      id: "overview",
      title: "Exam Overview",
      icon: BookOpen,
      content:
        exam?.description || yearlyData?.overview || "No overview available.",
    },
    {
      id: "eligibility",
      title: "Eligibility Criteria",
      icon: Users,
      content: yearlyData?.eligibility ? (
        <div className="space-y-3">
          {yearlyData.eligibility.education && (
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">
                Education:
              </span>
              <p className="text-gray-600 dark:text-gray-300">
                {yearlyData.eligibility.education}
              </p>
            </div>
          )}
          {yearlyData.eligibility.ageLimit && (
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">
                Age Limit:
              </span>
              <p className="text-gray-600 dark:text-gray-300">
                {yearlyData.eligibility.ageLimit}
              </p>
            </div>
          )}
          {yearlyData.eligibility.nationality && (
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">
                Nationality:
              </span>
              <p className="text-gray-600 dark:text-gray-300">
                {yearlyData.eligibility.nationality}
              </p>
            </div>
          )}
          {yearlyData.eligibility.experience && (
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">
                Experience:
              </span>
              <p className="text-gray-600 dark:text-gray-300">
                {yearlyData.eligibility.experience}
              </p>
            </div>
          )}
        </div>
      ) : (
        "Eligibility criteria not available."
      ),
    },
    {
      id: "pattern",
      title: "Exam Pattern",
      icon: Target,
      content: yearlyData?.examPattern?.tiers ? (
        <div className="space-y-4">
          {yearlyData.examPattern.tiers.map((tier, index) => (
            <div
              key={index}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
            >
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {tier.name || `Tier ${tier.tier}`}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                {tier.subjects && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Subjects:
                    </span>
                    <p className="font-medium">{tier.subjects.join(", ")}</p>
                  </div>
                )}
                {tier.totalMarks && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Total Marks:
                    </span>
                    <p className="font-medium">{tier.totalMarks}</p>
                  </div>
                )}
                {tier.duration && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Duration:
                    </span>
                    <p className="font-medium">{tier.duration} mins</p>
                  </div>
                )}
                {tier.negativeMarking && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Negative Marking:
                    </span>
                    <p className="font-medium">{tier.negativeMarking}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        "Exam pattern not available."
      ),
    },
    {
      id: "syllabus",
      title: "Syllabus",
      icon: FileText,
      content: yearlyData?.syllabus ? (
        <div className="space-y-4">
          {Object.entries(yearlyData.syllabus).map(([subject, topics]) => (
            <div key={subject} className="border-l-4 border-indigo-500 pl-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {subject}
              </h4>
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line">
                {topics}
              </p>
            </div>
          ))}
        </div>
      ) : (
        "Syllabus not available."
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <section.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {section.title}
            </h2>
          </div>
          <div className="prose max-w-none text-gray-600 dark:text-gray-300">
            {typeof section.content === "string" ? (
              <p className="whitespace-pre-line">{section.content}</p>
            ) : (
              section.content
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
