import { useState, useEffect } from 'react'
import { Upload, FileText, Video, FileImage, Trash2, Download, Eye, X, Search, Filter, Grid, List, Copy, Check } from 'lucide-react'
import { apiClient } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'

export default function MediaLibrary() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'images', 'videos', 'documents', 'pdfs'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileStats, setFileStats] = useState({ total: 0, size: 0, images: 0, videos: 0, documents: 0 });
  const [copiedAssetId, setCopiedAssetId] = useState(null);
  const [updatingCategoryId, setUpdatingCategoryId] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, []);

const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/assets');
      if (response.data?.success) {
        setFiles(response.data.data);
        calculateStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
      toast.error('Failed to load media files');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (files) => {
    const stats = {
      total: files.length,
      size: files.reduce((sum, file) => sum + (file.size || 0), 0),
      images: files.filter(f => f.type?.startsWith('image')).length,
      videos: files.filter(f => f.type?.startsWith('video')).length,
      documents: files.filter(f => f.type?.includes('pdf') || f.type?.includes('document')).length
    };
    setFileStats(stats);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const response = await api.post('/admin/assets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

if (response.data?.success) {
        toast.success('File uploaded successfully');
        fetchFiles();
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      event.target.value = ''
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) return;

    try {
      const response = await apiClient.delete(`/admin/assets/${fileId}`);
      if (response.data?.success) {
        toast.success('File deleted successfully');
        fetchFiles();
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedFiles.length} files?`)) return;

    try {
      await Promise.all(selectedFiles.map(id => apiClient.delete(`/admin/assets/${id}`)));
      toast.success(`${selectedFiles.length} files deleted successfully`);
      fetchFiles();
      setSelectedFiles([]);
    } catch (error) {
      console.error('Failed to bulk delete files:', error);
      toast.error('Failed to delete some files');
    }
  };

  const getFileIcon = (type) => {
    if (type?.startsWith('image')) return <FileImage className="w-8 h-8 text-green-500" />;
    if (type?.startsWith('video')) return <Video className="w-8 h-8 text-red-500" />;
    if (type?.includes('pdf')) return <FileText className="w-8 h-8 text-red-600" />;
    if (type?.includes('doc') || type?.includes('word')) return <FileText className="w-8 h-8 text-blue-600" />;
    return <FileText className="w-8 h-8 text-gray-500" />;
  };

  const getFileExtension = (filename) => {
    if (!filename || !String(filename).includes('.')) return 'FILE';
    return String(filename).split('.').pop().toUpperCase();
  };

  const getFileSize = (size) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileType = (type) => {
    if (type?.startsWith('image')) return 'image'
    if (type?.startsWith('video')) return 'video'
    if (type?.includes('pdf')) return 'document'
    if (type?.includes('doc') || type?.includes('word')) return 'document'
    return 'other'
  };

  const filteredFiles = files.filter(file => {
    const filename = String(file.filename || '');
    const originalName = String(file.originalName || file.name || '');
    const matchesSearch = filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         originalName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || getFileType(file.type) === filterType;
    return matchesSearch && matchesFilter;
  });

  const toggleSelectFile = (fileId) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredFiles.map(f => f._id));
    }
  };

  const handlePreview = (file) => {
    if (file.type?.startsWith('image')) {
      setPreviewUrl(file.url);
    } else if (file.type?.startsWith('video')) {
      setPreviewUrl(file.url);
    } else {
      // For documents, we can download or open in new tab
      window.open(file.url, '_blank');
    }
  };

const handleCopyUrl = async (file) => {
    if (!file?.url) return;
    try {
      await navigator.clipboard.writeText(file.url);
      setCopiedAssetId(file._id);
      setTimeout(() => setCopiedAssetId(null), 1500);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy URL');
    }
  };

  const handleCategoryChange = async (file, category) => {
    if (!file?._id || !category || category === file.category) return;

    try {
      setUpdatingCategoryId(file._id);
      const response = await apiClient.patch(`/admin/assets/${file._id}`, { category });
      if (response.data?.success) {
        setFiles((prev) => prev.map((item) => item._id === file._id ? { ...item, category } : item));
      }
    } catch (error) {
      console.error('Failed to update category:', error);
      toast.error('Failed to update category');
    } finally {
      setUpdatingCategoryId(null);
    }
  };

  const categoryOptions = [
    'image',
    'video',
    'pdf',
    'document',
    'icon',
    'emoji',
    'question-diagram',
    'test-banner',
    'promotion-banner'
  ];

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
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="text-gray-600 mt-1">
            Upload, manage, and organize all media files for the platform
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            {fileStats.total} files • {getFileSize(fileStats.size)} total
          </div>
          <label className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition cursor-pointer">
            <Upload className="w-5 h-5" />
            Upload File
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Files</p>
              <p className="text-xl font-bold text-gray-900">{fileStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <FileImage className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Images</p>
              <p className="text-xl font-bold text-gray-900">{fileStats.images}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Video className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Videos</p>
              <p className="text-xl font-bold text-gray-900">{fileStats.videos}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Documents</p>
              <p className="text-xl font-bold text-gray-900">{fileStats.documents}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="document">Documents</option>
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg border ${viewMode === 'grid' ? 'bg-indigo-100 border-indigo-300' : 'bg-white border-gray-300'}`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg border ${viewMode === 'list' ? 'bg-indigo-100 border-indigo-300' : 'bg-white border-gray-300'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedFiles.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="text-sm text-yellow-800">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedFiles([])}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* File Grid/List */}
      {filteredFiles.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file._id}
                className={`bg-white rounded-lg border-2 p-4 transition-all ${
                  selectedFiles.includes(file._id) 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(file._id)}
                    onChange={() => toggleSelectFile(file._id)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreview(file)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={file.url}
                      download
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleCopyUrl(file)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Copy URL"
                    >
                      {copiedAssetId === file._id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(file._id)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  {getFileIcon(file.type)}
                  <p className="text-xs text-gray-500 mt-2 font-mono">{getFileExtension(file.filename)}</p>
                  <p className="text-sm font-medium text-gray-900 mt-2 line-clamp-2">{file.originalName}</p>
                  <p className="text-xs text-gray-500 mt-1">{getFileSize(file.size)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(file.uploadDate).toLocaleDateString()}
                  </p>
                  <select
                    value={file.category || getFileType(file.type)}
                    onChange={(e) => handleCategoryChange(file, e.target.value)}
                    disabled={updatingCategoryId === file._id}
                    className="mt-2 w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-700">
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-1">Actions</div>
            </div>
            <div className="divide-y divide-gray-200">
              {filteredFiles.map((file) => (
                <div
                  key={file._id}
                  className={`grid grid-cols-12 gap-4 p-4 items-center ${
                    selectedFiles.includes(file._id) ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file._id)}
                      onChange={() => toggleSelectFile(file._id)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-4 flex items-center gap-3">
                    {getFileIcon(file.type)}
                    <div>
                      <p className="font-medium text-gray-900 truncate max-w-xs">{file.originalName}</p>
                      <p className="text-xs text-gray-500 font-mono">{file.filename}</p>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={file.category || getFileType(file.type)}
                      onChange={(e) => handleCategoryChange(file, e.target.value)}
                      disabled={updatingCategoryId === file._id}
                      className="text-sm border border-gray-200 rounded px-2 py-1 bg-white w-full"
                    >
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm text-gray-600">{getFileSize(file.size)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm text-gray-600">
                      {new Date(file.uploadDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="col-span-1 flex gap-2">
                    <button
                      onClick={() => handlePreview(file)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={file.url}
                      download
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleCopyUrl(file)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Copy URL"
                    >
                      {copiedAssetId === file._id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(file._id)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No files found</p>
          <p className="text-sm text-gray-400 mb-6">Upload your first media file to get started</p>
          <label className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition cursor-pointer">
            <Upload className="w-5 h-5" />
            Upload File
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />
          </label>
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-full overflow-auto relative">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-4">
              {previewUrl.endsWith('.mp4') || previewUrl.endsWith('.webm') || previewUrl.endsWith('.ogg') ? (
                <video
                  src={previewUrl}
                  controls
                  className="max-w-full max-h-96 rounded-lg"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-96 rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          <span className="text-gray-700">Uploading file...</span>
        </div>
      )}
    </div>
  );
}
