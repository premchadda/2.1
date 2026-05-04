import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { logger } from '@trstprep/shared-config';

/**
 * Generic CRUD Hook for Admin Managers
 * Eliminates 95%+ duplication across 30+ manager components
 *
 * @param {Object} config - Configuration object
 * @param {string} config.endpoint - API endpoint (e.g., '/subjects', '/banners')
 * @param {Object} config.api - API service to use (api or adminAPI)
 * @param {Object} config.defaultFormData - Default form data structure
 * @param {Function} config.getSuccessMessage - Function to get success messages
 * @param {Function} config.getErrorMessage - Function to get error messages
 * @param {boolean} config.useAdminAPI - Whether to use adminAPI (default: false)
 * @returns {Object} CRUD operations and state
 */
export const useGenericCRUD = ({
  endpoint,
  api,
  defaultFormData = {},
  getSuccessMessage = (action, itemName) => `${itemName} ${action}d successfully!`,
  getErrorMessage = (action, itemName) => `Failed to ${action} ${itemName}`,
  useAdminAPI = false
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);

  // Fetch all items with optional query parameters
  const fetchItems = useCallback(async (queryParams = {}) => {
    try {
      setLoading(true);
      const response = await api.get(endpoint, { params: queryParams });
      if (response.data.success) {
        setItems(response.data.data || []);
        return response.data.data || [];
      } else {
        setItems([]);
        return [];
      }
     } catch (error) {
       logger.error(`Failed to fetch ${endpoint}:`, error);
       setItems([]);
       return [];
    } finally {
      setLoading(false);
    }
  }, [api, endpoint]);

  // Create or update item
  const saveItem = useCallback(async (customData = null, id = null) => {
    const dataToSave = customData || formData;
    const itemId = id || editingId;
    const isEditing = !!itemId;

    try {
      let response;
      if (isEditing) {
        response = await api.put(`${endpoint}/${itemId}`, dataToSave);
      } else {
        response = await api.post(endpoint, dataToSave);
      }

      if (response.data.success) {
        await fetchItems();
        resetForm();
        const action = isEditing ? 'update' : 'create';
        const itemName = endpoint.replace(/^\//, '').replace(/s$/, ''); // Remove leading slash and plural 's'
        toast.success(getSuccessMessage(action, itemName));
        return true;
      }
      return false;
     } catch (error) {
       logger.error(`Failed to save ${endpoint}:`, error);
       const action = isEditing ? 'update' : 'create';
      const itemName = endpoint.replace(/^\//, '').replace(/s$/, '');
      toast.error(getErrorMessage(action, itemName));
      return false;
    }
  }, [api, endpoint, editingId, formData, fetchItems, getSuccessMessage, getErrorMessage]);

  // Delete item
  const deleteItem = useCallback(async (id, confirmMessage = 'Are you sure you want to delete this item?') => {
    if (!confirm(confirmMessage)) return false;

    try {
      const response = await api.delete(`${endpoint}/${id}`);
      if (response.data.success) {
        setItems(prev => prev.filter(item => item._id !== id && item.id !== id));
        await fetchItems(); // Refresh to ensure consistency
        const itemName = endpoint.replace(/^\//, '').replace(/s$/, '');
        toast.success(getSuccessMessage('delete', itemName));
        return true;
      }
      return false;
     } catch (error) {
       logger.error(`Failed to delete ${endpoint}:`, error);
       const itemName = endpoint.replace(/^\//, '').replace(/s$/, '');
      toast.error(getErrorMessage('delete', itemName));
      return false;
    }
  }, [api, endpoint, fetchItems, getSuccessMessage, getErrorMessage]);

  // Edit item (populate form)
  const editItem = useCallback((item) => {
    setFormData({ ...defaultFormData, ...item });
    setEditingId(item._id || item.id);
    setShowForm(true);
  }, [defaultFormData]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData(defaultFormData);
    setEditingId(null);
    setShowForm(false);
  }, [defaultFormData]);

  // Toggle active status with optimistic update and rollback on error
  const toggleActive = useCallback(async (item) => {
    const originalItem = { ...item }
    const updatedData = { ...item, isActive: !item.isActive }
    
    // Optimistic update
    setItems(prev => prev.map(i =>
      (i._id === item._id || i.id === item.id) ? updatedData : i
    ))

    try {
      const response = await api.put(`${endpoint}/${item._id || item.id}`, updatedData)
      if (response.data.success) {
        const itemName = endpoint.replace(/^\//, '').replace(/s$/, '')
        toast.success(`${itemName} ${updatedData.isActive ? 'activated' : 'deactivated'}!`)
        return true
      }
      // If API returns success false, rollback
      setItems(prev => prev.map(i =>
        (i._id === item._id || i.id === item.id) ? originalItem : i
      ))
      toast.error(`Failed to toggle ${endpoint.replace(/^\//, '').replace(/s$/, '')}`)
      return false
    } catch (error) {
      logger.error(`Failed to toggle ${endpoint}:`, error)
      // Rollback on network or server error
      setItems(prev => prev.map(i =>
        (i._id === item._id || i.id === item.id) ? originalItem : i
      ))
      const itemName = endpoint.replace(/^\//, '').replace(/s$/, '')
      toast.error(`Failed to toggle ${itemName}`)
      return false
    }
  }, [api, endpoint])

  // Initialize on mount
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    // State
    items,
    loading,
    showForm,
    editingId,
    formData,
    setFormData,
    setShowForm,

    // Actions
    fetchItems,
    saveItem,
    deleteItem,
    editItem,
    resetForm,
    toggleActive,

    // Utilities
    setItems,
    setLoading
  };
};