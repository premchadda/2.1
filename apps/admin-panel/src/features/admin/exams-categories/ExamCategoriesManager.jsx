import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, X, Save, ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import apiClient from '../../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import { confirmOnce } from '../../../shared/components/common/ConfirmModal'

export default function ExamCategoriesManager() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  
  const [categoryFormData, setCategoryFormData] = useState({
    id: '',
    label: '',
    icon: '',
    slug: '',
    displayOrder: 0,
    isActive: true
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const catResponse = await apiClient.get('/admin/exam-categories')
      if (catResponse.data?.success) {
        setCategories(catResponse.data.data.sort((a, b) => a.displayOrder - b.displayOrder))
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    
    const payload = {
      ...categoryFormData,
      name: (categoryFormData.name || categoryFormData.label || '').trim(),
      displayOrder: Number(categoryFormData.displayOrder)
    }

    try {
      const url = editingCategoryId 
        ? `/admin/exam-categories/${editingCategoryId}`
        : '/admin/exam-categories'
      
      const response = editingCategoryId 
        ? await apiClient.put(url, payload)
        : await apiClient.post(url, payload)

      if (response.data?.success) {
        toast.success(editingCategoryId ? 'Category updated!' : 'Category created!')
        fetchCategories()
        resetCategoryForm()
      }
    } catch (error) {
      console.error('Failed to save category:', error)
      toast.error('Failed to save category')
    }
  }

  const handleEditCategory = (item) => {
    const categoryId = item.id || item.categoryId || item._id
    setCategoryFormData({
      id: categoryId,
      label: item.label || item.name || '',
      icon: item.icon || '',
      slug: item.slug || '',
      displayOrder: item.displayOrder || 0,
      isActive: item.isActive !== undefined ? item.isActive : true
    })
    setEditingCategoryId(categoryId)
    setShowCategoryForm(true)
  }

  const handleDeleteCategory = async (category) => {
    try {
      const categoryId = category.id || category.categoryId || category._id;
      const seriesResponse = await apiClient.get('/admin/test-series');
      let proceed = false;
      
      if (seriesResponse.data && seriesResponse.data.success) {
        const linkedSeriesCount = seriesResponse.data.data.filter(s => s.category === categoryId || String(s.category) === String(categoryId)).length;
        
        if (linkedSeriesCount > 0) {
          proceed = await confirmOnce({
            title: 'Warning: Linked Test Series',
            message: `WARNING: This exam category has ${linkedSeriesCount} test series attached to it.\n\nDeleting this category will orphan these test series (hide them from the user interface until reassigned).\n\nAre you sure you want to proceed and delete this category?`,
            confirmText: 'Delete Category',
            confirmStyle: 'danger'
          });
        } else {
          proceed = await confirmOnce({
            title: 'Delete Category',
            message: 'Are you sure you want to delete this category?',
            confirmText: 'Delete',
            confirmStyle: 'danger'
          });
        }
      } else {
        proceed = await confirmOnce({
          title: 'Delete Category',
          message: 'Are you sure you want to delete this category?',
          confirmText: 'Delete',
          confirmStyle: 'danger'
        });
      }

      if (!proceed) return;

      const response = await apiClient.delete(`/admin/exam-categories/${categoryId}`)

      if (response.data?.success) {
        toast.success('Category deleted!')
        fetchCategories()
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
      toast.error('Failed to delete category')
    }
  }

  const resetCategoryForm = () => {
    setCategoryFormData({
      id: '',
      label: '',
      icon: '',
      slug: '',
      displayOrder: 0,
      isActive: true
    })
    setEditingCategoryId(null)
    setShowCategoryForm(false)
  }

  if (loading) {
    return <div className="p-4 md:p-6">Loading...</div>
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Exam Categories</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage exam categories (SSC, Railway, Banking, etc.)</p>
        </div>
        <button
          onClick={() => setShowCategoryForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-lg hover:shadow-glow transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingCategoryId ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button onClick={resetCategoryForm} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID {editingCategoryId ? '' : '*'}</label>
                  <input
                    type="text"
                    required={!editingCategoryId}
                    disabled={editingCategoryId}
                    value={categoryFormData.id}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, id: e.target.value })}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start ${editingCategoryId ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-70' : ''}`}
                    placeholder="e.g., ssc, railways"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label *</label>
                  <input
                    type="text"
                    required
                    value={categoryFormData.label}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start"
                    placeholder="e.g., SSC, Railway"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon (Emoji) *</label>
                  <input
                    type="text"
                    required
                    value={categoryFormData.icon}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start"
                    placeholder="📝"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug *</label>
                  <input
                    type="text"
                    required
                    value={categoryFormData.slug}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start"
                    placeholder="ssc"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={categoryFormData.displayOrder}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, displayOrder: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="categoryIsActive"
                    checked={categoryFormData.isActive}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-brand-start border-gray-300 dark:border-gray-600 rounded focus:ring-brand-start"
                  />
                  <label htmlFor="categoryIsActive" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-lg hover:shadow-glow transition-all"
                >
                  <Save className="w-4 h-4" />
                  {editingCategoryId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="space-y-4">
        {categories.map((category) => (
          <div
            key={category._id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{category.icon}</span>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{category.label}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">#{category.id}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  category.isActive 
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {category.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditCategory(category)}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 rounded-lg"
                  title="Edit Category"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(category)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg"
                  title="Delete Category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <FolderOpen className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <div className="flex items-center justify-center gap-2">
            <Folder className="w-6 h-6 text-gray-300" />
            <ChevronRight className="w-4 h-4 text-gray-300" />
            <ChevronDown className="w-4 h-4 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Categories Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Create your first exam category to get started</p>
          <button
            onClick={() => setShowCategoryForm(true)}
            className="px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-lg hover:shadow-glow transition-all"
          >
            Add First Category
          </button>
        </div>
      )}
    </div>
  )
}
