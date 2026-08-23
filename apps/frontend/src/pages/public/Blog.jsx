import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  User,
  ArrowRight,
  Tag,
  Loader2,
  BookOpen,
  Clock,
  ChevronRight,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "../../shared/lib/api";
import { AnimatedHero, Breadcrumb } from "../../shared/components";
import SearchBox from "../../shared/components/common/SearchBox";
import { getPublicStats } from "../../shared/lib/dataService";
import { useEffect } from "react";

export default function Blog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [learnerCount, setLearnerCount] = useState("50,000+");

  useEffect(() => {
    const controller = new AbortController();
    const fetchStats = async () => {
      try {
        const stats = await getPublicStats();
        if (controller.signal.aborted) return;
        if (stats && stats.activeLearners) {
          // Convert e.g. "5L+" to "5,00,000+"
          setLearnerCount(
            String(stats.activeLearners)
              .replace("L+", ",00,000+")
              .replace("k+", ",000+"),
          );
        }
      } catch (error) {
        if (error.name !== "AbortError")
          console.error("Failed to fetch stats:", error);
      }
    };
    fetchStats();
    return () => controller.abort();
  }, []);

  // CATEGORIES DEFINITION (Could also be fetched, but usually stable)
  const categories = [
    { id: "all", label: "All Intelligence", icon: "🌐" },
    { id: "exam-updates", label: "Exam Updates", icon: "📢" },
    { id: "study-tips", label: "Study Tips", icon: "💡" },
    { id: "strategy", label: "Strategy", icon: "🎯" },
    { id: "news", label: "Tech News", icon: "🚀" },
  ];

  // REAL BLOG FETCHING - NO HARDCODED FALLBACK
  const {
    data: blogs = [],
    isLoading,
    isError,
    _error,
  } = useQuery({
    queryKey: ["blogs", selectedCategory],
    queryFn: async () => {
      try {
        const categoryLabel =
          selectedCategory === "all"
            ? "all"
            : categories.find((c) => c.id === selectedCategory)?.label ||
              selectedCategory;
        const response = await api.get(
          `/api/blogs?category=${encodeURIComponent(categoryLabel)}&limit=50`,
        );
        if (response.data?.success) {
          const data = response.data.data || [];
          // Transform to standard format
          return data.map((post) => ({
            _id: post._id || post.id,
            title: post.title,
            description:
              post.description ||
              post.excerpt ||
              post.content?.substring(0, 200),
            category:
              post.category?.toLowerCase().replace(" ", "-") || "strategy",
            author: post.author || "Trstprep Team",
            date: post.publishedAt || post.createdAt || post.date,
            imageUrl:
              post.featuredImage ||
              post.thumbnail ||
              post.image ||
              post.coverImage,
            readTime:
              post.readTime ||
              `${Math.ceil((post.content?.length || 500) / 1000)} min read`,
            tags: post.tags || [],
          }));
        }
        return [];
      } catch (err) {
        console.error("Blog API error:", err.message);
        throw err; // Let the UI handle the error state
      }
    },
    staleTime: 1000 * 60 * 15, // 15 mins
    retry: 2,
  });

  const filteredBlogs = useMemo(() => {
    return blogs.filter((blog) => {
      const matchSearch =
        !searchQuery ||
        (blog.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (blog.description || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [blogs, searchQuery]);

  const featuredPost = useMemo(() => filteredBlogs[0], [filteredBlogs]);
  const regularPosts = useMemo(() => filteredBlogs.slice(1), [filteredBlogs]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900">
      {/* Header & Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "Intelligence Hub" },
            ]}
          />
        </div>
      </div>

      <AnimatedHero
        pageType="blog"
        title="Prep Intelligence Hub"
        subtitle="Data-driven strategies, official updates, and expert insights to accelerate your preparation."
        compact={true}
      />

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Search & Categories Bar */}
        <div className="flex flex-col lg:flex-row gap-6 mb-16 items-center">
          <SearchBox
            placeholder="Search for strategies, updates or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            containerClass="flex-1 w-full"
            inputClass="shadow-sm border border-gray-100 dark:border-gray-700 rounded-[2rem] text-sm md:text-base py-3"
            iconColorClass="group-focus-within:text-brand-start"
          />

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full lg:w-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-105"
                    : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700 shadow-sm"
                }`}
              >
                <span>{cat.icon}</span>
                {cat.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin" />
            <p className="text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest text-[10px]">
              Syncing Knowledge Base...
            </p>
          </div>
        ) : isError ? (
          <div className="py-24 text-center bg-white dark:bg-gray-800 rounded-[3rem] border border-red-100 dark:border-red-800/60 shadow-inner">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
              Couldn't Load Articles
            </h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium max-w-sm mx-auto mb-8">
              Something went wrong while fetching blog posts. Please try again.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
              >
                TRY AGAIN
              </button>
              <a
                href="/"
                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-8 py-3 rounded-2xl font-black text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              >
                GO HOME
              </a>
            </div>
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Admin: Add blog posts in{" "}
              <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                /admin/study-materials
              </code>
            </p>
          </div>
        ) : blogs.length === 0 ? (
          <div className="py-24 text-center bg-white dark:bg-gray-800 rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-700 shadow-inner">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-indigo-200 dark:text-indigo-300" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
              No Articles Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium max-w-sm mx-auto mb-8">
              {searchQuery || selectedCategory !== "all"
                ? "We couldn't find any articles matching your search or selected category."
                : "No blog posts have been published yet. Check back soon!"}
            </p>
            <button
              onClick={() => {
                setSelectedCategory("all");
                setSearchQuery("");
              }}
              className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
            >
              RESET FILTERS
            </button>
          </div>
        ) : (
          <div className="space-y-20">
            {/* Featured Post */}
            {!searchQuery && selectedCategory === "all" && featuredPost && (
              <section className="animate-fade-in">
                <Link
                  to={`/blog/${featuredPost._id}`}
                  className="group relative block rounded-[3rem] overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-all duration-500"
                >
                  <div className="flex flex-col lg:flex-row">
                    <div className="lg:w-1/2 h-64 lg:h-[500px] overflow-hidden relative">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={featuredPost.imageUrl}
                        alt={featuredPost.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      <div className="absolute top-8 left-8">
                        <span className="px-4 py-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 shadow-lg flex items-center gap-2">
                          <Sparkles className="w-3 h-3" /> FEATURED STORY
                        </span>
                      </div>
                    </div>
                    <div className="lg:w-1/2 p-8 md:p-4 sm:p-6 flex flex-col justify-center">
                      <div className="flex items-center gap-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">
                        <span className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />{" "}
                          {new Date(featuredPost.date).toLocaleDateString(
                            "en-IN",
                            { month: "long", day: "numeric", year: "numeric" },
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />{" "}
                          {featuredPost.readTime}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl lg:text-3xl md:text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-6 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {featuredPost.title}
                      </h2>
                      <p className="text-gray-500 dark:text-gray-400 text-lg font-medium leading-relaxed mb-10 line-clamp-3">
                        {featuredPost.description}
                      </p>
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs">
                            {featuredPost.author?.charAt(0)}
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {featuredPost.author}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs group-hover:gap-4 transition-all">
                          READ ARTICLE <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </section>
            )}

            {/* Regular Posts Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {(searchQuery || selectedCategory !== "all"
                ? filteredBlogs
                : regularPosts
              ).map((blog, idx) => (
                <Link
                  key={blog._id}
                  to={`/blog/${blog._id}`}
                  className="group bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 overflow-hidden hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="h-56 relative overflow-hidden">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={blog.imageUrl}
                      alt={blog.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-4 right-4 group-hover:scale-110 transition-transform">
                      <div className="w-10 h-10 rounded-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-md flex items-center justify-center shadow-lg text-indigo-600 dark:text-indigo-400">
                        <ArrowRight className="w-5 h-5 -rotate-45" />
                      </div>
                    </div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100/50 dark:border-indigo-800/50">
                        {categories.find((c) => c.id === blog.category)
                          ?.label || "Intelligence"}
                      </span>
                      <span className="text-[10px] font-black text-gray-300 dark:text-gray-500 uppercase tracking-tighter">
                        {blog.readTime}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {blog.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium line-clamp-2 leading-relaxed mb-6">
                      {blog.description}
                    </p>
                    <div className="mt-auto pt-6 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-300 dark:text-gray-500" />
                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                          {blog.author}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Tag className="w-3 h-3 text-indigo-400" />
                        {blog.tags?.slice(0, 1).map((tag, i) => (
                          <span
                            key={i}
                            className="text-[9px] font-bold text-indigo-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </section>
          </div>
        )}

        {/* Intelligence Newsletter */}
        <section className="mt-32 relative overflow-hidden bg-gray-900 rounded-[2rem] sm:rounded-[4rem] p-6 sm:p-4 sm:p-6 p-4 sm:p-6 md:p-8 text-center text-white">
          <div className="absolute top-0 right-0 w-full max-w-[400px] sm:w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-full max-w-[400px] sm:w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] -ml-48 -mb-48" />

          <div className="relative z-10 max-w-[95vw] sm:max-w-2xl mx-auto">
            <span className="inline-block px-4 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-6">
              Weekly intelligence Bulletin
            </span>
            <h2 className="text-xl sm:text-2xl lg:text-3xl md:text-3xl sm:text-4xl lg:text-5xl font-black mb-6 leading-tight">
              Get the edge others are <br className="hidden md:block" /> missing
              out on.
            </h2>
            <p className="text-gray-400 dark:text-gray-500 text-lg font-medium mb-12">
              Join {learnerCount} aspirants receiving curated exam strategies
              and notification alerts every Monday morning.
            </p>

            <form className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto bg-white/5 p-2 rounded-[2rem] border border-white/10 group focus-within:border-white/20 transition-all">
              <input
                type="email"
                placeholder="Intelligence@your-domain.com"
                className="flex-1 px-8 py-4 bg-transparent border-none focus:ring-0 text-sm font-bold text-white placeholder-gray-500"
              />
              <button
                type="submit"
                className="px-10 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-black rounded-[1.5rem] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-xl shadow-white/5 text-xs uppercase"
              >
                Join the Grid
              </button>
            </form>
            <p className="mt-8 text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">
              No spam. Only high-signal intelligence.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
