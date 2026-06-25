import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  MessageCircle, Search, Plus, CheckCircle, Eye, Clock, User, ChevronRight, X,
  Users, Lock as LockIcon, Lock, Globe, Crown, MessageSquare, ArrowLeft, Share2, Settings,
  LogOut, Trash2, Send, FileText, Pin, Heart, AlertCircle
} from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import api from '../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../../shared/components/common/ConfirmModal.jsx'


function CommunityHubView() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('doubts')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [doubts, setDoubts] = useState([])
  const [doubtCategories, setDoubtCategories] = useState([])
  const [loadingDoubts, setLoadingDoubts] = useState(true)
  const [showAskForm, setShowAskForm] = useState(false)
  const [newDoubt, setNewDoubt] = useState({ title: '', description: '', category: 'general' })

  const [groups, setGroups] = useState([])
  const [myGroups, setMyGroups] = useState([])
  const [groupCategories, setGroupCategories] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newGroup, setNewGroup] = useState({ name: '', description: '', category: 'general', isPrivate: false, maxMembers: 50 })

  useEffect(() => {
    if (activeTab === 'doubts') fetchDoubts()
  }, [activeTab, selectedCategory])

  useEffect(() => {
    if (activeTab === 'groups') fetchGroups()
  }, [activeTab, selectedCategory])

  const fetchDoubts = async () => {
    try {
      setLoadingDoubts(true)
      const [doubtsRes, categoriesRes] = await Promise.all([
        api.get(`/api/doubts?category=${selectedCategory}`),
        api.get('/api/doubts/categories')
      ])
      if (doubtsRes.data?.success) setDoubts(doubtsRes.data.data)
      if (categoriesRes.data?.success) setDoubtCategories(categoriesRes.data.data)
    } catch (e) { console.error('Failed to fetch doubts:', e) } finally { setLoadingDoubts(false) }
  }

  const fetchGroups = async () => {
    try {
      setLoadingGroups(true)
      const [groupsRes, categoriesRes, myGroupsRes] = await Promise.all([
        api.get(`/api/study-groups?category=${selectedCategory}`),
        api.get('/api/study-groups/categories'),
        user ? api.get('/api/study-groups/my') : Promise.resolve({ data: { data: [] } })
      ])
      if (groupsRes.data?.success) setGroups(groupsRes.data.data)
      if (categoriesRes.data?.success) setGroupCategories(categoriesRes.data.data)
      if (myGroupsRes.data?.success) setMyGroups(myGroupsRes.data.data)
    } catch (e) { console.error('Failed to fetch groups:', e) } finally { setLoadingGroups(false) }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (activeTab === 'doubts') {
      try {
        setLoadingDoubts(true)
        const res = await api.get(`/api/doubts?search=${searchQuery}&category=${selectedCategory}`)
        if (res.data?.success) setDoubts(res.data.data)
      } catch (e) { console.error('Search failed:', e) } finally { setLoadingDoubts(false) }
    } else {
      try {
        setLoadingGroups(true)
        const res = await api.get(`/api/study-groups?search=${searchQuery}&category=${selectedCategory}`)
        if (res.data?.success) setGroups(res.data.data)
      } catch (e) { console.error('Search failed:', e) } finally { setLoadingGroups(false) }
    }
  }

  const handleAskDoubt = async (e) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    try {
      const res = await api.post('/api/doubts', newDoubt)
      if (res.data?.success) {
        setShowAskForm(false)
        setNewDoubt({ title: '', description: '', category: 'general' })
        fetchDoubts()
      }
    } catch (e) { toast.error('Failed to post your question') }
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    try {
      const res = await api.post('/api/study-groups', newGroup)
      if (res.data?.success) {
        setShowCreateForm(false)
        setNewGroup({ name: '', description: '', category: 'general', isPrivate: false, maxMembers: 50 })
        navigate(`/community/groups/${res.data.data._id || res.data.data.id}`)
      }
    } catch (e) { toast.error('Failed to create group') }
  }

  const categories = activeTab === 'doubts' ? doubtCategories : groupCategories

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Community</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Ask doubts, join study groups, and learn together</p>
          </div>
          <button
            onClick={() => {
              if (!user) { navigate('/login'); return }
              activeTab === 'doubts' ? setShowAskForm(true) : setShowCreateForm(true)
            }}
            className="mt-3 md:mt-0 flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'doubts' ? 'Ask a Question' : 'Create Group'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[
              { id: 'doubts', label: 'Doubt Forum', icon: MessageCircle },
              { id: 'groups', label: 'Study Groups', icon: Users },
            ].map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const count = tab.id === 'doubts' ? doubts.length : groups.length
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedCategory('all'); setSearchQuery('') }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all border-b-2 ${
                    isActive ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20' : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'doubts' ? 'Search questions...' : 'Search groups...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-shrink-0 max-w-[120px]"
              >
                <option value="all">All</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
              <button type="submit" className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex-shrink-0">Search</button>
            </form>
          </div>

          {activeTab === 'doubts' && (
            <>
              {loadingDoubts ? (
                <div className="text-center py-12"><div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" /><p className="mt-3 text-sm text-gray-500">Loading questions...</p></div>
              ) : doubts.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No questions yet</h3>
                  <p className="text-sm text-gray-500 mb-4">Be the first to ask a question!</p>
                  <button onClick={() => user ? setShowAskForm(true) : navigate('/login')} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">Ask a Question</button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {doubts.map(doubt => (
                    <Link key={doubt._id || doubt.id} to={`/community/doubts/${doubt._id || doubt.id}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer">
                      <div className="flex items-start gap-2 mb-1.5">
                        {doubt.isAnswered && <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />}
                        <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">{doubtCategories.find(c => c.id === doubt.category)?.icon} {doubt.category}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{doubt.title}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-2">{doubt.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{doubt.userName}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{doubt.views || 0}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{doubt.replyCount || 0}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(doubt.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'groups' && (
            <>
              {myGroups.length > 0 && (
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">My Groups</h3>
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                    {myGroups.map(group => (
                      <Link key={group._id || group.id} to={`/community/groups/${group._id || group.id}`} className="flex-shrink-0 w-48 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-3 text-white hover:shadow-md transition group/my">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-sm truncate">{group.name}</h4>
                          {group.role === 'admin' && <Crown className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />}
                        </div>
                        <p className="text-indigo-100 text-[10px] line-clamp-1 mb-2">{group.description}</p>
                        <div className="flex items-center gap-1 text-[10px] text-indigo-100"><Users className="w-3 h-3" />{group.memberCount || 0}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {loadingGroups ? (
                <div className="text-center py-12"><div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" /><p className="mt-3 text-sm text-gray-500">Loading groups...</p></div>
              ) : groups.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No groups found</h3>
                  <p className="text-sm text-gray-500 mb-4">Be the first to create a study group!</p>
                  <button onClick={() => user ? setShowCreateForm(true) : navigate('/login')} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">Create Group</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {groups.map(group => (
                    <Link key={group._id || group.id} to={`/community/groups/${group._id || group.id}`} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition block">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          {group.isPrivate ? <Lock className="w-3.5 h-3.5 text-gray-400" /> : <Globe className="w-3.5 h-3.5 text-gray-400" />}
                          <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{groupCategories.find(c => c.id === group.category)?.icon} {group.category}</span>
                        </div>
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{group.name}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{group.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-gray-500"><Users className="w-3 h-3" />{group.memberCount || 0} / {group.maxMembers || 50}</div>
                        <span className="flex items-center gap-0.5 text-[10px] text-indigo-600 font-medium">View <ChevronRight className="w-3 h-3" /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {showAskForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ask a Question</h2>
                <button onClick={() => setShowAskForm(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAskDoubt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                  <input type="text" value={newDoubt.title} onChange={(e) => setNewDoubt({ ...newDoubt, title: e.target.value })} placeholder="What's your question?" required className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea value={newDoubt.description} onChange={(e) => setNewDoubt({ ...newDoubt, description: e.target.value })} placeholder="Provide more details..." required rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select value={newDoubt.category} onChange={(e) => setNewDoubt({ ...newDoubt, category: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                    {doubtCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-bold">Post Question</button>
              </form>
            </div>
          </div>
        )}

        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Study Group</h2>
                <button onClick={() => setShowCreateForm(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Name</label>
                  <input type="text" value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="e.g., SSC CGL 2026 Group" required className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} placeholder="What's this group about?" required rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select value={newGroup.category} onChange={(e) => setNewGroup({ ...newGroup, category: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                    {groupCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newGroup.isPrivate} onChange={(e) => setNewGroup({ ...newGroup, isPrivate: e.target.checked })} className="w-4 h-4" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Private Group</span>
                </label>
                <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-bold">Create Group</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function ChatTab({ groupId, socket, user }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get(`/api/study-groups/${groupId}/messages?limit=50`)
      if (res.data?.success) setMessages(res.data.data)
    } catch (e) {
      console.error('Failed to fetch messages:', e)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  useEffect(() => {
    if (!socket) return
    socket.emit('study-groups:join', { groupId })
    const handler = (data) => {
      if (data.message) {
        setMessages(prev => {
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return
    try {
      setSending(true)
      const res = await api.post(`/api/study-groups/${groupId}/messages`, {
        content: newMessage.trim(),
        messageType: 'text'
      })
      if (res.data?.success) {
        setNewMessage('')
        inputRef.current?.focus()
      }
    } catch (e) {
      console.error('Failed to send message:', e)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === user?.id
            return (
              <div key={msg._id || msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isMe ? 'order-1' : ''}`}>
                  {!isMe && <p className="text-[10px] font-bold text-gray-500 mb-0.5 ml-1">{msg.userName}</p>}
                  <div className={`px-3 py-2 rounded-2xl ${isMe ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <p className={`text-[9px] text-gray-400 mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                    {formatTime(msg.createdAt)}{msg.isEdited && ' (edited)'}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-gray-200 p-3 bg-white">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
          <button type="submit" disabled={sending || newMessage.trim() === ''} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

function DiscussionsTab({ groupId, user }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newPost, setNewPost] = useState({ title: '', content: '' })
  const [selectedPost, setSelectedPost] = useState(null)
  const [postComments, setPostComments] = useState([])
  const [newComment, setNewComment] = useState('')

  const fetchPosts = useCallback(async () => {
    try {
      const res = await api.get(`/api/study-groups/${groupId}/posts`)
      if (res.data?.success) setPosts(res.data.data)
    } catch (e) {
      console.error('Failed to fetch posts:', e)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const createPost = async (e) => {
    e.preventDefault()
    if (!newPost.title.trim()) return
    try {
      const res = await api.post(`/api/study-groups/${groupId}/posts`, {
        title: newPost.title.trim(), content: newPost.content.trim(), postType: 'discussion'
      })
      if (res.data?.success) {
        setNewPost({ title: '', content: '' })
        setShowCreate(false)
        fetchPosts()
      }
    } catch (e) {
      console.error('Failed to create post:', e)
    }
  }

  const toggleLike = async (postId) => {
    try {
      const res = await api.post(`/api/study-groups/${groupId}/posts/${postId}/like`)
      if (res.data?.success) {
        setPosts(prev => prev.map(p => {
          if ((p._id || p.id) === postId) {
            const liked = res.data.data.liked
            return { ...p, isLiked: liked, likeCount: p.likeCount + (liked ? 1 : -1) }
          }
          return p
        }))
      }
    } catch (e) { console.error('Failed to toggle like:', e) }
  }

  const openPost = async (post) => {
    setSelectedPost(post)
    try {
      const res = await api.get(`/api/study-groups/${groupId}/posts/${post._id || post.id}`)
      if (res.data?.success) setPostComments(res.data.data.comments || [])
    } catch (e) { console.error('Failed to fetch post:', e) }
  }

  const addComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !selectedPost) return
    try {
      const res = await api.post(`/api/study-groups/${groupId}/posts/${selectedPost._id || selectedPost.id}/comments`, { content: newComment.trim() })
      if (res.data?.success) {
        setPostComments(prev => [...prev, res.data.data])
        setNewComment('')
      }
    } catch (e) { console.error('Failed to add comment:', e) }
  }

  const togglePin = async (postId) => {
    try {
      const res = await api.put(`/api/study-groups/${groupId}/posts/${postId}/pin`)
      if (res.data?.success) {
        setPosts(prev => prev.map(p => (p._id || p.id) === postId ? { ...p, isPinned: res.data.data.isPinned } : p))
      }
    } catch (e) { console.error('Failed to pin:', e) }
  }

  if (selectedPost) {
    return (
      <div className="p-4">
        <button onClick={() => { setSelectedPost(null); setPostComments([]) }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to discussions
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{selectedPost.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                  {(selectedPost.userName || 'U').charAt(0)}
                </div>
                <span className="text-xs text-gray-500">{selectedPost.userName}</span>
                <span className="text-[10px] text-gray-400">{formatTime(selectedPost.createdAt)}</span>
                {selectedPost.isPinned && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5"><Pin className="w-2.5 h-2.5" /> Pinned</span>}
              </div>
            </div>
          </div>
          {selectedPost.content && <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">{selectedPost.content}</p>}
          <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
            <button onClick={() => toggleLike(selectedPost._id || selectedPost.id)} className={`flex items-center gap-1.5 text-sm ${selectedPost.isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'} transition`}>
              <Heart className={`w-4 h-4 ${selectedPost.isLiked ? 'fill-current' : ''}`} /> {selectedPost.likeCount}
            </button>
            <span className="flex items-center gap-1.5 text-sm text-gray-500"><MessageCircle className="w-4 h-4" /> {postComments.length}</span>
            <span className="text-xs text-gray-400 ml-auto">{selectedPost.viewCount || 0} views</span>
          </div>
        </div>
        <div className="space-y-3 mb-4">
          {postComments.map(c => (
            <div key={c._id || c.id} className="flex gap-3 bg-gray-50 rounded-xl p-3">
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">{(c.userName || 'U').charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-gray-700">{c.userName}</span>
                  <span className="text-[9px] text-gray-400">{formatTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={addComment} className="flex gap-2">
          <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment..." className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button type="submit" disabled={!newComment.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition">Reply</button>
        </form>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Discussions</h3>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition">
          <Plus className="w-3.5 h-3.5" /> New Post
        </button>
      </div>
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <form onSubmit={createPost} className="space-y-3">
            <input type="text" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} placeholder="Post title..." className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            <textarea value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} placeholder="What's on your mind?" rows={3} className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Post</button>
            </div>
          </form>
        </div>
      )}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No discussions yet. Start one!</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post._id || post.id} onClick={() => openPost(post)} className={`bg-white rounded-xl border p-4 hover:shadow-sm transition cursor-pointer ${post.isPinned ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {post.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                    <h4 className="font-bold text-sm text-gray-900 truncate">{post.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600">{(post.userName || 'U').charAt(0)}</div>
                    <span className="text-[10px] text-gray-500">{post.userName}</span>
                    <span className="text-[9px] text-gray-400">{formatTime(post.createdAt)}</span>
                  </div>
                </div>
              </div>
              {post.content && <p className="text-xs text-gray-600 line-clamp-2 mb-3">{post.content}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {post.likeCount}</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {post.commentCount || 0}</span>
                <span className="ml-auto text-[10px]">{post.viewCount || 0} views</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function MembersTab({ group }) {
  const members = (group?.members || []).sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1
    if (b.role === 'admin' && a.role !== 'admin') return 1
    return 0
  })

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-gray-900">Members</h3>
        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{group?.memberCount || 0}</span>
      </div>
      <div className="space-y-2">
        {members.map((member) => (
          <div key={member._id || member.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
              member.role === 'admin' ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              {(member.userName || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{member.userName || 'Unknown User'}</p>
              <p className="text-[10px] text-gray-400">Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : ''}</p>
            </div>
            {member.role === 'admin' && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <Crown className="w-3 h-3" /> Admin
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupDetailView({ groupId, onBack }) {
  const { user, socket } = useAuth()
  const navigate = useNavigate()
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('chat')
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => { fetchGroup() }, [groupId])

  const fetchGroup = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/study-groups/${groupId}`)
      if (response.data?.success) setGroup(response.data.data)
    } catch (error) {
      console.error('Failed to fetch group:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!user) { navigate('/login'); return }
    try {
      setJoining(true)
      const res = await api.post(`/api/study-groups/${groupId}/join`)
      if (res.data?.success) fetchGroup()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = async () => {
    const okLeave = await confirmDialog({
      title: 'Leave group?',
      message: 'Leave this group?',
      confirmLabel: 'Leave',
      danger: true,
    })
    if (!okLeave) return
    try {
      setLeaving(true)
      const res = await api.post(`/api/study-groups/${groupId}/leave`)
      if (res.data?.success) fetchGroup()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to leave')
    } finally {
      setLeaving(false)
    }
  }

  const handleDelete = async () => {
    const okDelete = await confirmDialog({
      title: 'Delete group?',
      message: 'Delete this group permanently?',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!okDelete) return
    try {
      await api.delete(`/api/study-groups/${groupId}`)
      navigate('/community')
    } catch (e) {
      toast.error('Failed to delete')
    }
  }

  const isMember = group?.members?.some(m => String(m.userId) === String(user?.id))
  const isAdmin = group?.members?.some(m => String(m.userId) === String(user?.id) && m.role === 'admin')
  const isOwner = String(group?.userId) === String(user?.id)

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'discussions', label: 'Discussions', icon: FileText },
    { id: 'members', label: 'Members', icon: Users },
  ]

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 flex items-center justify-center">
        <div className="text-center"><div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div><p className="text-gray-500 text-sm">Loading group...</p></div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-xl p-8 shadow-sm border border-gray-200 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Group Not Found</h2>
          <p className="text-sm text-gray-500 mb-4">This group doesn't exist or has been removed.</p>
          <button onClick={onBack} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {ConfirmDialog}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">{group.name}</h1>
            <p className="text-[10px] text-gray-400">{group.memberCount || 0} members</p>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition"><Share2 className="w-4 h-4 text-gray-500" /></button>
            {isAdmin && <button className="p-2 hover:bg-gray-100 rounded-lg transition"><Settings className="w-4 h-4 text-gray-500" /></button>}
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex border-t border-gray-100">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all border-b-2 ${
                isActive ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}>
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'chat' && isMember && <ChatTab groupId={groupId} socket={socket} user={user} />}
      {activeTab === 'chat' && !isMember && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <LockIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-3">Join this group to access the chat</p>
            <button onClick={handleJoin} disabled={joining} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">{joining ? 'Joining...' : 'Join Group'}</button>
          </div>
        </div>
      )}
      {activeTab === 'discussions' && isMember && <DiscussionsTab groupId={groupId} user={user} />}
      {activeTab === 'discussions' && !isMember && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <LockIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-3">Join this group to view discussions</p>
            <button onClick={handleJoin} disabled={joining} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">{joining ? 'Joining...' : 'Join Group'}</button>
          </div>
        </div>
      )}
      {activeTab === 'members' && <MembersTab group={group} />}

      {(activeTab === 'chat' || activeTab === 'discussions') && isMember && (
        <div className="border-t border-gray-200 bg-white p-3 flex gap-2">
          {isMember && !isOwner && (
            <button onClick={handleLeave} disabled={leaving} className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition">
              <LogOut className="w-3.5 h-3.5" /> {leaving ? 'Leaving...' : 'Leave Group'}
            </button>
          )}
          {isOwner && (
            <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition">
              <Trash2 className="w-3.5 h-3.5" /> Delete Group
            </button>
          )}
        </div>
      )}
    </div>
  )
}


export default function Community() {
  const { id } = useParams()
  const navigate = useNavigate()

  if (id) {
    return <GroupDetailView groupId={id} onBack={() => navigate('/community')} />
  }

  return <CommunityHubView />
}
