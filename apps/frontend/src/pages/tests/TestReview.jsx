import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { LayoutGrid, ChevronLeft, ChevronRight, X, CheckCircle, XCircle, ArrowLeft, LayoutDashboard } from 'lucide-react'
import sanitizeHtml from '../../shared/lib/sanitizeHtml'
import { apiClient } from '../../shared/lib/dataService'

export default function TestReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { testId } = useParams();
  const seriesId = location.state?.seriesId || null;
  const attemptId = location.state?.attemptId || null;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTestData = async () => {
      // Get test data from location state (passed from legacy components)
      if (location.state?.testData) {
        setTestData(location.state.testData);
        setLoading(false);
        return;
      }

      // If no state, fetch from actual API endpoint
      if (testId) {
        try {
          const response = await apiClient.get(`/api/tests/${testId}/result`);
          if (response.data?.data) {
            setTestData(response.data.data);
          } else {
            setError('Result data not found');
          }
        } catch (err) {
          console.error('Failed to fetch test review data:', err);
          setError('Failed to fetch test review data');
        } finally {
          setLoading(false);
        }
      } else {
        navigate('/dashboard');
      }
    };
    
    fetchTestData();
  }, [location, navigate, testId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !testData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>{error || 'Test data not available.'}</p>
          <button onClick={() => navigate('/dashboard')} className="mt-4 underline text-indigo-600">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const currentQuestion = testData.questions[currentQuestionIndex];
  const userAnswer = testData.userAnswers[currentQuestionIndex];
  const isCorrect = userAnswer?.isCorrect;
  const safeQuestionHtml = sanitizeHtml(currentQuestion?.question || '');
  const safeExplanationHtml = sanitizeHtml(currentQuestion?.explanation || '');

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < testData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleQuestionSelect = (index) => {
    setCurrentQuestionIndex(index);
    setShowPalette(false);
  };

  const getQuestionStatus = (index) => {
    const answer = testData.userAnswers[index];
    if (!answer || !answer.selectedOption) return 'not-answered'
    return answer.isCorrect ? 'correct' : 'incorrect'
  };

  const getStatusColor = (status) => {
    if (status === 'correct') return 'bg-green-500 text-white'
    if (status === 'incorrect') return 'bg-red-500 text-white'
    return 'bg-gray-200 text-gray-700'
  };

  return (
    <div className="flex flex-col h-screen bg-white fixed inset-0 z-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 shadow-sm select-none z-30">
        <div className="font-bold text-lg truncate max-w-[120px] sm:max-w-md text-gray-800">
          Solutions Review
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-xs text-gray-500">
            Question {currentQuestionIndex + 1} of {testData.questions.length}
          </div>
          {/* Back to Results */}
          <button
            onClick={() => seriesId
              ? navigate(`/test-result/${seriesId}/${testId}`, { state: { attemptId } })
              : navigate(-1)}
            className="flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg font-semibold text-xs shadow-sm transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Results</span>
          </button>
          {/* Dashboard */}
          <button
            onClick={() => navigate('/dashboard')}
            className="hidden sm:flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg font-medium text-xs shadow-sm transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <LayoutGrid className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-white overflow-y-auto relative w-full">
          {/* Section Info */}
          <div className="border-b border-gray-200 px-4 sm:px-6 py-3 flex justify-between items-center bg-gray-50 text-xs sm:text-sm">
            <div className="font-semibold text-gray-700">
              Section: <span className="text-indigo-600">{currentQuestion.section || 'General'}</span>
            </div>
            <div className="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
              <span className="text-green-600 font-bold">+{currentQuestion.correctMarks || 2}</span>
              <span className="text-gray-300 mx-1">|</span>
              <span className="text-red-500 font-bold">-{currentQuestion.negativeMarks || 0.5}</span>
            </div>
          </div>

          {/* Question Content */}
          <div className="p-4 sm:p-8 flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {/* Question Number & Status */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">
                    Q{currentQuestionIndex + 1}.
                  </span>
                  {isCorrect !== undefined && (
                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isCorrect ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Correct
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Incorrect
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="mb-8">
                <div 
                  className="text-lg text-gray-800 leading-relaxed prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: safeQuestionHtml }}
                />
              </div>

              {/* Options */}
              <div className="space-y-3 mb-8">
                {currentQuestion.options.map((option, index) => {
                  const optionLetter = String.fromCharCode(65 + index);
                  const isUserAnswer = userAnswer?.selectedOption === index;
                  const isCorrectAnswer = index === currentQuestion.correctOption;
                  
                  let optionClass = 'border-2 border-gray-200 bg-white'
                  
                  if (isCorrectAnswer) {
                    optionClass = 'border-2 border-green-500 bg-green-50'
                  } else if (isUserAnswer && !isCorrect) {
                    optionClass = 'border-2 border-red-500 bg-red-50'
                  }

                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${optionClass} transition-all relative`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-gray-700">
                          {optionLetter}
                        </span>
                        <div className="flex-1">
                          <div 
                            className="text-gray-800"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(option) }}
                          />
                        </div>
                        {isCorrectAnswer && (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                        {isUserAnswer && !isCorrect && (
                          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {currentQuestion.explanation && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Detailed Explanation
                  </h3>
                  <div 
                    className="text-blue-900 prose prose-blue max-w-none"
                    dangerouslySetInnerHTML={{ __html: safeExplanationHtml }}
                  />
                </div>
              )}

              {/* Additional Info */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.difficulty && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Difficulty</div>
                    <div className="font-semibold text-gray-900 capitalize">
                      {currentQuestion.difficulty}
                    </div>
                  </div>
                )}
                {currentQuestion.topic && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Topic</div>
                    <div className="font-semibold text-gray-900">
                      {currentQuestion.topic}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Footer */}
          <div className="border-t border-gray-200 p-4 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center max-w-5xl mx-auto w-full">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="flex-1 sm:flex-none border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-bold whitespace-nowrap transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="inline w-4 h-4 mr-2" />
                Previous
              </button>
              
              <button
                onClick={handleNext}
                disabled={currentQuestionIndex === testData.questions.length - 1}
                className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="inline w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </div>

        {/* Question Palette Sidebar */}
        <div className={`w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto p-4 ${showPalette ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Questions</h3>
            <button
              onClick={() => setShowPalette(false)}
              className="md:hidden p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Legend */}
          <div className="space-y-2 mb-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-gray-600">Correct</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-gray-600">Incorrect</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-200"></div>
              <span className="text-gray-600">Not Answered</span>
            </div>
          </div>

          {/* Question Grid */}
          <div className="grid grid-cols-5 gap-2">
            {testData.questions.map((_, index) => {
              const status = getQuestionStatus(index);
              const isCurrent = index === currentQuestionIndex;
              
              return (
                <button
                  key={index}
                  onClick={() => handleQuestionSelect(index)}
                  className={`
                    h-10 rounded font-semibold text-sm transition-all
                    ${getStatusColor(status)}
                    ${isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2' : ''}
                    hover:scale-110
                  `}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Palette Overlay */}
      {showPalette && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setShowPalette(false)}
        />
      )}
    </div>
  );
}
