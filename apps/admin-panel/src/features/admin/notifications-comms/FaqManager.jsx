import { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { adminAPI } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";

export default function FaqManager() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "general",
    isActive: true,
    order: 0,
  });

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      const response = await adminAPI.getFaqs();
      if (response.data.success) {
        setFaqs(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch FAQs:", error);
      // Don't fall back to fake data — show empty state so admin knows to add real FAQs
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let response;
      if (editingId) {
        response = await adminAPI.updateFaq(editingId, formData);
      } else {
        response = await adminAPI.createFaq(formData);
      }

      if (response.data?.success) {
        fetchFaqs();
        resetForm();
        toast.success(editingId ? "FAQ updated!" : "FAQ created!");
      }
    } catch (error) {
      console.error("Failed to save FAQ:", error);
      toast.error("Failed to save FAQ");
    }
  };

  const handleEdit = (faq) => {
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || "general",
      isActive: faq.isActive !== false,
      order: faq.order || 0,
    });
    setEditingId(faq.id || faq._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: "Delete FAQ",
      message: "Are you sure you want to delete this FAQ?",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const response = await adminAPI.deleteFaq(id);
      if (response.data?.success) {
        toast.success("FAQ deleted!");
        fetchFaqs();
      }
    } catch (error) {
      console.error("Failed to delete FAQ:", error);
      toast.error("Failed to delete FAQ");
    }
  };

  const toggleActive = async (faq) => {
    try {
      const faqId = faq.id || faq._id;
      const response = await adminAPI.updateFaq(faqId, {
        ...faq,
        isActive: !faq.isActive,
      });
      if (response.data.success) {
        fetchFaqs();
      }
    } catch (error) {
      console.error("Failed to toggle FAQ:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      question: "",
      answer: "",
      category: "general",
      isActive: true,
      order: 0,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const categories = [
    { value: "general", label: "General" },
    { value: "payments", label: "Payments & Pricing" },
    { value: "tests", label: "Tests & Practice" },
    { value: "account", label: "Account & Profile" },
    { value: "technical", label: "Technical" },
  ];

  const groupedFaqs = categories.reduce((acc, cat) => {
    acc[cat.value] = faqs.filter((f) => f.category === cat.value);
    return acc;
  }, {});

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            FAQ Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage frequently asked questions
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          Add FAQ
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {faqs.length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total FAQs</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {faqs.filter((f) => f.isActive).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border">
          <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">
            {faqs.filter((f) => !f.isActive).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Inactive</p>
        </div>
      </div>

      {/* FAQs by Category */}
      {categories.map(
        (category) =>
          groupedFaqs[category.value]?.length > 0 && (
            <div key={category.value} className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {category.label}
              </h2>
              <div className="space-y-2">
                {groupedFaqs[category.value].map((faq) => {
                  const faqId = faq.id || faq._id;
                  return (
                    <div
                      key={faqId}
                      className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === faqId ? null : faqId)
                        }
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 text-xs rounded ${faq.isActive ? "bg-green-100 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}
                          >
                            {faq.isActive ? "Active" : "Inactive"}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {faq.question}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(faq);
                            }}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                            title="Edit FAQ"
                          >
                            <Edit className="w-4 h-4" />
                          </span>
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(faqId);
                            }}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                            title="Delete FAQ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </span>
                          {expandedId === faqId ? (
                            <ChevronUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                      </button>
                      {expandedId === faqId && (
                        <div className="px-4 pb-4 pt-0 border-t bg-gray-50 dark:bg-gray-900">
                          <p className="text-gray-600 dark:text-gray-400 mt-3">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ),
      )}

      {faqs.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
          <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No FAQs found</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingId ? "Edit FAQ" : "Add New FAQ"}
                </h2>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Question *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.question}
                    onChange={(e) =>
                      setFormData({ ...formData, question: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Answer *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.answer}
                    onChange={(e) =>
                      setFormData({ ...formData, answer: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Order
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          order: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Active
                  </span>
                </label>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Save className="w-4 h-4" />
                    {editingId ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
