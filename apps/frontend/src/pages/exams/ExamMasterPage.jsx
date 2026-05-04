import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  Bell, Layout, BookOpen, Zap, ChevronRight, Calendar, Users, 
  FileText, Award, Clock, AlertCircle, CheckCircle, ArrowRight,
  Target, TrendingUp, FileX, History, Loader2, Save, ArrowLeft,
  Plus, Trash2, Edit2, ChevronDown, ChevronUp, Download, Building2,
  ListChecks, GraduationCap, PlayCircle, Eye, Share2, Printer, 
  Bookmark, BookmarkCheck, Globe, Star, Settings, ShieldCheck,
  Send, EyeOff, LayoutPanelLeft, List, AlignLeft, AlignCenter, 
  AlignRight, Bold, Italic
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../shared/providers/AuthContext.jsx'
import api from '../../shared/lib/api'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import ComingSoon from '../../shared/components/common/ComingSoon'
import { toast } from 'react-hot-toast'
import sanitizeHtml from '../../shared/lib/sanitizeHtml'

// ── Rich Text Editor (Extracted from ExamEditor.jsx) ────────────────
function RichTextEditor({ value, onChange, placeholder }) {
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)

  const handleCommand = (command) => {
    document.execCommand(command, false, null)
    if (command === 'bold') setIsBold(!isBold)
    if (command === 'italic') setIsItalic(!isItalic)
  }

  const handleInput = (e) => {
    onChange(e.target.innerHTML)
  }

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50/80 border-b border-gray-200 backdrop-blur-sm sticky top-0 z-10">
        <button type="button" onClick={() => handleCommand('bold')} className={`p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all ${isBold ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`} title="Bold"><Bold className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleCommand('italic')} className={`p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all ${isItalic ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`} title="Italic"><Italic className="w-4 h-4" /></button>
        <div className="w-px h-6 bg-gray-200 mx-1"></div>
        <button type="button" onClick={() => handleCommand('insertUnorderedList')} className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-500 transition-all font-bold" title="Bullet List"><List className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleCommand('insertOrderedList')} className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-500 transition-all font-black text-xs" title="Numbered List">1.</button>
        <div className="w-px h-6 bg-gray-200 mx-1"></div>
        <button type="button" onClick={() => handleCommand('justifyLeft')} className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-500 transition-all" title="Align Left"><AlignLeft className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleCommand('justifyCenter')} className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-500 transition-all" title="Align Center"><AlignCenter className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleCommand('justifyRight')} className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-500 transition-all" title="Align Right"><AlignRight className="w-4 h-4" /></button>
      </div>
       <div
         contentEditable
         className="min-h-[300px] p-6 focus:outline-none prose prose-slate max-w-none text-gray-700 font-medium"
         onInput={handleInput}
         dangerouslySetInnerHTML={{ __html: sanitizeHtml(value || '') }}
         data-placeholder={placeholder}
       />
    </div>
  )
}

// ── Master Component ───────────────────────────────────────────────
export default function ExamMasterPage() {
  const { examId, categoryId, subCategoryId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  const isAdmin = user?.role === 'admin'
  const [mode, setMode] = useState('view') // 'view', 'edit', 'preview'
  const [activeTab, setActiveTab] = useState('overview')
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrollmentLoading, setEnrollmentLoading] = useState(false)
  
  // Local edit state
  const [editData, setEditData] = useState({
    title: '',
    fullName: '',
    description: '',
    examId: '',
    categoryId: '',
    subcategoryId: '',
    syllabus: '',
    isActive: true,
    examPattern: []
  })

  // 1. Fetch Master Data
  const { data: masterData, isLoading, isError } = useQuery({
    queryKey: ['exam-master', examId || categoryId],
    queryFn: async () => {
      // Logic from ExamDetails.jsx + Exam.jsx
      const infoRes = await api.get('/api/exam-info')
      const allInfo = infoRes.data?.data || []
      
      const examInfo = allInfo.find(e => e.examId === examId || e.id === examId || e._id === examId)
      
      // Fetch Extended Data if it's an exam
      let extendedData = {}
      if (examInfo) {
        const detailsRes = await api.get(`/api/exams/${examInfo.examId}`).catch(() => ({ data: { data: {} } }))
        const updatesRes = await api.get(`/api/exam-info/${examInfo.examId}/updates`).catch(() => ({ data: { data: [] } }))
        const yearlyRes = await api.get(`/api/exam-info/${examInfo.examId}/yearly-data`).catch(() => ({ data: { data: {} } }))
        extendedData = {
          content: detailsRes.data?.data || {},
          updates: updatesRes.data?.data || [],
          yearly: yearlyRes.data?.data || {}
        }
      }

      // Fetch categories for context/subcategories
      const catRes = await api.get('/api/exam-categories')
      const allCategories = catRes.data?.data || []
      const currentCategory = allCategories.find(c => c.id === (examInfo?.categoryId || categoryId))
      
      return {
        exam: examInfo,
        ...extendedData,
        category: currentCategory,
        allCategories
      }
    },
    staleTime: 1000 * 60 * 5
  })

  // Sync edit state when data loads
  useEffect(() => {
    if (masterData?.exam) {
      setEditData({
        title: masterData.exam.title || '',
        fullName: masterData.exam.fullName || '',
        description: masterData.exam.description || '',
        examId: masterData.exam.examId || '',
        categoryId: masterData.exam.categoryId || '',
        subcategoryId: masterData.exam.subcategoryId || '',
        syllabus: masterData.exam.syllabus || '',
        isActive: masterData.exam.isActive !== false,
        examPattern: masterData.content?.pattern?.tier1 || []
      })
    }
  }, [masterData])

  // Mutation for Save
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const id = masterData.exam.id || masterData.exam._id
      return await api.put(`/api/admin/exam-info/${id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['exam-master'])
      setMode('view')
      toast.success('Exam intelligence synchronized successfully!')
    },
    onError: () => toast.error('Failed to update exam records')
  })

  const handleSave = () => {
    saveMutation.mutate(editData)
  }

  // Enrollment Logic (from ExamDetails.jsx)
  useEffect(() => {
    const checkEnrollment = async () => {
      if (!user || !examId) return
      try {
        const response = await api.get('/api/users/enrolled-exams')
        const enrolled = (response.data?.data || []).some(e => e.examId === examId || e.id === examId)
        setIsEnrolled(enrolled)
      } catch (e) {
        console.error('Enrollment check failed', e)
      }
    }
    checkEnrollment()
  }, [user, examId])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Synchronizing Exam Intelligence Master...</p>
      </div>
    )
  }

  if (isError || (!masterData?.exam && !categoryId)) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-4">Master Index Error</h2>
          <p className="text-gray-600 mb-8 font-medium">The requested exam or category could not be located in the central master repository.</p>
          <button onClick={() => navigate('/exams')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
            Return to Directory
          </button>
        </div>
      </div>
    )
  }

  const { exam, category, content, updates, yearly } = masterData
  const activeYear = new Date().getFullYear().toString()
  const yearData = yearly?.[activeYear] || {}

  // ── RENDERERS ────────────────

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isAdmin && mode === 'edit' ? 'bg-[#f0f2f5]' : 'bg-[#f6f8fb]'}`}>
      
      {/* 1. Admin Control Bar */}
      {isAdmin && (
        <div className="sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm animate-drop-in">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                <ShieldCheck className="w-3 h-3" />
                Admin Terminal
             </div>
             <p className="text-[11px] font-bold text-gray-500">
               {mode === 'edit' ? 'Currently modifying exam intelligence...' : 'Viewing system records'}
             </p>
          </div>
          
          <div className="flex items-center gap-2">
            {mode === 'view' ? (
              <button 
                onClick={() => setMode('edit')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Edit2 className="w-3.5 h-3.5" /> Modify Intelligence
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setMode('view')}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-bold text-xs transition-all"
                >
                  Discard
                </button>
                <button 
                   onClick={handleSave}
                   disabled={saveMutation.isLoading}
                   className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  {saveMutation.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Synchronize Changes
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Breadcrumb 
          items={[
            { label: 'Home', path: '/' },
            { label: 'Exams', path: '/exams' },
            { label: category?.label || 'Category', path: `/exams/category/${category?.id}` },
            { label: exam?.title || 'Current' }
          ]}
        />
      </div>

      {/* 3. Hero Section (Combined iOS High-Fidelity) */}
      <div className="max-w-7xl mx-auto px-4 mb-10">
        <div className="relative overflow-hidden bg-slate-950 rounded-[3rem] p-8 md:p-14 text-white shadow-2xl">
          {/* Animated Background Blobs */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -mr-64 -mt-64" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] -ml-32 -mb-32" />
          <div className="absolute inset-0 bg-grid-white/[0.03] pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row gap-12 items-start">
             <div className="flex-1">
                {/* Header Metadata */}
                <div className="flex flex-wrap items-center gap-3 mb-8">
                  <span className="px-4 py-1.5 bg-white/10 text-white/80 border border-white/10 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-[0.2em]">
                    {category?.label} Umbrella
                  </span>
                  {exam?.isActive && (
                    <span className="px-4 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                       Active Lifecycle
                    </span>
                  )}
                  {isAdmin && (
                     <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-[9px] font-black border border-indigo-500/30">
                        ID: {editData.examId}
                     </div>
                  )}
                </div>

                {mode === 'edit' ? (
                  <div className="space-y-4 max-w-2xl">
                    <input 
                      type="text" 
                      value={editData.title}
                      onChange={e => setEditData({...editData, title: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-4xl font-black text-white focus:bg-white/10 focus:border-indigo-400 outline-none transition-all"
                      placeholder="Exam Title"
                    />
                    <input 
                      type="text" 
                      value={editData.fullName}
                      onChange={e => setEditData({...editData, fullName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-lg font-medium text-white/60 focus:bg-white/10 focus:border-indigo-400 outline-none transition-all"
                      placeholder="Full Name (Official)"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight tracking-tight">
                       {exam?.title} <span className="text-indigo-400">{activeYear}</span>
                    </h1>
                    <p className="text-xl text-white/50 font-medium mb-10 max-w-2xl leading-relaxed">
                       {exam?.fullName || 'Comprehensive Preparation Suite'}
                    </p>
                  </>
                )}

                {/* Quick Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                   {[
                     { label: 'Vacancies', value: yearData.vacancy?.toLocaleString() || 'TBA', icon: Users, color: 'text-indigo-400' },
                     { label: 'Released', value: yearData.notificationDate ? new Date(yearData.notificationDate).toLocaleDateString() : 'Active', icon: Bell, color: 'text-emerald-400' },
                     { label: 'Tier-I Exam', value: yearData.tier1ExamDate ? new Date(yearData.tier1ExamDate).toLocaleDateString() : 'Upcoming', icon: Calendar, color: 'text-amber-400' },
                     { label: 'Authority', value: content?.conductingBody || 'National', icon: GraduationCap, color: 'text-purple-400' }
                   ].map((stat, i) => (
                     <div key={i} className="bg-white/5 backdrop-blur-xl rounded-[1.5rem] p-5 border border-white/10 group hover:bg-white/10 transition-all">
                       <stat.icon className={`w-5 h-5 ${stat.color} mb-3 group-hover:scale-110 transition-transform`} />
                       <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">{stat.label}</p>
                       <p className="text-lg font-black">{stat.value}</p>
                     </div>
                   ))}
                </div>
             </div>

             {/* Dynamic CTA Module */}
             <div className="w-full lg:w-[350px] bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl flex flex-col items-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-2xl shadow-indigo-500/20 rotate-3">
                  🎯
                </div>
                <h3 className="text-2xl font-black mb-2">Master This Exam</h3>
                <p className="text-white/40 text-xs font-bold text-center mb-8 uppercase tracking-widest">
                  {isEnrolled ? 'Strategic planning active' : 'Launch your preparation'}
                </p>

                <div className="w-full space-y-3">
                   <button 
                     onClick={() => setIsEnrolled(!isEnrolled)}
                     className={`w-full py-4 rounded-2xl font-black text-[10px] tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 uppercase ${
                       isEnrolled 
                         ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' 
                         : 'bg-white text-slate-900 hover:scale-[1.02] shadow-white/5'
                     }`}
                   >
                     {isEnrolled ? <><History className="w-4 h-4" /> Drop Sequence</> : <><ShieldCheck className="w-4 h-4" /> Enroll in Exam</>}
                   </button>
                   <button onClick={() => navigate('/test-series')} className="w-full py-4 bg-white/10 text-white border border-white/10 rounded-2xl font-black text-[10px] tracking-widest hover:bg-white/20 transition-all flex items-center justify-center gap-2 group uppercase">
                      Practice Mocks <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                   </button>
                   <div className="flex items-center justify-center gap-4 mt-6">
                      <button className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"><Share2 className="w-4 h-4 text-white/60" /></button>
                      <button className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"><Bookmark className="w-4 h-4 text-white/60" /></button>
                      <button className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"><Printer className="w-4 h-4 text-white/60" /></button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* 4. Functional Content Engine */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            
            {/* Left Sidebar: Task Navigation */}
            <div className="lg:col-span-1">
               <div className="sticky top-24 space-y-2 bg-white rounded-3xl p-3 border border-gray-100 shadow-sm">
                  {[
                    { id: 'overview', label: 'Overview', icon: Target, description: 'Highlights & Scope' },
                    { id: 'syllabus', label: 'Syllabus', icon: ListChecks, description: 'Subject Coverage' },
                    { id: 'pattern', label: 'Pattern', icon: LayoutPanelLeft, description: 'Structure & Tiers' },
                    { id: 'updates', label: 'Updates', icon: Bell, description: 'Latest Broadcasts' },
                    { id: 'archive', label: 'PYQ Archive', icon: History, description: 'Past Records' },
                    { id: 'subcategories', label: 'Ecosystem', icon: Globe, description: 'Related Disciplines' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${
                        activeTab === tab.id 
                          ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 translate-x-1' 
                          : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-indigo-50'} transition-colors`}>
                        <tab.icon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-black uppercase tracking-wider leading-none mb-1">{tab.label}</p>
                        <p className={`text-[9px] font-bold ${activeTab === tab.id ? 'text-white/60' : 'text-gray-400'}`}>{tab.description}</p>
                      </div>
                    </button>
                  ))}
               </div>
            </div>

            {/* Right Column: Dynamic Master Content */}
            <div className="lg:col-span-3">
               
               {/* 4a. Overview Segment */}
               {activeTab === 'overview' && (
                 <div className="space-y-8 animate-slide-in-up">
                    <section className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-sm">
                       <div className="flex items-center justify-between mb-8">
                         <h2 className="text-2xl font-black text-gray-900">Intelligence Brief</h2>
                         {isAdmin && <span className="text-[10px] font-black text-indigo-400 uppercase">Live Indexing</span>}
                       </div>
                       
                       {mode === 'edit' ? (
                         <div className="space-y-6">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Meta Description</label>
                            <RichTextEditor 
                              value={editData.description} 
                              onChange={val => setEditData({...editData, description: val})}
                              placeholder="Write a comprehensive overview of the exam..."
                            />
                         </div>
                       ) : (
                         <div className="prose prose-slate max-w-none text-gray-600 font-medium leading-relaxed">
                            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(editData.description || 'Intel gathering in progress...') }} />
                         </div>
                       )}
                    </section>
                 </div>
               )}

               {/* 4b. Syllabus Segment */}
               {activeTab === 'syllabus' && (
                 <div className="space-y-8 animate-slide-in-up">
                    <section className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-sm">
                       <div className="flex items-center justify-between mb-10">
                          <div>
                            <h2 className="text-2xl font-black text-gray-900">Comprehensive Syllabus</h2>
                            <p className="text-gray-400 font-bold text-xs mt-1 uppercase tracking-tighter">Verified Official Curriculum</p>
                          </div>
                          <button className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors">
                            <Download className="w-5 h-5" />
                          </button>
                       </div>

                       {mode === 'edit' ? (
                         <div className="space-y-6">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Curriculum Details (Markdown/HTML Supported)</label>
                            <RichTextEditor 
                              value={editData.syllabus} 
                              onChange={val => setEditData({...editData, syllabus: val})}
                              placeholder="Outline the detailed subjects and topics..."
                            />
                         </div>
                       ) : (
                         <div className="prose prose-indigo max-w-none text-gray-700">
                            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(editData.syllabus || 'Syllabus mapping pending verification.') }} />
                         </div>
                       )}
                    </section>
                 </div>
               )}

               {/* 4c. Pattern Segment */}
               {activeTab === 'pattern' && (
                 <div className="space-y-8 animate-slide-in-up">
                    <section className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-sm">
                       <h2 className="text-2xl font-black text-gray-900 mb-8">Examination Logistics</h2>
                       
                       <div className="grid md:grid-cols-3 gap-6 mb-10">
                          {[
                            { label: 'Total Duration', value: '60 Minutes', icon: Clock },
                            { label: 'Mode', value: 'Online CBT', icon: Globe },
                            { label: 'Language', value: 'Bilingual', icon: Award }
                          ].map((x, idx) => (
                            <div key={idx} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                              <x.icon className="w-6 h-6 text-indigo-500 mx-auto mb-3" />
                              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{x.label}</p>
                              <p className="text-sm font-black text-gray-900">{x.value}</p>
                            </div>
                          ))}
                       </div>

                       <div className="overflow-hidden rounded-[2rem] border border-gray-100">
                          <table className="w-full text-left">
                             <thead>
                                <tr className="bg-slate-50">
                                   <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Section Matrix</th>
                                   <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Items</th>
                                   <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Score</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-50">
                                {editData.examPattern && editData.examPattern.length > 0 ? editData.examPattern.map((sec, i) => (
                                  <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="p-6 font-bold text-gray-900">{sec.section}</td>
                                    <td className="p-6 text-center font-bold text-gray-500">{sec.questions}</td>
                                    <td className="p-6 text-center font-black text-indigo-600">{sec.marks}</td>
                                  </tr>
                                )) : (
                                  <tr>
                                    <td colSpan="3" className="p-10 text-center text-gray-400 font-bold italic">No pattern data synchronized.</td>
                                  </tr>
                                )}
                             </tbody>
                          </table>
                       </div>
                    </section>
                 </div>
               )}

               {/* 4d. Updates Segment */}
               {activeTab === 'updates' && (
                 <div className="space-y-6 animate-slide-in-up">
                    {updates && updates.length > 0 ? updates.map((u, i) => (
                      <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 flex items-start gap-5 hover:border-indigo-100 transition-all group">
                         <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                            <Bell className="w-6 h-6" />
                         </div>
                         <div className="flex-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase">{new Date(u.date).toLocaleDateString()}</span>
                            <h4 className="text-lg font-black text-gray-900 mb-1">{u.title}</h4>
                            <p className="text-sm text-gray-500 font-medium">{u.description}</p>
                         </div>
                         <ArrowRight className="w-5 h-5 text-gray-100 group-hover:text-indigo-600 transition-colors mt-6" />
                      </div>
                    )) : (
                       <div className="py-20 bg-white rounded-[3rem] border border-dashed border-gray-200 text-center">
                          <p className="text-4xl mb-4">📭</p>
                          <p className="font-black text-gray-400 uppercase tracking-widest text-xs">No Official Broadcasts Recorded</p>
                       </div>
                    )}
                 </div>
               )}

               {/* 4e. Ecosystem / Subcategories Segment */}
               {activeTab === 'subcategories' && (
                 <div className="space-y-10 animate-slide-in-up">
                    <section className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm text-center">
                       <h2 className="text-2xl font-black text-gray-900 mb-10">Cross-Exam Ecosystem</h2>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {category?.subcategories?.map((sub, i) => (
                             <Link 
                               key={i}
                               to={`/exams/category/${category.id}/subcategory/${sub.id || sub.slug}`}
                               className="p-6 bg-gray-50 rounded-3xl border border-gray-100 hover:border-indigo-200 transition-all text-left flex items-center gap-5 group"
                             >
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform">
                                   🎓
                                </div>
                                <div>
                                   <h4 className="font-black text-gray-900">{sub.name || sub.title}</h4>
                                   <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">Explore Track</p>
                                </div>
                                <div className="flex-1 text-right">
                                   <ChevronRight className="w-5 h-5 text-gray-200 inline-block group-hover:translate-x-1 transition-transform" />
                                </div>
                             </Link>
                          ))}
                       </div>
                    </section>
                 </div>
               )}

               {/* 4f. Archive Segment */}
               {activeTab === 'archive' && (
                 <div className="animate-slide-in-up">
                    <section className="bg-white rounded-[2.5rem] p-16 border border-gray-100 shadow-sm text-center flex flex-col items-center">
                       <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center text-4xl mb-8">📚</div>
                       <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Intelligence Archive</h2>
                       <p className="text-gray-500 font-medium max-w-md mb-10">Historical question papers and official answer keys indexed from the last 10 execution cycles.</p>
                       <button className="px-10 py-4 bg-indigo-600 text-white rounded-3xl font-black text-xs hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200">
                          ACCESS FULL ARCHIVE
                       </button>
                    </section>
                 </div>
               )}

            </div>
         </div>
      </div>
    </div>
  )
}
