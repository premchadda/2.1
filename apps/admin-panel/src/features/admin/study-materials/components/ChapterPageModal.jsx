import React from "react";
import { createPortal } from "react-dom";
import { X, FileText, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";

export default function ChapterPageModal({
  chapterView,
  setChapterView,
  closeChapterView,
  CHAPTER_CONTENT_TABS,
  getLevelEmoji,
  getEntityId,
  navigate,
  reorderChapterResource,
  chapterActiveItems,
  chapterActiveTabConfig,
  getChapterTabCount,
  getResourceTitle,
  getResourceUrl,
  getResourceMeta,
}) {
  if (!chapterView.open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in"
      onClick={closeChapterView}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-indigo-50 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
              {chapterView.subject?.name || "Subject"}
            </p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1 flex items-center gap-2">
              <span>{getLevelEmoji("chapters")}</span>
              <span>
                {chapterView.chapter?.title ||
                  chapterView.chapter?.name ||
                  "Chapter"}
              </span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {(chapterView.topics || []).length} topics and{" "}
              {(chapterView.topics || []).reduce(
                (sum, topic) => sum + (topic.subtopics || []).length,
                0,
              )}{" "}
              subtopics
            </p>
          </div>
          <button
            onClick={closeChapterView}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300 hover:bg-white dark:bg-gray-800 border border-transparent hover:border-gray-200 dark:border-gray-700 transition"
            aria-label="Close chapter page"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4 overflow-y-auto">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
              Topics
            </h4>

            {chapterView.topics.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                No topics linked to this chapter yet.
              </div>
            ) : (
              <div className="space-y-2">
                {chapterView.topics.map((topic) => {
                  const topicId = String(getEntityId(topic));
                  const isTopicSelected =
                    chapterView.selectedTopicId === topicId;
                  const subtopics = topic.subtopics || [];

                  return (
                    <div
                      key={getEntityId(topic)}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setChapterView((prev) => ({
                            ...prev,
                            selectedTopicId: topicId,
                            selectedSubtopicId: "",
                          }))
                        }
                        className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center justify-between gap-2 ${isTopicSelected ? "bg-amber-50 text-amber-900 font-semibold" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span>{getLevelEmoji("topics")}</span>
                          <span className="truncate">
                            {topic.name || topic.title}
                          </span>
                        </span>
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                          {subtopics.length}
                        </span>
                      </button>

                      {isTopicSelected && (
                        <div className="mt-2 pl-3 border-l border-gray-200 dark:border-gray-700 space-y-1">
                          {subtopics.length === 0 ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                              No subtopics
                            </div>
                          ) : (
                            subtopics.map((subtopic) => {
                              const subtopicId = String(getEntityId(subtopic));
                              const isSubtopicSelected =
                                chapterView.selectedSubtopicId === subtopicId;
                              return (
                                <button
                                  key={getEntityId(subtopic)}
                                  type="button"
                                  onClick={() =>
                                    setChapterView((prev) => ({
                                      ...prev,
                                      selectedTopicId: topicId,
                                      selectedSubtopicId: isSubtopicSelected
                                        ? ""
                                        : subtopicId,
                                    }))
                                  }
                                  className={`w-full text-left px-2 py-1 rounded-md text-xs flex items-center gap-2 ${isSubtopicSelected ? "bg-purple-50 text-purple-900 font-semibold" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"}`}
                                >
                                  <span>{getLevelEmoji("subtopics")}</span>
                                  <span className="truncate">
                                    {subtopic.name || subtopic.title}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800">
                  Chapter:{" "}
                  {chapterView.chapter?.title ||
                    chapterView.chapter?.name ||
                    "N/A"}
                </span>
                {selectedChapterTopic && (
                  <span className="px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 text-amber-800">
                    Topic:{" "}
                    {selectedChapterTopic.name || selectedChapterTopic.title}
                  </span>
                )}
                {selectedChapterSubtopic && (
                  <span className="px-2 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-800">
                    Subtopic:{" "}
                    {selectedChapterSubtopic.name ||
                      selectedChapterSubtopic.title}
                  </span>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto">
                {CHAPTER_CONTENT_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = chapterView.activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setChapterView((prev) => ({
                          ...prev,
                          activeTab: tab.id,
                        }))
                      }
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition ${isActive ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"}`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white dark:bg-gray-800/20 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}
                      >
                        {getChapterTabCount(tab.id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/50">
              {chapterView.loading ? (
                <div className="h-full min-h-52 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : chapterActiveItems.length === 0 ? (
                <div className="h-full min-h-52 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl mb-2">
                      {getLevelEmoji("chapters")}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {chapterActiveTabConfig.emptyText}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {chapterActiveItems.map((item, index) => {
                    const tabId = chapterView.activeTab;
                    const url = getResourceUrl(item, tabId);
                    const metaTags = getResourceMeta(item, tabId);
                    const title = getResourceTitle(item, tabId);
                    const itemId =
                      getEntityId(item) ||
                      item.testId ||
                      item.test_id ||
                      `${tabId}-${index}`;
                    const createdAt = item.createdAt || item.created_at;

                    return (
                      <div
                        key={`${tabId}-${item.__type || "resource"}-${itemId}-${index}`}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex gap-4"
                      >
                        {/* Reorder Controls */}
                        {["videos", "pdfs", "tests", "notes"].includes(tabId) &&
                          item.__type !== "quiz" && (
                            <div className="flex flex-col gap-1 justify-center shrink-0 border-r border-gray-100 pr-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReorderResource("up", item, index);
                                }}
                                disabled={index === 0}
                                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 transition-colors ${index === 0 ? "text-gray-200 cursor-not-allowed" : "text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:text-indigo-400"}`}
                                title="Move Up"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReorderResource("down", item, index);
                                }}
                                disabled={
                                  index === chapterActiveItems.length - 1
                                }
                                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 transition-colors ${index === chapterActiveItems.length - 1 ? "text-gray-200 cursor-not-allowed" : "text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:text-indigo-400"}`}
                                title="Move Down"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                        <div className="flex-1 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h5 className="font-semibold text-gray-900 dark:text-white truncate">
                              {title}
                            </h5>
                            {item.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {item.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {tabId === "tests" && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full border ${item.__type === "quiz" ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 text-indigo-700 dark:text-indigo-400" : "bg-green-50 dark:bg-green-900/20 border-green-100 text-green-700 dark:text-green-400"}`}
                                >
                                  {item.__type === "quiz"
                                    ? "Quiz"
                                    : "Topic Test"}
                                </span>
                              )}
                              {metaTags.map((tag, tagIndex) => (
                                <span
                                  key={`${itemId}-tag-${tagIndex}`}
                                  className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/30"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Open
                            </a>
                          )}
                          {tabId === "tests" && (
                            <button
                              onClick={() => {
                                const tId =
                                  item.testId ||
                                  item.test_id ||
                                  getEntityId(item);
                                if (item.__type === "quiz") {
                                  navigate(`/admin/practice?testId=${tId}`);
                                } else {
                                  navigate(`/admin/tests?testId=${tId}`);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/30"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Manage Test
                            </button>
                          )}
                        </div>

                        {createdAt && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                            Added: {new Date(createdAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
