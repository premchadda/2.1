import { useState, useEffect } from 'react'
import { 
  Trash2, RotateCcw, Search, Filter, 
  Calendar, User, Package, FileText, 
  BookOpen, FolderTree, Tag, Navigation, Info,
  ChevronRight, MoreVertical, X,
  AlertTriangle 
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../../../shared/lib/dataService.js'

// Collection type icons mapping
const collectionIcons = {
  'testSeries': FileText,
  'tests': BookOpen,
  'questions': Package,
  'studyMaterials': BookOpen,
  'examCategories': FolderTree,
  'examInfo': Info,
  'navigationMenu': Navigation,
  'tagConfigs': Tag,
  'testCategories': FolderTree,
  'users': User,
  'media': Trash2,
  'trash': Trash2 // fallback
};

export default function RecycleBin() {
  const [trashItems, setTrashItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showActions, setShowActions] = useState({});
  const [stats, setStats] = useState({
    total: 0,
    byType: {}
  });
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, title: '', message: '', confirmLabel: '', danger: false });

  const navigate = useNavigate();

  // Fetch trash items
  useEffect(() => {
    const fetchTrashItems = async () => {
      try {
        const response = await adminAPI.getTrash()
        
        if (response.data.success) {
          setTrashItems(response.data.data || []);
          calculateStats(response.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching trash items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrashItems();
  }, []);

  // Calculate statistics
  const calculateStats = (items) => {
    const byType = {};
    items.forEach(item => {
      const type = item.originalCollection || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    setStats({
      total: items.length,
      byType
    });
  };

  // Filter items based on search and type
  useEffect(() => {
    let filtered = trashItems;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.originalCollection || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.originalCollection === selectedType);
    }

    // Apply date filter
    if (dateFilter) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.deletedAt);
        const filterDate = new Date(dateFilter);
        return itemDate.toDateString() === filterDate.toDateString();
      });
    }

    setFilteredItems(filtered);
  }, [trashItems, searchTerm, selectedType, dateFilter]);

  // Restore an item from trash
  const restoreItem = async (itemId) => {
    try {
      const response = await adminAPI.restoreTrashItem(itemId)

      if (response.data.success) {
        // Remove item from trash list
        setTrashItems(prev => prev.filter(item => item._id !== itemId));
        setShowActions(prev => ({ ...prev, [itemId]: false }));
        
        // Recalculate stats
        const updatedItems = trashItems.filter(item => item._id !== itemId);
        calculateStats(updatedItems);
      }
    } catch (error) {
      console.error('Error restoring item:', error);
    }
  };

  // Permanently delete an item
  const deletePermanently = async (itemId) => {
    setConfirmModal({
      open: true,
      action: () => performDeletePermanently(itemId),
      title: 'Delete Permanently',
      message: 'Are you sure you want to permanently delete this item? This action cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
  };

  const performDeletePermanently = async (itemId) => {
    try {
      const response = await adminAPI.deleteTrashItem(itemId)

      if (response.data.success) {
        // Remove item from trash list
        setTrashItems(prev => prev.filter(item => item._id !== itemId));
        setShowActions(prev => ({ ...prev, [itemId]: false }));
        
        // Recalculate stats
        const updatedItems = trashItems.filter(item => item._id !== itemId);
        calculateStats(updatedItems);
      }
    } catch (error) {
      console.error('Error permanently deleting item:', error);
    }
  };

  // Empty entire trash
  const emptyTrash = async () => {
    setConfirmModal({
      open: true,
      action: performEmptyTrash,
      title: 'Empty Trash',
      message: 'Are you sure you want to empty the entire trash? This action cannot be undone.',
      confirmLabel: 'Empty Trash',
      danger: true,
    });
  };

  const performEmptyTrash = async () => {
    try {
      const response = await adminAPI.emptyTrash()

      if (response.data.success) {
        setTrashItems([]);
        setFilteredItems([]);
        setStats({ total: 0, byType: {} });
      }
    } catch (error) {
      console.error('Error emptying trash:', error);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get item title based on type
  const getItemTitle = (item) => {
    return item.title || item.name || item.originalName || item._id || 'Untitled'
  };

  // Get item description based on type
  const getItemDescription = (item) => {
    switch (item.originalCollection) {
      case 'testSeries':
        return `Test series with ${item.tests?.length || 0} tests`;
      case 'tests':
        return `Test with ${item.questions?.length || 0} questions`;
      case 'questions':
        return `Question from test: ${item.testId}`;
      case 'studyMaterials':
        return `Subject: ${item.subject || 'Unknown'}`;
      case 'examCategories':
        return `Category for: ${item.examType || 'All exams'}`;
      case 'examInfo':
        return `Details for ${item.category || 'exam'}`;
      case 'navigationMenu':
        return `Navigation item: ${item.label || 'Unknown'}`;
      case 'tagConfigs':
        return `Tag configuration for: ${item.tag || 'Unknown'}`;
      case 'testCategories':
        return `Category in ${item.parentId ? 'sub-category' : 'main category'}`;
      default:
        return `Deleted item from ${item.originalCollection}`;
    }
  };

  // Get icon for collection type
  const getIcon = (collectionType) => {
    const IconComponent = collectionIcons[collectionType] || Trash2;
    return <IconComponent className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading trash items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Recycle Bin</h1>
                  <p className="text-gray-600">Manage deleted content and restore items</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={emptyTrash}
                  disabled={trashItems.length === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Empty Trash
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-full">
                <Trash2 className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>

          {Object.entries(stats.byType).slice(0, 3).map(([type, count]) => (
            <div key={type} className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 capitalize">{(type || 'unknown').replace(/([A-Z])/g, ' $1')}</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-full">
                  {getIcon(type)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {Object.keys(stats.byType).map(type => (
                <option key={type} value={type}>{type.replace(/([A-Z])/g, ' $1')}</option>
              ))}
            </select>
            
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            <div className="text-sm text-gray-600 flex items-center">
              Showing {filteredItems.length} of {trashItems.length} items
            </div>
          </div>
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border">
            <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No items in trash</h3>
            <p className="text-gray-600">Deleted items will appear here and can be restored if needed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div key={item._id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {getIcon(item.originalCollection)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {getItemTitle(item)}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {(item.originalCollection || 'unknown').replace(/([A-Z])/g, ' $1')}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-2">
                        {getItemDescription(item)}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Deleted {formatDate(item.deletedAt)}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>by {item.deletedBy || 'System'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button
                      onClick={() => setShowActions(prev => ({
                        ...prev,
                        [item._id]: !prev[item._id]
                      }))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>
                    
                    {showActions[item._id] && (
                      <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48">
                        <button
                          onClick={() => restoreItem(item._id)}
                          className="w-full px-4 py-2 text-left hover:bg-green-50 text-green-700 flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Restore Item
                        </button>
                        
                        <hr className="my-1" />
                        
                        <button
                          onClick={() => deletePermanently(item._id)}
                          className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-700 flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Delete Permanently
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${confirmModal.danger ? 'bg-red-100' : 'bg-amber-100'}`}>
                <AlertTriangle className={`w-6 h-6 ${confirmModal.danger ? 'text-red-600' : 'text-amber-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{confirmModal.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{confirmModal.message}</p>
              </div>
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmModal(prev => ({ ...prev, open: false }));
                  if (confirmModal.action) await confirmModal.action();
                }}
                className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition-all ${confirmModal.danger ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
