const FEATURES = [
  { icon: '📝', title: 'Real Exam Pattern', desc: 'Practice with actual questions from past exams' },
  { icon: '🎯', title: 'Identify Key Topics', desc: 'Spot high-weightage topics from trend analysis' },
  { icon: '⏱️', title: 'Master Time Management', desc: 'Build speed and accuracy under real exam conditions' },
]

function WhyAttemptRow({ features = FEATURES }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-3">Why Attempt Previous Year Papers?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {features.map((f, i) => (
          <div
            key={i}
            className="flex flex-col items-center text-center p-4 rounded-xl bg-gradient-to-br from-gray-50 to-indigo-50/30 border border-gray-100"
          >
            <span className="text-2xl mb-2">{f.icon}</span>
            <span className="text-xs font-bold text-gray-900">{f.title}</span>
            <span className="text-[11px] text-gray-500 mt-1">{f.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default WhyAttemptRow