import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  BookOpen,
  Clock,
  User,
  Calendar,
  Share2,
  Bookmark,
  Check,
} from "lucide-react";
import sanitizeHtml from "../../lib/sanitizeHtml";
import apiClient from "../../lib/api";
import { toast } from "react-hot-toast";

export default function ContentReader({ isOpen, onClose, contentData }) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [_bookmarkId, setBookmarkId] = useState(null);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const shareTimerRef = useRef(null);
  const bookmarkItemType = contentData?.itemType || "study-material";

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);
  // Memoize the sanitized content — DOMPurify is expensive and was previously
  // re-computed on every parent re-render even when contentData didn't change.
  const safeContent = useMemo(
    () =>
      sanitizeHtml(
        contentData?.content ||
          contentData?.body ||
          contentData?.htmlContent ||
          "",
      ),
    [contentData?.content, contentData?.body, contentData?.htmlContent],
  );

  useEffect(() => {
    if (isOpen && contentData?.id) {
      checkBookmarkStatus();
    }
  }, [isOpen, contentData?.id, bookmarkItemType]);

  const checkBookmarkStatus = async () => {
    if (!contentData?.id) return;

    try {
      const { data } = await apiClient.get(
        `/api/bookmarks/check/${bookmarkItemType}/${contentData.id}`,
      );
      setIsBookmarked(Boolean(data?.isBookmarked));
      setBookmarkId(data?.bookmarkId || null);
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error("Failed to check bookmark status:", err);
      }
    }
  };

  const handleBookmark = async () => {
    if (!contentData?.id) return;

    try {
      setBookmarkLoading(true);
      const { data } = await apiClient.post("/api/bookmarks/toggle", {
        itemId: contentData.id,
        itemType: bookmarkItemType,
        title: contentData?.title,
      });

      setIsBookmarked(Boolean(data?.isBookmarked));
      setBookmarkId(data?.bookmarkId || null);
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Please login to bookmark this content.");
      } else {
        console.error("Bookmark toggle failed:", err);
      }
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleShare = () => {
    setShareSuccess(false);
    if (navigator.share) {
      navigator
        .share({
          title: contentData?.title,
          text: contentData?.excerpt || contentData?.description,
          url: window.location.href,
        })
        .catch((err) => console.error("Share failed:", err));
    } else {
      // Fallback: copy URL to clipboard
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          setShareSuccess(true);
          shareTimerRef.current = setTimeout(
            () => setShareSuccess(false),
            3000,
          );
        })
        .catch((err) => console.error("Copy failed:", err));
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-[99999] overflow-y-auto animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${shareSuccess ? "text-green-600" : "text-gray-600"}`}
              title={shareSuccess ? "Link copied!" : "Share"}
            >
              {shareSuccess ? (
                <Check className="w-5 h-5" />
              ) : (
                <Share2 className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleBookmark}
              disabled={bookmarkLoading}
              className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${isBookmarked ? "text-brand-start" : "text-gray-600"}`}
              title={isBookmarked ? "Remove bookmark" : "Bookmark"}
            >
              {bookmarkLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-start rounded-full animate-spin" />
              ) : (
                <Bookmark className="w-5 h-5 fill-current" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Article Header */}
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Featured Image */}
          {contentData?.featuredImage && (
            <div className="w-full h-80 bg-gray-100">
              <img
                loading="lazy"
                decoding="async"
                src={contentData.featuredImage}
                alt={contentData.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-8 md:p-4 sm:p-6">
            {/* Category Badge */}
            {contentData?.category && (
              <div className="mb-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-light text-brand-start text-sm font-medium rounded-full">
                  <BookOpen className="w-3 h-3" />
                  {contentData.category}
                </span>
              </div>
            )}

            {/* Title */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl md:text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              {contentData?.title && String(contentData.title).trim() ? (
                contentData.title
              ) : (
                <span className="text-gray-400">Study Material</span>
              )}
            </h1>

            {/* Meta Information */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b border-gray-200">
              {contentData?.author && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{contentData.author}</span>
                </div>
              )}
              {contentData?.date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(contentData.date).toLocaleDateString()}</span>
                </div>
              )}
              {contentData?.readTime && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{contentData.readTime} min read</span>
                </div>
              )}
            </div>

            {/* Content Body */}
            <div
              className="prose prose-lg max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-h1:text-xl sm:text-2xl lg:text-3xl prose-h2:text-2xl prose-h3:text-xl
                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                prose-a:text-brand-start prose-a:no-underline hover:prose-a:underline
                prose-strong:text-gray-900 prose-strong:font-semibold
                prose-ul:list-disc prose-ul:ml-6 prose-ul:mb-4
                prose-ol:list-decimal prose-ol:ml-6 prose-ol:mb-4
                prose-li:text-gray-700 prose-li:mb-2
                prose-blockquote:border-l-4 prose-blockquote:border-brand-start 
                prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg
                prose-img:rounded-lg prose-img:shadow-md prose-img:my-6"
              dangerouslySetInnerHTML={{
                __html: safeContent,
              }}
            />

            {/* Tags */}
            {contentData?.tags && contentData.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {contentData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Related Content */}
            {contentData?.related && contentData.related.length > 0 && (
              <div className="mt-12 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Related Content
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contentData.related.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 rounded-lg hover:border-brand-start transition-colors cursor-pointer"
                    >
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {item.title}
                      </h4>
                      <p className="text-sm text-gray-600">{item.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>

        {/* Discussion Section */}
        {contentData?.allowComments && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Discussion</h3>
            <p className="text-gray-500 text-center py-8">
              Join the discussion
            </p>
            <div className="mt-4">
              <a
                href={`/discussions/${contentData.id}`}
                className="inline-flex items-center px-4 py-2 bg-brand-start text-white rounded-lg hover:bg-brand-end transition-colors"
              >
                View Discussion
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Footer Spacing */}
      <div className="h-20"></div>
    </div>,
    document.body,
  );
}
