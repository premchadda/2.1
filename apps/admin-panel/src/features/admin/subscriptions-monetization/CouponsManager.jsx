import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, Ticket, Copy, Check, X, Save, Tag, Calendar } from 'lucide-react'
import { apiClient } from '../../../shared/lib/dataService.js'
import { useTestCategories } from '../../../shared/hooks/useTestCategories'
import { toast } from 'react-hot-toast'
import { confirmOnce } from '../../../shared/components/common/ConfirmModal'

const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount (₹)' }
]

const APPLICABLE_PLANS = [
  { value: 'pro-monthly', label: 'Pro Monthly' },
  { value: 'pro-yearly', label: 'Pro Yearly' },
  { value: 'test-series', label: 'Test Series' },
  { value: 'all', label: 'All Plans' }
]

export default function CouponsManager() {
  const { getRootCategoryNames } = useTestCategories()
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscount: 500,
    minOrderValue: 0,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    usageLimit: 100,
    userUsageLimit: 1,
    applicablePlans: ['all'],
    applicableCategories: ['All'],
    isActive: true
  })

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/admin/coupons', { params: { includeInactive: 'true' } })
      if (response.data?.success) {
        setCoupons(response.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch coupons:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        minPurchase: formData.minOrderValue ?? formData.minPurchase,
        maxUses: formData.usageLimit ?? formData.maxUses,
      }
      if (editingCoupon) {
        const couponId = editingCoupon.id || editingCoupon._id
        await apiClient.put(`/admin/coupons/${couponId}`, payload)
        toast.success('Coupon updated successfully')
      } else {
        await apiClient.post('/admin/coupons', { ...payload, usageCount: 0 })
        toast.success('Coupon created successfully')
      }
      fetchCoupons()
      resetForm()
    } catch (error) {
      console.error('Failed to save coupon:', error)
      toast.error('Failed to save coupon')
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: 'Delete Coupon',
      message: 'Are you sure you want to delete this coupon?',
      danger: true
    })
    if (!confirmed) return
    try {
      await apiClient.delete(`/admin/coupons/${id}`)
      toast.success('Coupon deleted successfully')
      fetchCoupons()
    } catch (error) {
      console.error('Failed to delete coupon:', error)
      toast.error('Failed to delete coupon')
    }
  }

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount,
      minOrderValue: coupon.minOrderValue,
      validFrom: (coupon.validFrom || coupon.valid_from || '')?.split('T')[0] || '',
      validUntil: (coupon.validUntil || coupon.valid_until || '')?.split('T')[0] || '',
      usageLimit: coupon.usageLimit,
      userUsageLimit: coupon.userUsageLimit,
      applicablePlans: coupon.applicablePlans,
      applicableCategories: coupon.applicableCategories,
      isActive: coupon.isActive
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingCoupon(null)
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscount: 500,
      minOrderValue: 0,
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      usageLimit: 100,
      userUsageLimit: 1,
      applicablePlans: ['all'],
      applicableCategories: ['All'],
      isActive: true
    })
    setShowForm(false)
  }

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, code }))
  }

  const isExpired = (validUntil) => {
    return new Date(validUntil) < new Date()
  }

  const isExhausted = (coupon) => {
    const maxUses = coupon.maxUses ?? coupon.usageLimit
    const usedCount = coupon.usedCount ?? coupon.usageCount ?? 0
    return maxUses && usedCount >= maxUses
  }

  const filteredCoupons = coupons.filter(coupon =>
    coupon.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (coupon.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Coupons Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage discount coupons</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Coupon
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search coupons by code or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCoupons.map(coupon => {
          const expired = isExpired(coupon.validUntil)
          const exhausted = isExhausted(coupon)
          const maxUses = coupon.maxUses ?? coupon.usageLimit
          const usedCount = coupon.usedCount ?? coupon.usageCount ?? 0
          const usagePercentage = maxUses ? (usedCount / maxUses) * 100 : 0

          return (
            <div
              key={coupon._id || coupon.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border overflow-hidden transition hover:shadow-md ${
                expired || exhausted || !coupon.isActive ? 'opacity-60' : ''
              }`}
            >
              {/* Card Header with Pattern */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    <span className="font-mono font-bold text-lg">{coupon.code}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(coupon.code)}
                    className="p-1 hover:bg-white/20 rounded transition"
                    title="Copy Code"
                  >
                    {copiedCode === coupon.code ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-white/80 text-sm mt-1">{coupon.description}</p>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">OFF</span>
                  </div>
                  {coupon.maxDiscount && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Max ₹{coupon.maxDiscount}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Valid till {new Date(coupon.validUntil).toLocaleDateString()}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Usage</span>
                    <span className="font-medium">{usedCount} / {maxUses || '∞'}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usagePercentage > 80 ? 'bg-red-500' : usagePercentage > 50 ? 'bg-yellow-500' : 'bg-green-50 dark:bg-green-900/80'
                      }`}
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {coupon.applicablePlans?.map(plan => (
                    <span key={plan} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                      {APPLICABLE_PLANS.find(p => p.value === plan)?.label || plan}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {coupon.applicableCategories?.map(cat => (
                    <span key={cat} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs rounded-full">
                      {cat}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex gap-2">
                    {expired && (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">Expired</span>
                    )}
                    {exhausted && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-full">Exhausted</span>
                    )}
                    {!coupon.isActive && (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 text-xs rounded-full">Inactive</span>
                    )}
                    {!expired && !exhausted && coupon.isActive && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs rounded-full">Active</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-900/20 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(coupon.id || coupon._id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {filteredCoupons.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border">
            <Ticket className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No coupons found</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
    <div className="p-3 sm:p-4 md:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Coupon Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="e.g., SSC50"
                    />
                  </div>
                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={generateRandomCode}
                      className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., 50% off on all SSC test series"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Discount Type *
                    </label>
                    <select
                      required
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {DISCOUNT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Discount Value *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxDiscount || ''}
                      onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="No limit"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Min Order Value (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minOrderValue}
                      onChange={(e) => setFormData({ ...formData, minOrderValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valid From *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.validFrom}
                      onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valid Until *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Total Usage Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.usageLimit || ''}
                      onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Per User Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.userUsageLimit}
                      onChange={(e) => setFormData({ ...formData, userUsageLimit: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Applicable Plans
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {APPLICABLE_PLANS.map(plan => (
                      <label key={plan.value} className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <input
                          type="checkbox"
                          checked={formData.applicablePlans.includes(plan.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, applicablePlans: [...formData.applicablePlans, plan.value] })
                            } else {
                              setFormData({ ...formData, applicablePlans: formData.applicablePlans.filter(p => p !== plan.value) })
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded"
                        />
                        <span className="text-sm">{plan.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Applicable Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                      <input
                        type="checkbox"
                        checked={formData.applicableCategories.includes('All')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, applicableCategories: ['All'] })
                          } else {
                            setFormData({ ...formData, applicableCategories: [] })
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded"
                      />
                      <span className="text-sm">All Categories</span>
                    </label>
                    {getRootCategoryNames().map(cat => (
                      <label key={cat} className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <input
                          type="checkbox"
                          checked={formData.applicableCategories.includes(cat)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newCategories = formData.applicableCategories.filter(c => c !== 'All')
                              setFormData({ ...formData, applicableCategories: [...newCategories, cat] })
                            } else {
                              setFormData({ ...formData, applicableCategories: formData.applicableCategories.filter(c => c !== cat) })
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded"
                        />
                        <span className="text-sm">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded"
                  />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Save className="w-4 h-4" />
                    {editingCoupon ? 'Update' : 'Create'}
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
