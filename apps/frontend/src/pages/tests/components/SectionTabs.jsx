import PropTypes from "prop-types";

export default function SectionTabs({
  sections = [],
  currentSection,
  changeSection,
  getSectionTimeRemaining,
  getSectionTimeColor,
  formatSectionTime,
}) {
  if (!sections || sections.length === 0) return null;

  return (
    <div className="sticky -top-3 md:top-0 z-20 md:static mb-3 mx-[-12px] md:mx-0 md:pt-0 bg-gray-50 dark:bg-gray-900 md:bg-transparent">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b md:border border-gray-200 dark:border-gray-700 md:rounded-xl shadow-sm w-full overflow-hidden">
        <div className="flex items-center gap-0 overflow-x-auto no-scrollbar px-2 md:px-3 py-1.5 md:py-2">
          {/* Section Pills */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0 hidden sm:inline ml-1">
              Section
            </span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 hidden sm:inline mr-1" />
            {sections.map((section) => {
              const isActive = currentSection === section;
              const sectionRemaining = getSectionTimeRemaining(section);
              const isExpired =
                sectionRemaining !== null && sectionRemaining <= 0;
              return (
                <button
                  key={section}
                  onClick={() => !isExpired && changeSection(section)}
                  disabled={isExpired}
                  title={isExpired ? `${section} (Expired)` : section}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isExpired
                      ? "bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-900/50 text-red-400 dark:text-red-600 cursor-not-allowed opacity-60"
                      : isActive
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/50"
                        : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300"
                  }`}
                >
                  <span
                    className="text-xs font-bold leading-none truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[220px]"
                    title={section}
                  >
                    {section}
                  </span>
                  {sectionRemaining !== null && (
                    <span
                      className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                        isExpired
                          ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                          : isActive
                            ? "bg-white/20 text-white"
                            : getSectionTimeColor(sectionRemaining)
                      }`}
                    >
                      {isExpired
                        ? "Expired"
                        : formatSectionTime(sectionRemaining)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

SectionTabs.propTypes = {
  sections: PropTypes.arrayOf(PropTypes.string),
  currentSection: PropTypes.string,
  changeSection: PropTypes.func.isRequired,
  getSectionTimeRemaining: PropTypes.func.isRequired,
  getSectionTimeColor: PropTypes.func.isRequired,
  formatSectionTime: PropTypes.func.isRequired,
};
