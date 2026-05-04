import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, X, Save, Image, Eye, EyeOff, GripVertical } from 'lucide-react'
import { adminAPI } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'

export default function BannerManager() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    link: '',
    position: 'home',
    isActive: true,
    startDate: '',
    endDate: '',
    order: 0
  })

  useEffect(() => {
    fetchBanners()
  }, [])

  const fetchBanners = async () => {
    try {
      const response = await adminAPI.getBanners()
      if (response.data.success) {
        setBanners(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch banners:', error)
      setBanners([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      let response
      if (editingId) {
        response = await adminAPI.updateBanner(editingId, formData)
      } else {
        response = await adminAPI.createBanner(formData)
      }

      if (response.data?.success) {
        fetchBanners()
        resetForm()
        toast.success(editingId ? 'Banner updated!' : 'Banner created!')
      }
    } catch (error) {
      console.error('Failed to save banner:', error)
      toast.error('Failed to save banner')
    }
  }

  const handleEdit = (banner) => {
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      imageUrl: banner.imageUrl || '',
      link: banner.link || '',
      position: banner.position || 'home',
      isActive: banner.isActive !== false,
      startDate: banner.startDate?.slice(0, 10) || '',
      endDate: banner.endDate?.slice(0, 10) || '',
      order: banner.order || 0
    })
    setEditingId(banner._id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this banner?')) return

    try {
      const response = await adminAPI.deleteBanner(id)
      if (response.data?.success) {
        toast.success('Banner deleted!')
        fetchBanners()
      }
    } catch (error) {
      console.error('Failed to delete banner:', error)
      toast.error('Failed to delete banner')
    }
  }

  const toggleActive = async (banner) => {
    try {
      const response = await adminAPI.updateBanner(banner._id, { 
        ...banner, 
        isActive: !banner.isActive 
      })
      if (response.data.success) {
        fetchBanners()
      }
    } catch (error) {
      console.error('Failed to toggle banner:', error)
    }
  }

  const resetForm = () => {
    setFormData({ title: '', subtitle: '', imageUrl: '', link: '', position: 'home', isActive: true, startDate: '', endDate: '', order: 0 })
    setEditingId(null)
    setShowForm(false)
  }

  const positions = [
    { value: 'home', label: 'Homepage' },
    { value: 'test_series', label: 'Test Series' },
    { value: 'live', label: 'Live Tests' },
    { value: 'study', label: 'Study Materials' }
  ]

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banner Manager</h1>
          <p className="text-gray-600">Manage homepage and promotional banners</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          Add Banner
        </button>
      </div>

      {/* Banners Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banners.map((banner) => (
          <div key={banner._id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {/* Banner Preview */}
            <div className="h-40 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
              {banner.imageUrl ? (
                <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-12 h-12 text-white/50" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => toggleActive(banner)}
                  className={`p-1 rounded ${banner.isActive ? 'bg-green-500' : 'bg-gray-500'}`}
                >
                  {banner.isActive ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-white" />}
                </button>
              </div>
              <div className="absolute bottom-2 left-2">
                <span className={`px-2 py-1 text-xs rounded ${banner.isActive ? 'bg-green-500' : 'bg-gray-500'} text-white`}>
                  {banner.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-1">{banner.title}</h3>
              <p className="text-sm text-gray-500 mb-3">{banner.subtitle}</p>
              
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span className="px-2 py-1 bg-gray-100 rounded">{banner.position}</span>
                <span>Order: {banner.order}</span>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(banner)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(banner._id)}
                  className="py-2 px-3 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl">
          <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No banners found</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingId ? 'Edit Banner' : 'Add New Banner'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({...formData, subtitle: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({...formData, link: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="/test-series"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    <select
                      value={formData.position}
                      onChange={(e) => setFormData({...formData, position: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {positions.map(pos => (
                        <option key={pos.value} value={pos.value}>{pos.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({...formData, order: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    <Save className="w-4 h-4" />
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
