import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, User, Clock, ArrowLeft, Share2, ThumbsUp, MessageCircle } from 'lucide-react'
import api from '../../shared/lib/dataService'

export default function BlogDetail() {
  const { id } = useParams()
  const [blog, setBlog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchBlog()
  }, [id])

  const fetchBlog = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/blogs/${id}`)
      if (response.data?.success) {
        setBlog(response.data.data)
      } else {
        setError('Blog post not found')
      }
    } catch (error) {
      console.error('Failed to fetch blog:', error)
      setError('Failed to load blog post')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 w-1/4 rounded mb-4"></div>
            <div className="h-12 bg-gray-200 w-3/4 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded-xl mb-4"></div>
            <div className="h-4 bg-gray-200 w-full rounded mb-2"></div>
            <div className="h-4 bg-gray-200 w-full rounded mb-2"></div>
            <div className="h-4 bg-gray-200 w-3/4 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Blog Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The blog post you are looking for does not exist.'}</p>
          <Link to="/blog" className="text-indigo-600 hover:underline">
            Back to Blog
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <Link to="/blog" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        {/* Article */}
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Hero Image */}
          {blog.imageUrl && (
            <div className="h-64 md:h-96 bg-gray-200">
              <img 
                src={blog.imageUrl} 
                alt={blog.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 md:p-8">
            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(blog.createdAt).toLocaleDateString('en-IN', { 
                  day: 'numeric', month: 'long', year: 'numeric' 
                })}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {blog.author || 'Trstprep Team'}
              </span>
              {blog.readTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {blog.readTime}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {blog.title}
            </h1>

            {/* Category Tags */}
            {blog.tags && blog.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {blog.tags.map((tag, index) => (
                  <span key={index} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="prose max-w-none text-gray-700 leading-relaxed">
              {blog.description || blog.content}
            </div>

            {/* Share */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Share this article:</span>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <Share2 className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Related Articles */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Related Articles</h2>
          <Link to="/blog" className="text-indigo-600 hover:underline">
            View all articles →
          </Link>
        </div>
      </div>
    </div>
  )
}
