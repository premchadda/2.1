import { useState, useEffect } from 'react'
import {
  Plus, Edit2, Trash2, Check, X, Save, Star
} from 'lucide-react'
import { apiClient } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'

export default function SubscriptionPlansManager() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: 0,
    originalPrice: null,
    period: '/month',
    features: [],
    buttonText: 'Get Started',
    buttonClass: 'bg-gradient-to-r from-brand-start to-brand-end text-white',
    popular: false,
    savings: ''
  })

  const [newFeature, setNewFeature] = useState({ text: '', included: true })

  useEffect(() => {
    fetchPlans()

    // Auto-update plans in the background every 5 seconds
    const interval = setInterval(() => {
      fetchPlans(true)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const fetchPlans = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true)
      const response = await apiClient.get('/admin/subscription-plans')
      if (response.data?.success) {
        setPlans(response.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingPlan) {
        await apiClient.put(`/admin/subscription-plans/${editingPlan._id}`, formData)
        toast.success('Plan updated successfully')
      } else {
        await apiClient.post('/admin/subscription-plans', formData)
        toast.success('Plan created successfully')
      }
      fetchPlans()
      resetForm()
    } catch (error) {
      console.error('Failed to save plan:', error)
      toast.error('Failed to save plan')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this plan?')) return
    try {
      await apiClient.delete(`/admin/subscription-plans/${id}`)
      toast.success('Plan deleted successfully')
      fetchPlans()
    } catch (error) {
      console.error('Failed to delete plan:', error)
      toast.error('Failed to delete plan')
    }
  }

  const handleEdit = (plan) => {
    setEditingPlan(plan)
    setFormData({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      originalPrice: plan.originalPrice || null,
      period: plan.period,
      features: plan.features || [],
      buttonText: plan.buttonText || 'Get Started',
      buttonClass: plan.buttonClass || 'bg-gradient-to-r from-brand-start to-brand-end text-white',
      popular: plan.popular || false,
      savings: plan.savings || ''
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingPlan(null)
    setFormData({
      id: '',
      name: '',
      price: 0,
      originalPrice: null,
      period: '/month',
      features: [],
      buttonText: 'Get Started',
      buttonClass: 'bg-gradient-to-r from-brand-start to-brand-end text-white',
      popular: false,
      savings: ''
    })
    setShowForm(false)
  }

  const addFeature = () => {
    if (newFeature.text.trim()) {
      setFormData({
        ...formData,
        features: [...formData.features, { ...newFeature }]
      })
      setNewFeature({ text: '', included: true })
    }
  }

  const removeFeature = (index) => {
    const updated = [...formData.features]
    updated.splice(index, 1)
    setFormData({ ...formData, features: updated })
  }

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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500" />
            Subscription Plans Management
          </h1>
          <p className="text-gray-600 mt-1">Manage pricing plans for Pro Pass</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Plan
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div 
            key={plan._id}
            className={`relative bg-white rounded-2xl border-2 p-6 transition-all ${
              plan.popular 
                ? 'border-amber-400 shadow-xl scale-105' 
                : 'border-gray-200 hover:border-brand-start hover:shadow-lg'
            }`}
          >
            {/* Popular Badge */}
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-full">
                MOST POPULAR
              </div>
            )}

            {/* Savings Badge */}
            {plan.savings && (
              <div className="absolute top-4 right-4 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
                {plan.savings}
              </div>
            )}

            <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
            
            <div className="mb-4">
              {plan.originalPrice && (
                <span className="text-gray-400 line-through text-sm mr-2">₹{plan.originalPrice}</span>
              )}
              <span className="text-3xl font-bold text-gray-900">₹{plan.price}</span>
              <span className="text-gray-500 text-sm">{plan.period}</span>
            </div>

            <ul className="space-y-2 mb-4">
              {(plan.features || []).map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  {f.included ? (
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <X className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}
                  <span className={f.included ? 'text-gray-700 text-sm' : 'text-gray-400 text-sm'}>{f.text}</span>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(plan)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => handleDelete(plan._id)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-900">No Plans Found</h3>
          <p className="text-gray-500 mt-2">Add subscription plans to get started</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max w-full max-h-[90vh]-w-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingPlan ? 'Edit Plan' : 'Add New Plan'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plan ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., pro-yearly"
                      disabled={!!editingPlan}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plan Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Pro Yearly"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Original Price (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.originalPrice || ''}
                      onChange={(e) => setFormData({ ...formData, originalPrice: parseInt(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Period *
                    </label>
                    <select
                      required
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="/month">/month</option>
                      <option value="/year">/year</option>
                      <option value="forever">forever</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Button Text
                    </label>
                    <input
                      type="text"
                      value={formData.buttonText}
                      onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Savings Label
                    </label>
                    <input
                      type="text"
                      value={formData.savings}
                      onChange={(e) => setFormData({ ...formData, savings: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Save 58%"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.popular}
                    onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                    id="popular"
                  />
                  <label htmlFor="popular" className="text-sm font-medium text-gray-700">
                    Mark as Popular Plan
                  </label>
                </div>

                {/* Features */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Features
                  </label>
                  <div className="space-y-2 mb-3">
                    {(formData.features || []).map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        {feature.included ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-gray-300" />
                        )}
                        <span className="flex-1 text-sm">{feature.text}</span>
                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFeature.text}
                      onChange={(e) => setNewFeature({ ...newFeature, text: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Add feature text..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    />
                    <button
                      type="button"
                      onClick={addFeature}
                      className="px-3 py-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Save className="w-4 h-4" />
                    {editingPlan ? 'Update' : 'Create'}
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
