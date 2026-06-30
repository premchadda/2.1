import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Bell, Layout, BookOpen, Zap, ChevronRight, Calendar, Users, 
  FileText, Award, Clock, AlertCircle, CheckCircle, ArrowRight,
  Target, TrendingUp, FileX, History, Loader2,
  ArrowUpDown, Download, Building2,
  ListChecks, GraduationCap as GraduationIcon, Plus, Minus
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import api from '../../shared/lib/api'
import { useAuth } from '../../shared/providers/AuthContext'
import ComingSoon from '../../shared/components/common/ComingSoon'

export default function ExamDetails() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState('overview');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);

  // Unified Exam Data Fetching
  const { data: examResponse, isLoading: examLoading, error: examError } = useQuery({
    queryKey: ['exam-full-details', examId],
    queryFn: async () => {
      // First get basic info to find category
      const infoRes = await api.get('/api/exam-info');
      const allInfo = infoRes.data?.data || [];
      
      let baseExamId = examId;
      const yearMatch = examId.match(/-(\d{4})$/);
      if (yearMatch) {
        baseExamId = examId.replace(/-\d{4}$/, '');
        setSelectedYear(yearMatch[1]);
      }

      let examInfo = allInfo.find(e => e.examId === examId || e.examId === baseExamId);
      if (!examInfo) throw new Error('Exam not found');

      // Fetch extended static/pattern/syllabus content (Real replacement for STATIC_CONTENT)
      // Note: content endpoint may not exist, using exam details instead
      const contentRes = await api.get(`/api/exams/${examInfo.examId}`).catch(() => ({ data: { data: {} } }));
      const updatesRes = await api.get(`/api/exam-info/${examInfo.examId}/updates`).catch(() => ({ data: { data: [] } }));
      const yearlyRes = await api.get(`/api/exam-info/${examInfo.examId}/yearly-data`).catch(() => ({ data: { data: {} } }));

      // Fetch category
      const catRes = await api.get('/api/exam-categories');
      const category = (catRes.data?.data || []).find(c => c.id === examInfo.categoryId);

      return {
        info: examInfo,
        content: contentRes.data?.data || {},
        updates: updatesRes.data?.data || [],
        yearly: yearlyRes.data?.data || {},
        category: category || { id: examInfo.categoryId, label: examInfo.categoryId }
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  const examData = examResponse?.info;
  const staticContent = examResponse?.content;
  const updates = examResponse?.updates;
  const yearlyData = examResponse?.yearly;
  const categoryData = examResponse?.category;

  // Fallback for demo if API content is missing but we have info
  const effectiveContent = useMemo(() => {
    if (!staticContent || Object.keys(staticContent).length === 0) {
      // This is where we could have a "Template" or default but better to show Coming Soon if empty
      return null;
    }
    return staticContent;
  }, [staticContent]);

  if (examLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-bold animate-pulse uppercase tracking-widest text-xs">Synchronizing Exam Intelligence...</p>
      </div>
    );
  }

  if (examError || !examData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-4">Exam Archive Not Found</h2>
          <p className="text-gray-600 mb-8 font-medium">The exam ID "{examId}" does not exist in our database or has been moved to a new archive.</p>
          <button onClick={() => navigate('/exams')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
            Browse All Exams
          </button>
        </div>
      </div>
    );
  }

  // Check if user is enrolled in this exam
  useEffect(() => {
    const checkEnrollment = async () => {
      if (!user) {
        setIsEnrolled(false);
        return;
      }
      try {
        const response = await api.get('/api/users/enrolled-exams');
        const enrolledExams = response.data?.data || [];
        const enrolled = enrolledExams.some(exam => 
          exam.examId === examId || 
          exam.id === examId || 
          exam._id === examId ||
          exam.examId === examData?.examId ||
          exam.id === examData?.examId
        );
        setIsEnrolled(enrolled);
      } catch (error) {
        console.error('Error checking enrollment:', error);
        setIsEnrolled(false);
      }
    };
    if (examData) {
      checkEnrollment();
    }
  }, [user, examId, examData]);

  // Enroll in exam mutation
  const enrollMutation = useMutation({
    mutationFn: async () => {
      setEnrollmentLoading(true);
      const response = await api.post(`/api/users/enroll-exam/${examId}`);
      return response.data;
    },
    onSuccess: () => {
      setIsEnrolled(true);
      queryClient.invalidateQueries(['enrolled-exams']);
      queryClient.invalidateQueries(['user-profile']);
    },
    onError: (error) => {
      console.error('Enrollment error:', error);
      alert(error.response?.data?.message || 'Failed to enroll in exam');
    },
    onSettled: () => {
      setEnrollmentLoading(false);
    }
  });

  // Unenroll from exam mutation
  const unenrollMutation = useMutation({
    mutationFn: async () => {
      setEnrollmentLoading(true);
      const response = await api.delete(`/api/users/unenroll-exam/${examId}`);
      return response.data;
    },
    onSuccess: () => {
      setIsEnrolled(false);
      queryClient.invalidateQueries(['enrolled-exams']);
      queryClient.invalidateQueries(['user-profile']);
    },
    onError: (error) => {
      console.error('Unenrollment error:', error);
      alert(error.response?.data?.message || 'Failed to unenroll from exam');
    },
    onSettled: () => {
      setEnrollmentLoading(false);
    }
  });

  const handleEnrollToggle = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (isEnrolled) {
      unenrollMutation.mutate();
    } else {
      enrollMutation.mutate();
    }
  };

  // Handle empty content state (no data published yet for this exam)
  if (!effectiveContent && !examData.description) {
    return (
      <ComingSoon
        title={`${examData.title} — Details Not Available Yet`}
        message="Syllabus, exam pattern, and yearly trends haven't been published for this exam yet."
        submessage="Our team is verifying the latest notification details. Check back in 24-48 hours."
        backLink="/exams"
        backText="Back to Exams"
        showNotificationButton={true}
        notificationTopic={`feature:exam-details:${examData.id || examData._id}`}
        icon={Zap}
      />
    );
  }

  const currentYearData = yearlyData?.[selectedYear];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
       {/* Breadcrumb */}
       <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Exams', path: '/exams' },
              { label: categoryData?.label || 'Category', path: `/exams/category/${categoryData?.id}` },
              { label: examData.title }
            ]}
          />
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative py-16 md:py-24 overflow-hidden bg-slate-950 text-white">
           <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] -ml-32 -mb-32" />
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row gap-12 items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-4 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                  Official {categoryData?.label} Exam
                </span>
                {currentYearData?.status && (
                  <span className="px-4 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    {currentYearData.status}
                  </span>
                )}
              </div>

              <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight tracking-tight">
                {examData.title} <span className="text-indigo-400">{selectedYear}</span>
              </h1>
              <p className="text-xl text-white/60 font-medium mb-8 max-w-2xl">{examData.fullName || examData.title}</p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 group hover:bg-white/10 transition-all">
                  <Users className="w-6 h-6 text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Vacancies</p>
                  <p className="text-2xl font-black">{currentYearData?.vacancy?.toLocaleString() || 'TBA'}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 group hover:bg-white/10 transition-all">
                  <Calendar className="w-6 h-6 text-emerald-400 mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Notification</p>
                  <p className="text-xl font-black">{currentYearData?.notificationDate ? new Date(currentYearData.notificationDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric'}) : 'Released'}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 group hover:bg-white/10 transition-all">
                  <Target className="w-6 h-6 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Tier-I Date</p>
                  <p className="text-xl font-black">{currentYearData?.tier1ExamDate ? new Date(currentYearData.tier1ExamDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'June 2026'}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 group hover:bg-white/10 transition-all">
                  <Building2 className="w-6 h-6 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Auth Body</p>
                  <p className="text-xl font-black">{effectiveContent?.conductingBody || 'SSC'}</p>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-[320px] bg-white/5 backdrop-blur-2xl rounded-[3rem] p-8 border border-white/10 shadow-2xl">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 animate-bounce-subtle">🎯</div>
                  <h3 className="text-xl font-black mb-2">Crack This Exam</h3>
                  <p className="text-white/50 text-xs font-medium">Full preparations with mocks & notes</p>
                </div>
                <div className="space-y-4">
                  {/* Enroll/Unenroll Button */}
                  <button 
                    onClick={handleEnrollToggle}
                    disabled={enrollmentLoading}
                    className={`w-full py-4 rounded-2xl font-black text-xs transition-all shadow-xl flex items-center justify-center gap-2 group ${
                      isEnrolled 
                        ? 'bg-red-500/20 text-white border border-red-500/30 hover:bg-red-500/30' 
                        : 'bg-white text-slate-950 hover:bg-indigo-50 shadow-white/5'
                    }`}
                  >
                    {enrollmentLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isEnrolled ? (
                      <>
                        <Minus className="w-4 h-4" /> UNENROLL FROM EXAM
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> ENROLL IN EXAM
                      </>
                    )}
                  </button>
                  <button onClick={() => navigate('/test-series')} className="w-full py-4 bg-white/10 text-white border border-white/10 rounded-2xl font-black text-xs hover:bg-white/20 transition-all flex items-center justify-center gap-2 group">
                    START PREPARATION <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button onClick={() => navigate('/pass')} className="w-full py-4 bg-white/10 text-white border border-white/10 rounded-2xl font-black text-xs hover:bg-white/20 transition-all flex items-center justify-center gap-2">
                    GET PRO PASS <Award className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-20">
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-3 border border-gray-100 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {[
            { id: 'overview', label: 'Overview', icon: Target },
            { id: 'updates', label: 'Updates', icon: Bell },
            { id: 'syllabus', label: 'Syllabus', icon: ListChecks },
            { id: 'pattern', label: 'Pattern', icon: Layout },
            { id: 'pyq', label: 'Archive', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          <div className="lg:col-span-2 space-y-10">
            {activeTab === 'overview' && (
              <div className="animate-fade-in space-y-10">
                <section className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
                  <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                    <span className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><FileText className="w-5 h-5"/></span>
                    Exam Highlights
                  </h2>
                  <div className="prose prose-slate max-w-none text-gray-600 font-medium leading-relaxed">
                    {examData.description || effectiveContent?.overview || 'Detailed overview being compiled by our subject experts.'}
                  </div>
                </section>

                <section className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
                  <h2 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
                    <span className="p-2 bg-purple-50 rounded-xl text-purple-600"><GraduationIcon className="w-5 h-5"/></span>
                    Eligibility Logic
                  </h2>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="p-8 bg-slate-50 rounded-3xl border border-gray-100">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Qualification</p>
                      <p className="text-gray-900 font-black leading-snug">{effectiveContent?.basicEligibility || 'Graduate in any discipline'}</p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-3xl border border-gray-100">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Age Window</p>
                      <p className="text-gray-900 font-black leading-snug">{effectiveContent?.basicAgeLimit || '18 to 32 Years'}</p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'updates' && (
              <div className="animate-fade-in space-y-6">
                {updates && updates.length > 0 ? updates.map((update, idx) => (
                   <div key={idx} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-start gap-4">
                      <div className={`p-3 rounded-2xl ${update.priority === 'high' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-gray-400 uppercase">{new Date(update.date).toLocaleDateString()}</span>
                          {update.priority === 'high' && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[8px] font-black rounded uppercase">Urgent</span>}
                        </div>
                        <h4 className="font-black text-gray-900 mb-2">{update.title}</h4>
                        <p className="text-sm text-gray-600 font-medium">{update.description}</p>
                      </div>
                   </div>
                )) : (
                  <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
                    <p className="text-4xl mb-4">📢</p>
                    <p className="font-black text-gray-500">No recent official updates recorded.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'syllabus' && (
              <div className="animate-fade-in space-y-8">
                 <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8">
                      <button className="flex items-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors">
                        <Download className="w-4 h-4" /> DOWNLOAD PDF SYLLABUS
                      </button>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-8">Detailed Subject Mapping</h2>
                    <div className="space-y-12">
                       {(effectiveContent?.syllabus || []).map((subject, sIdx) => (
                         <div key={sIdx}>
                            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-4">
                              {subject.subject}
                              <span className="flex-1 h-px bg-indigo-50" />
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                               {subject.chapters.map((chapter, cIdx) => (
                                 <div key={cIdx} className="p-6 bg-slate-50 rounded-2xl border border-gray-100 hover:border-indigo-100 transition-all group">
                                    <h4 className="font-black text-gray-900 mb-1 group-hover:text-indigo-600">{chapter.name}</h4>
                                    <p className="text-xs text-gray-500 font-medium">{chapter.topics?.join(', ')}</p>
                                 </div>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'pattern' && (
              <div className="animate-fade-in space-y-10">
                 <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
                    <h2 className="text-2xl font-black text-gray-900 mb-8">Tier-I Examination Structure</h2>
                    <div className="overflow-hidden rounded-3xl border border-gray-100">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Section / Subject</th>
                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Questions</th>
                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Max Marks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                           {(effectiveContent?.pattern?.tier1 || []).map((sec, i) => (
                             <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                               <td className="p-6 font-black text-gray-900 text-sm">{sec.section}</td>
                               <td className="p-6 text-center font-bold text-gray-500">{sec.questions}</td>
                               <td className="p-6 text-center font-black text-indigo-600">{sec.marks}</td>
                             </tr>
                           ))}
                        </tbody>
                        <tfoot>
                           <tr className="bg-indigo-600 text-white font-black">
                              <td className="p-6 text-sm">TOTAL POTENTIAL</td>
                              <td className="p-6 text-center">{(effectiveContent?.pattern?.tier1 || []).reduce((acc, s) => acc + s.questions, 0)} Qs</td>
                              <td className="p-6 text-center">{(effectiveContent?.pattern?.tier1 || []).reduce((acc, s) => acc + s.marks, 0)} Marks</td>
                           </tr>
                        </tfoot>
                      </table>
                    </div>
                 </div>
              </div>
            )}
            
            {activeTab === 'pyq' && (
              <div className="animate-fade-in p-10 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                 <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                    <History className="w-10 h-10 text-indigo-600" />
                 </div>
                 <h3 className="text-xl font-black text-gray-900 mb-2">Previous Year Archive</h3>
                 <p className="text-gray-500 font-medium max-w-sm mb-8">Access sorted question papers from 2018 to 2025 with detailed solutions.</p>
                 <button onClick={() => navigate('/pyps')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
                    OPEN ARCHIVE
                 </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
             <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl" />
                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-6">Target Roadmap</h3>
                <div className="space-y-6 relative z-10">
                   {(currentYearData?.importantDates || [
                     { event: 'Notification', date: 'March 1, 2026', status: 'upcoming' },
                     { event: 'Applications', date: 'March-April 2026', status: 'upcoming' },
                     { event: 'Exam Tier-I', date: 'June 2026', status: 'upcoming' }
                   ]).map((item, idx) => (
                     <div key={idx} className="flex gap-4">
                        <div className="flex flex-col items-center gap-1">
                           <div className={`w-3 h-3 rounded-full border-2 ${item.status === 'upcoming' ? 'bg-transparent border-indigo-500' : 'bg-green-500 border-green-500'}`} />
                           {idx < 2 && <div className="w-px h-full bg-white/10" />}
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-white/40 uppercase mb-0.5">{item.event}</p>
                           <p className="text-xs font-black">{item.date}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Related Exams</h3>
                <div className="space-y-4">
                   {/* Here we would normally map relatedExams from the query */}
                   <p className="text-xs text-gray-400 font-medium italic">Scanning for related exams in the same category...</p>
                   <button onClick={() => navigate('/exams')} className="w-full py-3 bg-gray-50 text-gray-800 rounded-xl font-bold text-[10px] hover:bg-gray-100 transition-all outline-none uppercase tracking-widest">
                      BROWSE ALL {categoryData?.label} EXAMS
                   </button>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
