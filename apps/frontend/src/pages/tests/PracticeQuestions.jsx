import { useState, useEffect, useMemo } from 'react'
import { BookOpen, Clock, CheckCircle, XCircle, ChevronRight, Loader2, Search, Bookmark, Target, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../../shared/lib/api'
import { AnimatedHero, Breadcrumb } from '../../shared/components'

export default function PracticeQuestions() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState({ correct: 0, incorrect: 0, skipped: 0 })

  // Fetch Categories from Real API
  const { data: categoriesData = [] } = useQuery({
    queryKey: ['exam-categories-practice'],
    queryFn: async () => {
      const response = await api.get('/api/exam-categories')
      return response.data?.data || []
    },
    staleTime: 1000 * 60 * 30, // 30 mins
  })

  const categoryOptions = useMemo(() => {
    const list = [{ id: 'all', name: 'All Topics' }]
    categoriesData.forEach(cat => {
      list.push({ id: cat.id || cat._id, name: cat.name || cat.title || 'Unknown' })
    })
    return list
  }, [categoriesData])

  // Fetch Questions from Real API
  const { data: questions = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['practice-questions', selectedCategory],
    queryFn: async () => {
      const categoryParam = selectedCategory === 'all' ? '' : `?subject=${selectedCategory}`
      const response = await api.get(`/api/practice/questions${categoryParam}`)
      return response.data?.data || []
    },
    staleTime: 1000 * 60 * 5, // 5 mins
  })

  // Handle Question Logic
  const currentQ = questions[currentQuestionIdx]
  
  const handleAnswer = (index) => {
    if (showResult) return
    setSelectedAnswer(index)
  }

  const checkAnswer = () => {
    if (selectedAnswer === null) return
    setShowResult(true)
    
    // Normalize correct answer index (backend might send string or 0-indexed number)
    const correctAnswerIdx = typeof currentQ.correctAnswer === 'string' 
      ? parseInt(currentQ.correctAnswer) 
      : currentQ.correctAnswer
      
    if (selectedAnswer === correctAnswerIdx) {
      setScore(prev => ({ ...prev, correct: prev.correct + 1 }))
    } else {
      setScore(prev => ({ ...prev, incorrect: prev.incorrect + 1 }))
    }
  }

  const nextQuestion = () => {
    setSelectedAnswer(null)
    setShowResult(false)
    setCurrentQuestionIdx(prev => prev + 1)
  }

  const resetQuiz = () => {
    setCurrentQuestionIdx(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore({ correct: 0, incorrect: 0, skipped: 0 })
  }

  const getOptionClass = (index) => {
    if (!showResult) {
      return selectedAnswer === index 
        ? 'border-indigo-600 bg-indigo-50 shadow-md ring-1 ring-indigo-200' 
        : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
    }
    
    const isSelected = selectedAnswer === index
    const correctAnswerIdx = typeof currentQ.correctAnswer === 'string' 
      ? parseInt(currentQ.correctAnswer) 
      : currentQ.correctAnswer
    const isCorrect = index === correctAnswerIdx
    
    if (isCorrect) return 'border-emerald-500 bg-emerald-50 text-emerald-900'
    if (isSelected && !isCorrect) return 'border-red-500 bg-red-50 text-red-900'
    return 'border-gray-100 opacity-60'
  }

  // Loading State
  if (isLoading || (isFetching && questions.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 font-bold animate-pulse">Loading Practice Lab...</p>
      </div>
    )
  }

  // Finish State
  if (currentQuestionIdx >= questions.length && questions.length > 0) {
    const total = questions.length
    const percentage = Math.round((score.correct / total) * 100)
    
    return (
      <div className="min-h-screen bg-[#f8fafc] py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 p-10 md:p-16 text-center border border-indigo-50/50">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ${
              percentage >= 70 ? 'bg-emerald-100' : percentage >= 40 ? 'bg-amber-100' : 'bg-red-100'
            }`}>
              <div className={`text-3xl font-black ${
                percentage >= 70 ? 'text-emerald-600' : percentage >= 40 ? 'text-amber-600' : 'text-red-600'
              }`}>{percentage}%</div>
            </div>
            
            <h2 className="text-3xl font-black text-gray-900 mb-3">Session Complete!</h2>
            <p className="text-gray-500 mb-10 max-w-sm mx-auto font-medium">
              {percentage >= 70 ? 'Stellar performance! You have a solid grasp of these concepts.' : percentage >= 40 ? 'Good progress! A bit more practice will make you perfect.' : 'Keep at it! Regular practice is the key to mastery.'}
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-12">
              <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100/50">
                <p className="text-3xl font-black text-emerald-600 leading-none">{score.correct}</p>
                <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest mt-2">Correct</p>
              </div>
              <div className="bg-red-50/50 rounded-2xl p-5 border border-red-100/50">
                <p className="text-3xl font-black text-red-600 leading-none">{score.incorrect}</p>
                <p className="text-[10px] font-bold text-red-700/60 uppercase tracking-widest mt-2">Missed</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <p className="text-3xl font-black text-slate-600 leading-none">{total}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Total</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={resetQuiz}
                className="flex-1 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
              >
                Restart Session
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex-1 bg-white text-gray-700 px-8 py-4 rounded-2xl font-black text-sm border-2 border-gray-100 hover:bg-gray-50 transition-all"
              >
                Exit Practice
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header & Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <Breadcrumb 
            items={[{ label: 'Home', path: '/' }, { label: 'Practice Lab' }]}
          />
        </div>
      </div>

      <AnimatedHero
        pageType="practice"
        title="Interactive Practice Lab"
        subtitle="Master concepts with real-time feedback and detailed explanations. Powered by AI."
        compact={true}
      />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar - Topics */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm sticky top-24">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Target className="w-3.5 h-3.5" /> Select Topic
              </h3>
              <div className="flex flex-col gap-1.5">
                {categoryOptions.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id)
                      resetQuiz()
                    }}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all duration-300 ${
                      selectedCategory === cat.id 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate pr-2">{cat.name}</span>
                    {selectedCategory === cat.id && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Question Area */}
          <div className="lg:col-span-3">
            {questions.length > 0 ? (
              <div className="flex flex-col gap-6">
                {/* Progress Card */}
                <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm flex items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-black text-gray-500">Q{currentQuestionIdx + 1}/{questions.length}</span>
                    </div>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-black text-emerald-600">{score.correct}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-black text-red-500">{score.incorrect}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Question {currentQuestionIdx + 1} / {questions.length}</span>
                      <div className="flex gap-4">
                        <span className="text-[10px] font-black text-emerald-600">✓ {score.correct} Correct</span>
                        <span className="text-[10px] font-black text-red-500">✗ {score.incorrect} Missed</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100/50">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${((currentQuestionIdx + 1) / questions.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Question Section */}
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-12 animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl -mr-16 -mt-16" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100/50">
                        {currentQ.category || categoryOptions.find(c => c.id === selectedCategory)?.name || 'General'}
                      </span>
                      <button className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all text-gray-300">
                        <Bookmark className="w-5 h-5" />
                      </button>
                    </div>

                    <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 mb-10 leading-snug">
                      {currentQ.question}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                      {currentQ.options?.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleAnswer(index)}
                          disabled={showResult}
                          className={`group p-5 rounded-2xl border-2 text-left flex items-start gap-4 transition-all duration-300 relative ${getOptionClass(index)}`}
                        >
                          <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center text-xs font-black flex-shrink-0 transition-all ${
                            selectedAnswer === index ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-100 text-gray-400 group-hover:border-indigo-200'
                          }`}>
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className="font-bold text-sm md:text-base pt-1">{option}</span>
                          
                          {showResult && index === (typeof currentQ.correctAnswer === 'string' ? parseInt(currentQ.correctAnswer) : currentQ.correctAnswer) && (
                            <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Explanation */}
                    <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showResult ? 'max-h-[500px] opacity-100 mb-10' : 'max-h-0 opacity-0'}`}>
                      <div className="bg-indigo-50/50 border-l-4 border-indigo-500 rounded-2xl p-6">
                        <h4 className="flex items-center gap-2 font-black text-indigo-950 text-xs uppercase tracking-widest mb-3">
                          <BookOpen className="w-4 h-4" /> Explanation
                        </h4>
                        <p className="text-gray-700 text-sm md:text-base leading-relaxed">
                          {currentQ.explanation || 'No explanation provided for this question.'}
                        </p>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-50">
                      {!showResult ? (
                        <button
                          onClick={checkAnswer}
                          disabled={selectedAnswer === null}
                          className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-100"
                        >
                          Check Answer
                        </button>
                      ) : (
                        <button
                          onClick={nextQuestion}
                          className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 group"
                        >
                          Next Challenge <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      )}
                      <button className="px-8 py-4 bg-gray-50 text-gray-400 font-bold text-sm rounded-2xl hover:bg-gray-100 transition-all border border-gray-100">
                        Discuss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-20 text-center">
                <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-8">
                  <AlertCircle className="w-12 h-12 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3">Topic Under Construction</h3>
                <p className="text-gray-500 mb-10 max-w-sm mx-auto font-medium">We're currently curating high-quality questions for this topic. Please try another one.</p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => {
                      setSelectedCategory('all')
                      resetQuiz()
                    }}
                    className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
                  >
                    View All Topics
                  </button>
                  <button
                    onClick={() => refetch()}
                    className="bg-white text-gray-700 px-8 py-3.5 rounded-2xl font-black text-sm border-2 border-gray-100 hover:bg-gray-50 transition-all"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}