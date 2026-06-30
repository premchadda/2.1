import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  MessageCircle, Search, Plus, CheckCircle, Eye, Clock, User, ChevronRight, X,
  Users, Lock as LockIcon, Globe, Crown, MessageSquare, ArrowLeft, Share2, Settings,
  LogOut, Trash2, Send, FileText, Pin, Heart, AlertCircle, TrendingUp, Flame, Award,
  Loader2, ThumbsUp,
} from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import api from '../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../../shared/components/common/ConfirmModal.jsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-fuchsia-500',
]

const getAvatarGradient = (name) => {
  if (!name) return AVATAR_GRADIENTS[0]
  const sum = String(name).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length]
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/* ========== Hub View ========== */

function CommunityHubView() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('doubts')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showAskForm, setShowAskForm] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedDoubt, setSelectedDoubt] = useState(null)
  const [newDoubt, setNewDoubt] = useState({ title: '', description: '', category: 'general' })
  const [newGroup, setNewGroup] = useState({ name: '', description: '', category: 'general', isPrivate: false, maxMembers: 50 })

  const buildQueryStr = useCallback((category, search) => {
    const params = new URLSearchParams()
    if (category && category !== 'all') params.append('category', category)
    if (search) params.append('search', search)
    return params.toString()
  }, [])

  const { data: doubtsData, isLoading: loadingDoubts } = useQuery({
    queryKey: ['doubts', selectedCategory, searchQuery],
    queryFn: async () => {
      const res = await api.get(`/api/doubts?${buildQueryStr(selectedCategory, searchQuery)}`)
      return res.data?.data || []
    },
    enabled: activeTab === 'doubts',
    staleTime: 1000 * 60 * 2,
  })

  const { data: doubtCategories = [] } = useQuery({
    queryKey: ['doubt-categories'],
    queryFn: async () => {
      const res = await api.get('/api/doubts/categories')
      return res.data?.data || []
    },
    staleTime: 1000 * 60 * 30,
  })

  const { data: groupsData, isLoading: loadingGroups } = useQuery({
    queryKey: ['study-groups', selectedCategory, searchQuery],
    queryFn: async () => {
      const res = await api.get(`/api/study-groups?${buildQueryStr(selectedCategory, searchQuery)}`)
      return res.data?.data || []
    },
    enabled: activeTab === 'groups',
    staleTime: 1000 * 60 * 2,
  })

  const { data: groupCategories = [] } = useQuery({
    queryKey: ['group-categories'],
    queryFn: async () => {
      const res = await api.get('/api/study-groups/categories')
      return res.data?.data || []
    },
    staleTime: 1000 * 60 * 30,
  })

  const { data: myGroups = [] } = useQuery({
    queryKey: ['my-study-groups'],
    queryFn: async () => {
      const res = await api.get('/api/study-groups/my')
      return res.data?.data || []
    },
    enabled: Boolean(user) && activeTab === 'groups',
    staleTime: 1000 * 60 * 2,
  })

  const askDoubtMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/api/doubts', data)
      return res.data?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doubts'] })
      setShowAskForm(false)
      setNewDoubt({ title: '', description: '', category: 'general' })
      toast.success('Question posted!')
    },
    onError: () => toast.error('Failed to post your question'),
  })

  const createGroupMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/api/study-groups', data)
      return res.data?.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['study-groups'] })
      queryClient.invalidateQueries({ queryKey: ['my-study-groups'] })
      setShowCreateForm(false)
      setNewGroup({ name: '', description: '', category: 'general', isPrivate: false, maxMembers: 50 })
      navigate(`/community/groups/${data._id || data.id}`)
      toast.success('Group created!')
    },
    onError: () => toast.error('Failed to create group'),
  })

  const handleAskDoubt = (e) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    askDoubtMutation.mutate(newDoubt)
  }

  const handleCreateGroup = (e) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    createGroupMutation.mutate(newGroup)
  }

  const categories = activeTab === 'doubts' ? doubtCategories : groupCategories
  const doubts = doubtsData || []
  const groups = groupsData || []

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-6">
      {/* Compact Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 px-4 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">Community</h1>
            <p className="text-[11px] sm:text-xs text-white/60 mt-0.5 hidden sm:block">Ask doubts, join study groups, and learn together</p>
          </div>
          <button
            onClick={() => {
              if (!user) { navigate('/login'); return }
              activeTab === 'doubts' ? setShowAskForm(true) : setShowCreateForm(true)
            }}
            className="flex items-center gap-1.5 bg-white text-slate-900 px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm hover:bg-white/90 transition shadow-sm flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{activeTab === 'doubts' ? 'Ask' : 'Create'}</span>
            <span className="xs:hidden">{activeTab === 'doubts' ? 'Ask' : 'Create'}</span>
          </button>
        </div>
      </div>

      {/* Sticky Tabs + Search Bar (combined, compact) */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4">
          {/* Tabs row */}
          <div className="flex gap-1 pt-2">
            {[
              { id: 'doubts', label: 'Doubts', icon: MessageCircle, count: doubts.length },
              { id: 'groups', label: 'Groups', icon: Users, count: groups.length },
            ].map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedCategory('all'); setSearchQuery('') }}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-t-lg text-xs sm:text-sm font-bold transition-all border-b-2 -mb-px ${isActive ? 'text-brand-start border-brand-start' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-brand-start text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
                </button>
              )
            })}
          </div>
          {/* Search + filter row */}
          <div className="flex gap-2 py-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-brand-start transition-colors" />
              <input
                type="text"
                placeholder={activeTab === 'doubts' ? 'Search questions...' : 'Search groups...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-transparent rounded-lg text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-brand-start focus:ring-1 focus:ring-brand-start/20 transition-all"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-start/20 font-medium flex-shrink-0 max-w-[120px] sm:max-w-none"
            >
              <option value="all">All</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-3">
        {/* Doubts Tab */}
        {activeTab === 'doubts' && (
          <>
            {loadingDoubts ? (
              <LoadingSpinner label="Loading questions..." />
            ) : doubts.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No questions yet"
                message="Be the first to ask a question!"
                actionLabel="Ask a Question"
                onAction={() => user ? setShowAskForm(true) : navigate('/login')}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {doubts.map(doubt => (
                  <button
                    key={doubt._id || doubt.id}
                    onClick={() => setSelectedDoubt(doubt)}
                    className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 sm:p-4 text-left hover:shadow-card hover:border-slate-200 transition-all duration-200 group"
                  >
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarGradient(doubt.userName)} flex items-center justify-center font-bold text-white text-xs flex-shrink-0`}>
                        {doubt.userName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-700 truncate">{doubt.userName}</span>
                          {doubt.isAnswered && (
                            <span className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded-full flex-shrink-0">
                              <CheckCircle className="w-2 h-2" /> Ans
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-400">{formatTime(doubt.createdAt)}</span>
                      </div>
                      {doubt.category && (
                        <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0 font-medium hidden sm:inline">
                          {doubtCategories.find(c => c.id === doubt.category)?.icon} {doubt.category}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm mb-1 line-clamp-2 group-hover:text-brand-start transition-colors">{doubt.title}</h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mb-2 hidden sm:block">{doubt.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{doubt.views || 0}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{doubt.replyCount || 0}</span>
                      <span className="flex items-center gap-0.5 ml-auto text-brand-start group-hover:translate-x-0.5 transition-transform">View <ChevronRight className="w-3 h-3" /></span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <>
            {/* My Groups — compact horizontal scroll */}
            {myGroups.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Crown className="w-3 h-3 text-amber-500" /> My Groups
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3">
                  {myGroups.map(group => (
                    <Link
                      key={group._id || group.id}
                      to={`/community/groups/${group._id || group.id}`}
                      className="flex-shrink-0 w-40 sm:w-44 bg-gradient-to-br from-brand-start to-brand-end rounded-xl p-3 text-white hover:shadow-glow transition-all duration-200 hover:-translate-y-0.5 group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="font-bold text-xs truncate">{group.name}</h4>
                        {group.role === 'admin' && <Crown className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />}
                      </div>
                      <p className="text-white/70 text-[10px] line-clamp-1 mb-2">{group.description}</p>
                      <div className="flex items-center gap-1 text-[9px] text-white/80">
                        <Users className="w-2.5 h-2.5" />{group.memberCount || 0}
                        <span className="ml-auto flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Open <ChevronRight className="w-2.5 h-2.5" /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {loadingGroups ? (
              <LoadingSpinner label="Loading groups..." />
            ) : groups.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No groups found"
                message="Be the first to create a study group!"
                actionLabel="Create Group"
                onAction={() => user ? setShowCreateForm(true) : navigate('/login')}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {groups.map(group => (
                  <Link
                    key={group._id || group.id}
                    to={`/community/groups/${group._id || group.id}`}
                    className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 hover:shadow-card hover:border-slate-200 transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(group.name)} flex items-center justify-center font-bold text-white text-sm shadow-sm flex-shrink-0`}>
                        {group.name?.charAt(0).toUpperCase() || 'G'}
                      </div>
                      {group.isPrivate ? (
                        <LockIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm mb-0.5 group-hover:text-brand-start transition-colors line-clamp-1">{group.name}</h3>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mb-2 leading-tight">{group.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                        <Users className="w-3 h-3" />
                        {group.memberCount || 0}/{group.maxMembers || 50}
                      </div>
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-brand-start group-hover:translate-x-0.5 transition-transform">
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Ask Doubt Modal */}
      {showAskForm && (
        <Modal title="Ask a Question" onClose={() => setShowAskForm(false)}>
          <form onSubmit={handleAskDoubt} className="space-y-3">
            <Field label="Title">
              <input type="text" value={newDoubt.title} onChange={(e) => setNewDoubt({ ...newDoubt, title: e.target.value })} placeholder="What's your question?" required className={inputClass} />
            </Field>
            <Field label="Description">
              <textarea value={newDoubt.description} onChange={(e) => setNewDoubt({ ...newDoubt, description: e.target.value })} placeholder="Provide more details..." required rows={3} className={inputClass} />
            </Field>
            <Field label="Category">
              <select value={newDoubt.category} onChange={(e) => setNewDoubt({ ...newDoubt, category: e.target.value })} className={inputClass}>
                {doubtCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
              </select>
            </Field>
            <button type="submit" disabled={askDoubtMutation.isPending} className="w-full py-2.5 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-xl font-bold text-sm hover:shadow-glow transition disabled:opacity-50">
              {askDoubtMutation.isPending ? 'Posting...' : 'Post Question'}
            </button>
          </form>
        </Modal>
      )}

      {/* Create Group Modal */}
      {showCreateForm && (
        <Modal title="Create Study Group" onClose={() => setShowCreateForm(false)}>
          <form onSubmit={handleCreateGroup} className="space-y-3">
            <Field label="Group Name">
              <input type="text" value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="e.g., SSC CGL 2026 Group" required className={inputClass} />
            </Field>
            <Field label="Description">
              <textarea value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} placeholder="What's this group about?" required rows={2} className={inputClass} />
            </Field>
            <Field label="Category">
              <select value={newGroup.category} onChange={(e) => setNewGroup({ ...newGroup, category: e.target.value })} className={inputClass}>
                {groupCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={newGroup.isPrivate} onChange={(e) => setNewGroup({ ...newGroup, isPrivate: e.target.checked })} className="w-4 h-4 rounded" />
              <span className="text-sm text-slate-700 font-medium">Private Group</span>
            </label>
            <button type="submit" disabled={createGroupMutation.isPending} className="w-full py-2.5 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-xl font-bold text-sm hover:shadow-glow transition disabled:opacity-50">
              {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
            </button>
          </form>
        </Modal>
      )}

      {/* Doubt Detail Modal */}
      {selectedDoubt && (
        <DoubtDetailModal doubt={selectedDoubt} onClose={() => setSelectedDoubt(null)} />
      )}
    </div>
  )
}

/* ========== Doubt Detail Modal ========== */

function DoubtDetailModal({ doubt, onClose }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')

  const { data: replies = [], isLoading } = useQuery({
    queryKey: ['doubt-replies', doubt._id || doubt.id],
    queryFn: async () => {
      const res = await api.get(`/api/doubts/${doubt._id || doubt.id}`)
      return res.data?.data?.replies || []
    },
    staleTime: 1000 * 60,
  })

  const replyMutation = useMutation({
    mutationFn: async (content) => {
      const res = await api.post(`/api/doubts/${doubt._id || doubt.id}/replies`, { content })
      return res.data?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doubt-replies', doubt._id || doubt.id] })
      queryClient.invalidateQueries({ queryKey: ['doubts'] })
      setReply('')
      toast.success('Reply posted!')
    },
    onError: () => toast.error('Failed to post reply'),
  })

  const handleReply = (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    replyMutation.mutate(reply.trim())
  }

  return (
    <Modal title={doubt.title} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getAvatarGradient(doubt.userName)} flex items-center justify-center font-bold text-white text-xs flex-shrink-0`}>
            {doubt.userName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-xs">{doubt.userName}</p>
            <p className="text-[9px] text-slate-400">{formatTime(doubt.createdAt)}</p>
          </div>
          {doubt.isAnswered && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full ml-auto flex-shrink-0">
              <CheckCircle className="w-2.5 h-2.5" /> Answered
            </span>
          )}
        </div>

        <p className="text-sm text-slate-700 whitespace-pre-wrap">{doubt.description}</p>

        <div className="pt-3 border-t border-slate-100">
          <h4 className="font-bold text-slate-900 text-xs mb-3 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-brand-start" />
            {replies.length} Replies
          </h4>

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-brand-start animate-spin" /></div>
          ) : replies.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-4">No replies yet. Be the first to answer!</p>
          ) : (
            <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
              {replies.map(r => (
                <div key={r._id || r.id} className="flex gap-2.5 bg-slate-50 rounded-lg p-2.5">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(r.userName)} flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0`}>
                    {r.userName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-bold text-slate-700">{r.userName}</span>
                      <span className="text-[8px] text-slate-400">{formatTime(r.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{r.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {user && (
            <form onSubmit={handleReply} className="flex gap-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-start/20 focus:bg-white transition"
              />
              <button type="submit" disabled={!reply.trim() || replyMutation.isPending} className="px-3 py-2 bg-brand-start text-white rounded-lg text-xs font-bold hover:bg-brand-dark transition disabled:opacity-40 flex-shrink-0">
                {replyMutation.isPending ? '...' : 'Reply'}
              </button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ========== Chat Tab ========== */

function ChatTab({ groupId, socket, user }) {
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const { data: messages = [], isLoading: loading } = useQuery({
    queryKey: ['group-messages', groupId],
    queryFn: async () => {
      const res = await api.get(`/api/study-groups/${groupId}/messages?limit=50`)
      return res.data?.data || []
    },
    staleTime: 1000 * 30,
  })

  const [realtimeMessages, setRealtimeMessages] = useState([])

  useEffect(() => {
    if (!socket) return
    socket.emit('study-groups:join', { groupId })
    const handler = (data) => {
      if (data.message) {
        setRealtimeMessages(prev => {
          if (prev.some(m => m.id === data.message.id || m._id === data.message._id)) return prev
          return [...prev, data.message]
        })
      }
    }
    socket.on('group:message:new', handler)
    return () => {
      socket.off('group:message:new', handler)
      socket.emit('study-groups:leave', { groupId })
    }
  }, [socket, groupId])

  const allMessages = [...messages, ...realtimeMessages]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allMessages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return
    try {
      setSending(true)
      const res = await api.post(`/api/study-groups/${groupId}/messages`, { content: newMessage.trim(), messageType: 'text' })
      if (res.data?.success) {
        setNewMessage('')
        inputRef.current?.focus()
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-brand-start animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] sm:h-[calc(100vh-160px)]">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {allMessages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          allMessages.map((msg) => {
            const isMe = msg.userId === user?.id
            return (
              <div key={msg._id || msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] sm:max-w-[75%] ${isMe ? 'order-1' : ''}`}>
                  {!isMe && <p className="text-[9px] font-bold text-slate-500 mb-0.5 ml-1">{msg.userName}</p>}
                  <div className={`px-3 py-2 rounded-xl ${isMe ? 'bg-gradient-to-r from-brand-start to-brand-end text-white rounded-br-sm' : 'bg-slate-100 text-slate-900 rounded-bl-sm'}`}>
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <p className={`text-[8px] text-slate-400 mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                    {formatTime(msg.createdAt)}{msg.isEdited && ' (edited)'}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-slate-100 p-2 sm:p-3 bg-white">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-slate-50 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand-start/20 focus:bg-white transition"
          />
          <button type="submit" disabled={sending || !newMessage.trim()} className="p-2 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-lg hover:shadow-glow transition disabled:opacity-40 flex-shrink-0">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  )
}

/* ========== Discussions Tab ========== */

function DiscussionsTab({ groupId, user, isAdmin }) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newPost, setNewPost] = useState({ title: '', content: '' })
  const [selectedPost, setSelectedPost] = useState(null)

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['group-posts', groupId],
    queryFn: async () => {
      const res = await api.get(`/api/study-groups/${groupId}/posts`)
      return res.data?.data || []
    },
    staleTime: 1000 * 60,
  })

  const { data: postComments = [] } = useQuery({
    queryKey: ['group-post-detail', groupId, selectedPost?._id || selectedPost?.id],
    queryFn: async () => {
      const res = await api.get(`/api/study-groups/${groupId}/posts/${selectedPost._id || selectedPost.id}`)
      return res.data?.data?.comments || []
    },
    enabled: Boolean(selectedPost),
    staleTime: 1000 * 30,
  })

  const [newComment, setNewComment] = useState('')

  const createPostMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post(`/api/study-groups/${groupId}/posts`, { ...data, postType: 'discussion' })
      return res.data?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] })
      setNewPost({ title: '', content: '' })
      setShowCreate(false)
      toast.success('Post created!')
    },
    onError: () => toast.error('Failed to create post'),
  })

  const likeMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await api.post(`/api/study-groups/${groupId}/posts/${postId}/like`)
      return res.data?.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] }),
  })

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }) => {
      const res = await api.post(`/api/study-groups/${groupId}/posts/${postId}/comments`, { content })
      return res.data?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-post-detail', groupId, selectedPost?._id || selectedPost?.id] })
      setNewComment('')
    },
  })

  const pinMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await api.put(`/api/study-groups/${groupId}/posts/${postId}/pin`)
      return res.data?.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] }),
  })

  const handleCreatePost = (e) => {
    e.preventDefault()
    if (!newPost.title.trim()) return
    createPostMutation.mutate({ title: newPost.title.trim(), content: newPost.content.trim() })
  }

  const handleAddComment = (e) => {
    e.preventDefault()
    if (!newComment.trim() || !selectedPost) return
    commentMutation.mutate({ postId: selectedPost._id || selectedPost.id, content: newComment.trim() })
  }

  if (selectedPost) {
    return (
      <div className="p-3">
        <button onClick={() => { setSelectedPost(null); setNewComment('') }} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-3 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to discussions
        </button>
        <div className="bg-white rounded-xl border border-slate-100 p-4 mb-3 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">{selectedPost.title}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${getAvatarGradient(selectedPost.userName)} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
                  {(selectedPost.userName || 'U').charAt(0)}
                </div>
                <span className="text-[11px] text-slate-500 truncate">{selectedPost.userName}</span>
                <span className="text-[9px] text-slate-400 flex-shrink-0">{formatTime(selectedPost.createdAt)}</span>
                {selectedPost.isPinned && <span className="flex items-center gap-0.5 text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"><Pin className="w-2.5 h-2.5" /> Pinned</span>}
              </div>
            </div>
          </div>
          {selectedPost.content && <p className="text-xs text-slate-700 whitespace-pre-wrap mb-3">{selectedPost.content}</p>}
          <div className="flex items-center gap-3 pt-2.5 border-t border-slate-100">
            <button onClick={() => likeMutation.mutate(selectedPost._id || selectedPost.id)} className={`flex items-center gap-1 text-xs transition ${selectedPost.isLiked ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'}`}>
              <Heart className={`w-3.5 h-3.5 ${selectedPost.isLiked ? 'fill-current' : ''}`} /> {selectedPost.likeCount}
            </button>
            <span className="flex items-center gap-1 text-xs text-slate-500"><MessageCircle className="w-3.5 h-3.5" /> {postComments.length}</span>
            <span className="text-[10px] text-slate-400 ml-auto">{selectedPost.viewCount || 0} views</span>
          </div>
        </div>
        <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
          {postComments.map(c => (
            <div key={c._id || c.id} className="flex gap-2 bg-slate-50 rounded-lg p-2.5">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(c.userName)} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>{(c.userName || 'U').charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-bold text-slate-700">{c.userName}</span>
                  <span className="text-[8px] text-slate-400">{formatTime(c.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-start/20 focus:bg-white transition" />
          <button type="submit" disabled={!newComment.trim() || commentMutation.isPending} className="px-3 py-2 bg-brand-start text-white rounded-lg text-xs font-bold hover:bg-brand-dark disabled:opacity-40 transition flex-shrink-0">Reply</button>
        </form>
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-brand-start animate-spin" /></div>
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-900 text-sm">Discussions</h3>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-lg text-[11px] font-bold hover:shadow-glow transition">
          <Plus className="w-3 h-3" /> New Post
        </button>
      </div>
      {showCreate && (
        <div className="bg-white rounded-xl border border-slate-100 p-3 mb-3 shadow-sm">
          <form onSubmit={handleCreatePost} className="space-y-2">
            <input type="text" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} placeholder="Post title..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-brand-start/20 focus:bg-white" required />
            <textarea value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} placeholder="What's on your mind?" rows={2} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-start/20 focus:bg-white resize-none" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700">Cancel</button>
              <button type="submit" disabled={createPostMutation.isPending} className="px-3 py-1.5 bg-brand-start text-white rounded-lg text-[11px] font-bold hover:bg-brand-dark disabled:opacity-40">Post</button>
            </div>
          </form>
        </div>
      )}
      <div className="space-y-2">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
            <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No discussions yet. Start one!</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post._id || post.id} onClick={() => setSelectedPost(post)} className={`bg-white rounded-xl border p-3 hover:shadow-card transition cursor-pointer ${post.isPinned ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {post.isPinned && <Pin className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                    <h4 className="font-bold text-xs text-slate-900 truncate">{post.title}</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-4 h-4 rounded bg-gradient-to-br ${getAvatarGradient(post.userName)} flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0`}>{(post.userName || 'U').charAt(0)}</div>
                    <span className="text-[9px] text-slate-500 truncate">{post.userName}</span>
                    <span className="text-[8px] text-slate-400 flex-shrink-0">{formatTime(post.createdAt)}</span>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); pinMutation.mutate(post._id || post.id) }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-amber-500 flex-shrink-0"
                    title={post.isPinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin className="w-3 h-3" />
                  </button>
                )}
              </div>
              {post.content && <p className="text-[11px] text-slate-600 line-clamp-2 mb-2">{post.content}</p>}
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {post.likeCount}</span>
                <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {post.commentCount || 0}</span>
                <span className="ml-auto text-[9px]">{post.viewCount || 0} views</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ========== Members Tab ========== */

function MembersTab({ group }) {
  const members = (group?.members || []).sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1
    if (b.role === 'admin' && a.role !== 'admin') return 1
    return 0
  })

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-brand-start" />
        <h3 className="font-bold text-slate-900 text-sm">Members</h3>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{group?.memberCount || 0}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {members.map((member) => (
          <div key={member._id || member.id} className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-100 hover:shadow-card transition">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getAvatarGradient(member.userName)} flex items-center justify-center font-bold text-xs text-white flex-shrink-0`}>
              {(member.userName || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs text-slate-900 truncate">{member.userName || 'Unknown User'}</p>
              <p className="text-[9px] text-slate-400">Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : ''}</p>
            </div>
            {member.role === 'admin' && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                <Crown className="w-2.5 h-2.5" /> Admin
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ========== Group Detail View ========== */

function GroupDetailView({ groupId, onBack }) {
  const { user, socket } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm()
  const [activeTab, setActiveTab] = useState('chat')

  const { data: group, isLoading } = useQuery({
    queryKey: ['study-group', groupId],
    queryFn: async () => {
      const res = await api.get(`/api/study-groups/${groupId}`)
      return res.data?.data
    },
    staleTime: 1000 * 30,
  })

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/study-groups/${groupId}/join`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-group', groupId] })
      queryClient.invalidateQueries({ queryKey: ['my-study-groups'] })
      toast.success('Joined group!')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to join'),
  })

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/study-groups/${groupId}/leave`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-group', groupId] })
      queryClient.invalidateQueries({ queryKey: ['my-study-groups'] })
      toast.success('Left group')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to leave'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/api/study-groups/${groupId}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-groups'] })
      navigate('/community')
      toast.success('Group deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const handleJoin = () => {
    if (!user) { navigate('/login'); return }
    joinMutation.mutate()
  }

  const handleLeave = async () => {
    const ok = await confirmDialog({
      title: 'Leave group?',
      message: 'Leave this group?',
      confirmLabel: 'Leave',
      danger: true,
    })
    if (!ok) return
    leaveMutation.mutate()
  }

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: 'Delete group?',
      message: 'Delete this group permanently?',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    deleteMutation.mutate()
  }

  const isMember = group?.members?.some(m => String(m.userId) === String(user?.id))
  const isAdmin = group?.members?.some(m => String(m.userId) === String(user?.id) && m.role === 'admin')
  const isOwner = String(group?.userId) === String(user?.id)

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'discussions', label: 'Discussions', icon: FileText },
    { id: 'members', label: 'Members', icon: Users },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brand-start animate-spin mx-auto mb-2" />
          <p className="text-slate-500 text-xs">Loading group...</p>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-xl p-6 shadow-card border border-slate-100 max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-2" />
          <h2 className="text-base font-bold text-slate-900 mb-1">Group Not Found</h2>
          <p className="text-xs text-slate-500 mb-3">This group doesn't exist or has been removed.</p>
          <button onClick={onBack} className="px-4 py-2 bg-brand-start text-white rounded-lg text-xs font-bold hover:bg-brand-dark">Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      {ConfirmDialog}
      {/* Compact Group Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2.5">
          <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg transition flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(group.name)} flex items-center justify-center font-bold text-white text-sm shadow-lg flex-shrink-0`}>
            {group.name?.charAt(0).toUpperCase() || 'G'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-black text-white truncate leading-none">{group.name}</h1>
            <p className="text-[10px] text-white/60 mt-0.5">{group.memberCount || 0} members • {group.isPrivate ? 'Private' : 'Public'}</p>
          </div>
          <button className="p-1.5 hover:bg-white/10 rounded-lg transition flex-shrink-0"><Share2 className="w-3.5 h-3.5 text-white/70" /></button>
          {isAdmin && <button className="p-1.5 hover:bg-white/10 rounded-lg transition flex-shrink-0"><Settings className="w-3.5 h-3.5 text-white/70" /></button>}
        </div>
      </div>

      {/* Sticky Tabs */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 flex">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-bold transition-all border-b-2 ${isActive ? 'text-brand-start border-brand-start' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {activeTab === 'chat' && (isMember ? <ChatTab groupId={groupId} socket={socket} user={user} /> : (
          <JoinPrompt icon={LockIcon} message="Join this group to access the chat" onJoin={handleJoin} joining={joinMutation.isPending} />
        ))}
        {activeTab === 'discussions' && (isMember ? <DiscussionsTab groupId={groupId} user={user} isAdmin={isAdmin} /> : (
          <JoinPrompt icon={LockIcon} message="Join this group to view discussions" onJoin={handleJoin} joining={joinMutation.isPending} />
        ))}
        {activeTab === 'members' && <MembersTab group={group} />}
      </div>

      {/* Sticky Action Bar */}
      {isMember && (
        <div className="border-t border-slate-100 bg-white p-2 sticky bottom-0 md:hidden">
          {!isOwner && (
            <button onClick={handleLeave} disabled={leaveMutation.isPending} className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition">
              <LogOut className="w-3.5 h-3.5" /> {leaveMutation.isPending ? 'Leaving...' : 'Leave Group'}
            </button>
          )}
          {isOwner && (
            <button onClick={handleDelete} disabled={deleteMutation.isPending} className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition">
              <Trash2 className="w-3.5 h-3.5" /> {deleteMutation.isPending ? 'Deleting...' : 'Delete Group'}
            </button>
          )}
        </div>
      )}
      {/* Desktop action bar */}
      {isMember && (
        <div className="border-t border-slate-100 bg-white p-3 hidden md:flex gap-2 max-w-4xl mx-auto justify-end">
          {!isOwner && (
            <button onClick={handleLeave} disabled={leaveMutation.isPending} className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition">
              <LogOut className="w-3.5 h-3.5" /> {leaveMutation.isPending ? 'Leaving...' : 'Leave Group'}
            </button>
          )}
          {isOwner && (
            <button onClick={handleDelete} disabled={deleteMutation.isPending} className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition">
              <Trash2 className="w-3.5 h-3.5" /> {deleteMutation.isPending ? 'Deleting...' : 'Delete Group'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ========== Shared UI Helpers ========== */

const inputClass = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-start/20 focus:bg-white transition"

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={onClose}>
      <div className={`bg-white rounded-xl ${wide ? 'max-w-xl' : 'max-w-md'} w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 shadow-elevated`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate pr-2">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function LoadingSpinner({ label }) {
  return (
    <div className="text-center py-12">
      <Loader2 className="w-8 h-8 text-brand-start animate-spin mx-auto mb-2" />
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function EmptyState({ icon: Icon, title, message, actionLabel, onAction }) {
  return (
    <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
        <Icon className="w-7 h-7 text-slate-300" />
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-3 px-4">{message}</p>
      <button onClick={onAction} className="px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-lg text-xs font-bold hover:shadow-glow transition">
        {actionLabel}
      </button>
    </div>
  )
}

function JoinPrompt({ icon: Icon, message, onJoin, joining }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Icon className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-xs text-slate-500 mb-3 px-4">{message}</p>
        <button onClick={onJoin} disabled={joining} className="px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-lg text-xs font-bold hover:shadow-glow transition disabled:opacity-50">
          {joining ? 'Joining...' : 'Join Group'}
        </button>
      </div>
    </div>
  )
}

/* ========== Main Export ========== */

export default function Community() {
  const { id } = useParams()
  const navigate = useNavigate()

  if (id) {
    return <GroupDetailView groupId={id} onBack={() => navigate('/community')} />
  }

  return <CommunityHubView />
}