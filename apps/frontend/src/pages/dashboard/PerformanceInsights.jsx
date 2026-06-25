import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { AnimatedHero, Card, Badge, Button, ScrollReveal } from '../../shared/components'
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, PieChart, Activity, Target, Clock, Award, Brain, Zap, AlertTriangle, CheckCircle, BookOpen, ChevronRight, Sparkles } from 'lucide-react'

const timeframeOptions = ['This Week', 'This Month', 'This Quarter', 'All Time']

function PerformanceInsights() {
  const { user } = useAuth()
  const [timeframe, setTimeframe] = useState('This Month')
  const [expandedSection, setExpandedSection] = useState(null)

  const toggleSection = (key) => {
    setExpandedSection(expandedSection === key ? null : key)
  }

  const overviewStats = [
    { label: 'Tests Taken', value: '47', change: '+8', trend: 'up', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Avg. Accuracy', value: '72%', change: '+5%', trend: 'up', icon: Target, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Avg. Score', value: '68.5', change: '+3.2', trend: 'up', icon: Award, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Time Spent', value: '42h', change: '+12h', trend: 'up', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: 'Streak', value: '7 days', change: 'Best: 14', trend: 'neutral', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Rank', value: '#128', change: '+15', trend: 'up', icon: Award, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  ]

  const subjectBreakdown = [
    { name: 'Quantitative Aptitude', accuracy: 68, tests: 14, trend: 'up', color: 'from-blue-400 to-blue-600' },
    { name: 'Reasoning', accuracy: 75, tests: 11, trend: 'up', color: 'from-purple-400 to-purple-600' },
    { name: 'General Awareness', accuracy: 58, tests: 9, trend: 'down', color: 'from-orange-400 to-orange-600' },
    { name: 'English', accuracy: 82, tests: 8, trend: 'up', color: 'from-green-400 to-green-600' },
    { name: 'Computer Knowledge', accuracy: 45, tests: 5, trend: 'down', color: 'from-red-400 to-red-600' },
  ]

  const weakAreas = [
    { topic: 'Data Interpretation', subject: 'Quant', attempts: 12, accuracy: 42, priority: 'high' },
    { topic: 'Computer Fundamentals', subject: 'Computer', attempts: 5, accuracy: 35, priority: 'high' },
    { topic: 'Current Affairs', subject: 'GK', attempts: 8, accuracy: 48, priority: 'medium' },
  ]

  const recommendations = [
    { icon: Brain, title: 'Focus on Data Interpretation', desc: 'Your accuracy is 42%. Try 10 practice sets this week.', action: 'Practice Now', route: '/practice' },
    { icon: BookOpen, title: 'Attempt Full-Length Mock', desc: 'You haven\'t taken a full mock this week. Build endurance.', action: 'Take Mock', route: '/test-series' },
    { icon: Target, title: 'Review Computer Basics', desc: 'Computer Knowledge is your weakest subject at 35%.', action: 'Study Now', route: '/study' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8">
      <AnimatedHero pageType="analysis" compact>
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Performance Insights</h1>
            <p className="text-blue-100 text-sm mt-1">Detailed analysis of your preparation progress</p>
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 relative z-20">
        {/* Timeframe Filter */}
        <ScrollReveal>
          <Card variant="elevated" size="md" className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-start" />
                <span className="font-semibold text-gray-900 dark:text-white">Overview</span>
              </div>
              <div className="flex gap-1">
                {timeframeOptions.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      timeframe === tf
                        ? 'bg-brand-start text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </ScrollReveal>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {overviewStats.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={i * 0.03}>
              <Card variant="elevated" size="md" hover>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <span className={`text-xs font-medium ${stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
                    {stat.trend === 'up' && <TrendingUp className="w-3 h-3 inline" />}
                    {stat.trend === 'down' && <TrendingDown className="w-3 h-3 inline" />}
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Subject Breakdown */}
          <div className="lg:col-span-7">
            <ScrollReveal>
              <Card variant="elevated" className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-brand-start" />
                    Subject-wise Performance
                  </h3>
                </div>
                <div className="space-y-4">
                  {subjectBreakdown.map((subject) => (
                    <div key={subject.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{subject.name}</span>
                          <span className="text-xs text-gray-400">({subject.tests} tests)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${subject.accuracy >= 70 ? 'text-green-600' : subject.accuracy >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {subject.accuracy}%
                          </span>
                          {subject.trend === 'up' ? (
                            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${subject.color} transition-all duration-500`}
                          style={{ width: `${subject.accuracy}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </ScrollReveal>
          </div>

          {/* Weak Areas */}
          <div className="lg:col-span-5">
            <ScrollReveal delay={0.1}>
              <Card variant="elevated" className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Areas to Improve
                  </h3>
                </div>
                <div className="space-y-3">
                  {weakAreas.map((area) => (
                    <div key={area.topic} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{area.topic}</span>
                        <Badge variant={area.priority === 'high' ? 'error' : 'warning'} size="xs">{area.priority}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{area.subject} · {area.attempts} attempts</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full transition-all"
                            style={{ width: `${area.accuracy}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-red-600">{area.accuracy}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" fullWidth className="mt-3 text-brand-start">
                  View All Weak Areas <ChevronRight className="w-3 h-3" />
                </Button>
              </Card>
            </ScrollReveal>
          </div>
        </div>

        {/* AI Recommendations */}
        <ScrollReveal delay={0.15}>
          <Card variant="elevated" className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">Smart Recommendations</h3>
              <Badge variant="primary" size="xs">AI-Powered</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendations.map((rec) => (
                <div key={rec.title} className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-3">
                    <rec.icon className="w-5 h-5 text-brand-start" />
                  </div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{rec.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{rec.desc}</p>
                  <Link to={rec.route} className="text-xs font-semibold text-brand-start dark:text-indigo-400 hover:underline">
                    {rec.action} →
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </ScrollReveal>

        {/* Accordion Details */}
        <ScrollReveal delay={0.2}>
          <Card variant="elevated" className="mb-6">
            {[
              { key: 'accuracy', icon: Target, title: 'Accuracy Trends', content: 'Your accuracy has improved by 5% this month. Focus on General Awareness to maintain upward trajectory.' },
              { key: 'speed', icon: Clock, title: 'Speed Analysis', content: 'Average time per question: 45s. Target: 35s. Practice speed drills for Quantitative Aptitude.' },
              { key: 'consistency', icon: Activity, title: 'Consistency Score', content: 'Your consistency score is 7.4/10. Attempt tests regularly to build momentum.' },
            ].map((section) => (
              <div key={section.key} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <section.icon className="w-4 h-4 text-brand-start" />
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{section.title}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === section.key ? 'rotate-90' : ''}`} />
                </button>
                {expandedSection === section.key && (
                  <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 ml-9">
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </ScrollReveal>
      </div>
    </div>
  )
}

export default PerformanceInsights
