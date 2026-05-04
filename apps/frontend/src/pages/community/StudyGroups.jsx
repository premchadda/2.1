import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Users, Search, Plus, Filter, UserPlus, Lock, 
  Globe, Clock, ChevronRight, X, Crown
} from 'lucide-react'
import SearchBox from '../../shared/components/common/SearchBox'
import { useAuth } from '../../shared/providers/AuthContext'
import api from '../../shared/lib/dataService'

export default function StudyGroups() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [myGroups, setMyGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newGroup, setNewGroup] = useState({ 
    name: '', 
    description: '', 
    category: 'general',
    isPrivate: false,
    maxMembers: 50
  })

  useEffect(() => {
    fetchData()
  }, [selectedCategory])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [groupsRes, categoriesRes, myGroupsRes] = await Promise.all([
        api.get(`/api/study-groups?category=${selectedCategory}`),
        api.get('/api/study-groups/categories'),
        user ? api.get('/api/study-groups/my') : Promise.resolve({ data: { data: [] } })
      ])
      if (groupsRes.data?.success) {
        setGroups(groupsRes.data.data)
      }
      if (categoriesRes.data?.success) {
        setCategories(categoriesRes.data.data)
      }
      if (myGroupsRes.data?.success) {
        setMyGroups(myGroupsRes.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const response = await api.get(`/api/study-groups?search=${searchQuery}&category=${selectedCategory}`)
      if (response.data?.success) {
        setGroups(response.data.data)
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!user) {
      navigate('/login')
      return
    }
    try {
      const response = await api.post('/api/study-groups', newGroup)
      if (response.data?.success) {
        setShowCreateForm(false)
        setNewGroup({ name: '', description: '', category: 'general', isPrivate: false, maxMembers: 50 })
        fetchData()
        navigate(`/study-groups/${response.data.data._id || response.data.data.id}`)
      }
    } catch (error) {
      console.error('Failed to create group:', error)
      alert('Failed to create group')
    }
  }

  const handleJoinGroup = async (groupId) => {
    if (!user) {
      navigate('/login')
      return
    }
    try {
      const response = await api.post(`/api/study-groups/${groupId}/join`)
      if (response.data?.success) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to join group:', error)
      alert(error.response?.data?.message || 'Failed to join group')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Study Groups
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Join study groups and learn together with peers
            </p>
          </div>
          <button
            onClick={() => user ? setShowCreateForm(true) : navigate('/login')}
            className="mt-4 md:mt-0 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-5 h-5" />
            Create Group
          </button>
        </div>

        {/* My Groups */}
        {myGroups.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">My Groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myGroups.map(group => (
                <Link
                  key={group._id || group.id}
                  to={`/study-groups/${group._id || group.id}`}
                  className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white hover:shadow-lg transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg">{group.name}</h3>
                    {group.role === 'admin' && <Crown className="w-5 h-5 text-yellow-300" />}
                  </div>
                  <p className="text-indigo-100 text-sm line-clamp-2 mb-3">{group.description}</p>
                  <div className="flex items-center gap-2 text-sm text-indigo-100">
                    <Users className="w-4 h-4" />
                    {group.memberCount || 0} members
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Compact Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 mb-4">
          <div className="flex flex-row items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-shrink-0"
            >
              <option value="all">All</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex-shrink-0"
            >
              Search
            </button>
            <span className="text-xs text-gray-500 hidden md:inline">{groups.length} groups</span>
          </div>
        </div>

        {/* Create Group Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Study Group</h2>
                <button onClick={() => setShowCreateForm(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                    placeholder="e.g., SSC CGL 2026 Group"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                    placeholder="What's this group about?"
                    required
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newGroup.category}
                    onChange={(e) => setNewGroup({ ...newGroup, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newGroup.isPrivate}
                      onChange={(e) => setNewGroup({ ...newGroup, isPrivate: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Private Group</span>
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Create Group
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Groups Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading groups...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No groups found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Be the first to create a study group!</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Create the first group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div
                key={group._id || group.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {group.isPrivate ? (
                        <Lock className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Globe className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {categories.find(c => c.id === group.category)?.icon} {group.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {group.name}
                    </h3>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4">
                  {group.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    {group.memberCount || 0} / {group.maxMembers || 50} members
                  </div>
                  <button
                    onClick={() => handleJoinGroup(group._id || group.id)}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Join <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
