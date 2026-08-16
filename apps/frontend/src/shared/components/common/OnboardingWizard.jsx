import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { X, ChevronRight, ChevronLeft, Check, Target, GraduationCap, BookOpen } from 'lucide-react';
import { useAuth } from '../../providers/AuthContext'
import { examAPI } from '../../lib/dataService'
import { hasCompletedOnboarding } from '../../lib/onboardingUtils'

const STORAGE_KEY = 'trstprep_onboarding'
const ONBOARDING_VERSION = 1

export default function OnboardingWizard() {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [categories, setCategories] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedExam, setSelectedExam] = useState(null)
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [dailyGoal, setDailyGoal] = useState(20)

  // Show the wizard for authenticated users who haven't completed onboarding
  useEffect(() => {
    if (user && !hasCompletedOnboarding()) {
      setIsOpen(true)
      fetchCatalog()
    }
  }, [user])

  const fetchCatalog = async () => {
    try {
      setLoading(true)
      const [catRes, examRes] = await Promise.all([
        examAPI.getCategories(),
        examAPI.getExams(),
      ])
      setCategories(catRes.data?.data || catRes.data || [])
      setExams(examRes.data?.data || examRes.data || [])
    } catch (err) {
      console.error('Failed to load onboarding catalog:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredExams = useMemo(() => {
    if (!selectedCategory) return exams
    const catId = selectedCategory.id || selectedCategory._id
    return exams.filter(e => {
      const eCat = e.examCategoryId || e.categoryId || e.category_id
      return String(eCat) === String(catId)
    })
  }, [exams, selectedCategory])

  const subjectOptions = useMemo(() => [
    { id: 'reasoning', label: 'Reasoning', icon: '🧠' },
    { id: 'quant', label: 'Quantitative Aptitude', icon: '🔢' },
    { id: 'english', label: 'English Language', icon: '🔤' },
    { id: 'ga', label: 'General Awareness', icon: '📖' },
    { id: 'science', label: 'General Science', icon: '🔬' },
    { id: 'computer', label: 'Computer Knowledge', icon: '💻' },
    { id: 'current', label: 'Current Affairs', icon: '📰' },
  ], [])

  const goalOptions = [
    { value: 10, label: 'Light', desc: '10 questions / day', icon: '🌱' },
    { value: 20, label: 'Steady', desc: '20 questions / day', icon: '🚶' },
    { value: 50, label: 'Serious', desc: '50 questions / day', icon: '🔥' },
    { value: 100, label: 'Intense', desc: '100 questions / day', icon: '⚡' },
  ]

  const toggleSubject = (id) => {
    setSelectedSubjects(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: ONBOARDING_VERSION,
      completed: true,
      skipped: true,
      selectedCategory: null,
      selectedExam: null,
      selectedSubjects: [],
      dailyGoal: 20,
    }))
    setIsOpen(false)
  }

  const handleFinish = async () => {
    const prefs = {
      version: ONBOARDING_VERSION,
      completed: true,
      skipped: false,
      selectedCategory: selectedCategory
        ? { id: selectedCategory.id || selectedCategory._id, name: selectedCategory.name || selectedCategory.label }
        : null,
      selectedExam: selectedExam
        ? { id: selectedExam.id || selectedExam._id, name: selectedExam.fullName || selectedExam.name || selectedExam.title }
        : null,
      selectedSubjects,
      dailyGoal,
      completedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))

    // Best-effort profile update (non-blocking — onboarding pref is in localStorage regardless)
    try {
      const examName = prefs.selectedExam?.name || prefs.selectedCategory?.name || ''
      if (examName) {
        await updateProfile({ education: `Preparing for ${examName}` })
      }
    } catch { /* non-critical */ }

    toast.success("You're all set! Welcome to Trstprep.", { icon: '🎉', duration: 4000 })
    setIsOpen(false)
    navigate('/dashboard', { replace: true })
  }

  const canProceed = useMemo(() => {
    if (step === 0) return true // category selection is optional
    if (step === 1) return true // subject selection is optional
    if (step === 2) return dailyGoal > 0
    return false
  }, [step, dailyGoal])

  if (!isOpen) return null

  const steps = [
    { title: 'What are you preparing for?', icon: GraduationCap, desc: 'Pick your target exam so we can personalize recommendations.' },
    { title: 'Which subjects interest you?', icon: BookOpen, desc: 'Select the subjects you want to focus on.' },
    { title: 'Set your daily goal', icon: Target, desc: 'How many questions do you want to practice each day?' },
  ]

  const StepIcon = steps[step].icon

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <StepIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500">Step {step + 1} of {steps.length}</span>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 px-5 pt-4">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'flex-1 bg-indigo-600' : i < step ? 'flex-1 bg-indigo-300' : 'w-1.5 bg-gray-200 dark:bg-gray-600'}`} />
          ))}
        </div>

        {/* Step content */}
        <div className="p-5">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">{steps[step].title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{steps[step].desc}</p>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : step === 0 ? (
            <div className="space-y-4">
              {/* Category pills */}
              {categories.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => {
                      const isSelected = selectedCategory && String(selectedCategory.id || selectedCategory._id) === String(cat.id || cat._id)
                      return (
                        <button key={cat.id || cat._id} onClick={() => { setSelectedCategory(isSelected ? null : cat); setSelectedExam(null) }}
                          className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-200'}`}>
                          {cat.name || cat.label || 'Category'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Exam list (filtered by category) */}
              <div>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Target Exam</p>
                {filteredExams.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No exams found for this category. You can skip this step.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {filteredExams.map(exam => {
                      const isSelected = selectedExam && String(selectedExam.id || selectedExam._id) === String(exam.id || exam._id)
                      return (
                        <button key={exam.id || exam._id} onClick={() => setSelectedExam(isSelected ? null : exam)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200'}`}>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white text-left">{exam.fullName || exam.name || exam.title || 'Exam'}</span>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : step === 1 ? (
            <div className="grid grid-cols-2 gap-3">
              {subjectOptions.map(subj => {
                const isSelected = selectedSubjects.includes(subj.id)
                return (
                  <button key={subj.id} onClick={() => toggleSubject(subj.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200'}`}>
                    <span className="text-2xl">{subj.icon}</span>
                    <span className={`text-sm font-semibold text-left ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>{subj.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 ml-auto" />}
                  </button>
                )
              })}
            </div>
          ) : step === 2 ? (
            <div className="space-y-3">
              {goalOptions.map(opt => {
                const isSelected = dailyGoal === opt.value
                return (
                  <button key={opt.value} onClick={() => setDailyGoal(opt.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200'}`}>
                    <span className="text-3xl">{opt.icon}</span>
                    <div className="text-left flex-1">
                      <p className={`text-sm font-bold ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>{opt.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleSkip} className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Skip for now
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canProceed} className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleFinish} disabled={!canProceed} className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
                <Check className="w-4 h-4" /> Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}