import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, X, Save, Tag } from 'lucide-react'
import { apiClient } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'

export default function TagConfigsManager() {
  const [tagConfigs, setTagConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    label: '',
    description: '',
    icon: '',
    color: 'blue',
    route: '',
    filterKey: '',
    filterValue: '',
    isActive: true
  });

  const colorOptions = [
    { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
    { value: 'green', label: 'Green', class: 'bg-green-500' },
    { value: 'red', label: 'Red', class: 'bg-red-500' },
    { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
    { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
    { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
    { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
    { value: 'orange', label: 'Orange', class: 'bg-orange-500' }
  ];

  useEffect(() => {
    fetchTagConfigs();
  }, []);

  const fetchTagConfigs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/tag-configs');
      if (response.data?.success) {
        setTagConfigs(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tag configs:', error);
      toast.error('Failed to load tag configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let response;
      if (editingId) {
        response = await apiClient.put(`/admin/tag-configs/${editingId}`, formData);
      } else {
        response = await apiClient.post('/admin/tag-configs', formData);
      }

      if (response.data?.success) {
        toast.success(editingId ? 'Tag config updated!' : 'Tag config created!');
        fetchTagConfigs();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save tag config:', error);
      toast.error('Failed to save tag configuration');
    }
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id || item._id,
      label: item.label,
      description: item.description || '',
      icon: item.icon || '',
      color: item.color || 'blue',
      route: item.route || '',
      filterKey: item.filterKey || '',
      filterValue: item.filterValue || '',
      isActive: item.isActive !== undefined ? item.isActive : true
    });
    setEditingId(item._id || item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this tag configuration?')) return;

    try {
      const response = await apiClient.delete(`/admin/tag-configs/${id}`);
      if (response.data?.success) {
        toast.success('Tag config deleted!');
        fetchTagConfigs();
      }
    } catch (error) {
      console.error('Failed to delete tag config:', error);
      toast.error('Failed to delete tag configuration');
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      label: '',
      description: '',
      icon: '',
      color: 'blue',
      route: '',
      filterKey: '',
      filterValue: '',
      isActive: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getColorClass = (color) => {
    const colorMap = {
      blue: 'bg-blue-500 text-white',
      green: 'bg-green-500 text-white',
      red: 'bg-red-500 text-white',
      yellow: 'bg-yellow-500 text-white',
      purple: 'bg-purple-500 text-white',
      indigo: 'bg-indigo-500 text-white',
      pink: 'bg-pink-500 text-white',
      orange: 'bg-orange-500 text-white'
    };
    return colorMap[color] || colorMap.blue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tag Configuration Manager</h1>
          <p className="text-gray-600 mt-1">
            Manage tag-based filtering and quick access categories (Live Tests, PYPs, Quizzes, etc.)
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5" />
          Add Tag Config
        </button>
      </div>

      {/* Tag Configs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tagConfigs.map((tag) => (
          <div
            key={tag._id || tag.id}
            className={`bg-white rounded-lg shadow-sm border-2 p-4 transition-all ${
              tag.isActive ? 'border-gray-200 hover:border-indigo-300' : 'border-gray-300 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${getColorClass(tag.color)}`}>
                {tag.icon ? (
                  <i data-lucide={tag.icon} className="w-6 h-6"></i>
                ) : (
                  <Tag className="w-6 h-6" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(tag)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(tag._id || tag.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <h3 className="font-bold text-lg text-gray-900 mb-1">{tag.label}</h3>
            <p className="text-sm text-gray-600 mb-3">{tag.description || 'No description'}</p>
            
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-t border-gray-100">
                <span className="text-gray-500">ID:</span>
                <span className="font-mono text-gray-900">{tag.id}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-t border-gray-100">
                <span className="text-gray-500">Route:</span>
                <span className="font-mono text-gray-900">{tag.route || 'N/A'}</span>
              </div>
              {tag.filterKey && (
                <div className="flex items-center justify-between py-1 border-t border-gray-100">
                  <span className="text-gray-500">Filter:</span>
                  <span className="font-mono text-gray-900">{tag.filterKey}: {tag.filterValue}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1 border-t border-gray-100">
                <span className="text-gray-500">Status:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  tag.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {tag.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ))}

        {tagConfigs.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-lg border border-gray-200">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No tag configurations found</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Create your first tag config
            </button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit' : 'Add'} Tag Configuration
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tag ID * <span className="text-xs text-gray-500">(unique identifier)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., live-tests, pyp"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label *
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., Live Tests"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Brief description of this tag category"
                  />
                </div>
              </div>

              {/* Appearance */}
              <div className="border-t pt-4">
                <h3 className="text-md font-semibold text-gray-900 mb-3">Appearance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Icon (Lucide)
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., radio, book-open"
                    />
                    <p className="text-xs text-gray-500 mt-1">Visit: lucide.dev/icons</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Color
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {colorOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: option.value })}
                          className={`h-10 rounded-lg ${option.class} ${
                            formData.color === option.value ? 'ring-2 ring-offset-2 ring-gray-900' : ''
                          } transition`}
                          title={option.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Routing & Filtering */}
              <div className="border-t pt-4">
                <h3 className="text-md font-semibold text-gray-900 mb-3">Routing & Filtering</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route
                    </label>
                    <input
                      type="text"
                      value={formData.route}
                      onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="/tag/live-tests"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter Key
                    </label>
                    <input
                      type="text"
                      value={formData.filterKey}
                      onChange={(e) => setFormData({ ...formData, filterKey: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., tag, category"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter Value
                    </label>
                    <input
                      type="text"
                      value={formData.filterValue}
                      onChange={(e) => setFormData({ ...formData, filterValue: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., live-test, mock"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active (visible to users)
                </label>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
                >
                  <Save className="w-5 h-5" />
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
