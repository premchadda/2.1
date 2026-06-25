import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Users, FileText, BookOpen, Video, Upload, 
  Settings, TrendingUp, TestTube2, HelpCircle,
  BarChart3, Activity, Calendar, Clock, Eye,
  DollarSign, AlertTriangle, CheckCircle, Filter,
  ArrowUp, ArrowDown, FileQuestion, Gift
} from 'lucide-react'
import { apiClient } from '../../../shared/lib/dataService.js'
import { useAuth } from '../../../shared/providers/AuthContext'
import { useTheme } from '../../../shared/context/ThemeContext'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [error, setError] = useState(null)
  const { user, isAdmin } = useAuth()
  const { isDarkMode } = useTheme()

  useEffect(() => {
    if (isAdmin()) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [timeRange])

  // CRIT-03 FIX: Use shared apiClient with cookie-based auth instead of localStorage token
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch dashboard stats
      const statsResponse = await apiClient.get('/admin/stats?range=' + timeRange)
      setStats(statsResponse?.data?.data || null)

      // Fetch analytics data
      const analyticsResponse = await apiClient.get('/admin/analytics?range=' + timeRange)
      setAnalytics(analyticsResponse?.data?.data || null)

      // Fetch recent activity
      const activityResponse = await apiClient.get('/admin/recent-activity')
      setRecentActivity(activityResponse?.data?.data || [])
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        setError('Access denied. Please check your admin privileges.')
      } else {
        setError('Failed to load dashboard data. Please try again later.')
      }
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Topics',
      value: stats?.topics || 0,
      icon: BookOpen,
      color: 'bg-blue-500',
      trend: stats?.trends?.topics || null,
      link: '/admin/study-materials'
    },

    {
      title: 'PDFs',
      value: stats?.pdfs || 0,
      icon: FileText,
      color: 'bg-orange-500',
      trend: stats?.trends?.pdfs || null,
      link: '/admin/media'
    },
    {
      title: 'Tests',
      value: stats?.tests || 0,
      icon: TestTube2,
      color: 'bg-green-500',
      trend: stats?.trends?.tests || null,
      link: '/admin/tests'
    },
    {
      title: 'Total Users',
      value: stats?.users || 0,
      icon: Users,
      color: 'bg-purple-500',
      trend: stats?.trends?.users || null,
      link: '/admin/users'
    },
    {
      title: 'Questions',
      value: stats?.questions || 0,
      icon: HelpCircle,
      color: 'bg-indigo-500',
      trend: stats?.trends?.questions || null,
      link: '/admin/questions'
    }
  ]

  const quickActions = [
    { title: 'New Test', icon: FileText, link: '/admin/tests', color: 'text-pink-500' },
    { title: 'Add Question', icon: FileQuestion, link: '/admin/questions', color: 'text-purple-600' },
    { title: 'Manage Users', icon: Users, link: '/admin/users', color: 'text-blue-500' },
    { title: 'New Promo', icon: Gift, link: '/admin/promotions', color: 'text-emerald-500' },
    { title: 'Site Settings', icon: Settings, link: '/admin/settings', color: isDarkMode ? 'text-gray-400' : 'text-gray-600' }
  ]

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen`}>
        <div className={`animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent`}></div>
      </div>
    )
  }

  return (
    <div className={`p-6 space-y-6`}>
      {/* Error Message */}
      {error && (
        <div className={`bg-red-50 border-l-4 border-red-500 p-4 rounded`}>
          <div className={`flex items-start`}>
            <AlertTriangle className={`h-5 w-5 text-red-500 mt-0.5 mr-3`} />
            <div>
              <p className={`text-sm font-medium text-red-800`}>{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center md:justify-between`}>
        <div>
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>Admin Dashboard</h1>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Monitor and manage your platform performance</p>
        </div>
        <div className={`flex items-center gap-4 mt-4 md:mt-0`}>
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className={`border ${isDarkMode ? 'border-gray-700' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500`}
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4`}>
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <div 
              key={index}
              className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-sm border ${isDarkMode ? 'border-gray-800' : 'border-gray-100'} p-3 md:p-5 hover:shadow-md transition-shadow flex flex-col justify-between`}
            >
              <div className={`flex items-start justify-between mb-2`}>
                <p className={`text-gray-500 text-[10px] md:text-xs font-semibold leading-tight uppercase tracking-wide`}>{card.title}</p>
                <div className={`${card.color} p-1.5 md:p-2 rounded-md shrink-0 ml-1`}>
                  <Icon className={`w-3.5 h-3.5 md:w-5 md:h-5 text-white`} />
                </div>
              </div>
              <div>
                <p className={`text-lg md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1`}>{card.value}</p>
                {card.trend && (
                  <div className={`flex flex-wrap items-center`}>
                    <span className={`flex items-center text-green-600 text-[10px] md:text-xs font-semibold ${isDarkMode ? 'bg-green-500/10' : 'bg-green-50'} px-1 py-0.5 rounded mr-1`}>
                      <ArrowUp className={`w-2.5 h-2.5 mr-0.5`} />
                      {card.trend}
                    </span>
                    <span className={`hidden xl:inline-block text-gray-400 text-[9px] truncate`}>vs last period</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions - Second Section */}
      <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-sm border ${isDarkMode ? 'border-gray-800' : 'border-gray-100'} p-5 md:p-6 mb-6`}>
        <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4 flex items-center gap-2`}>
          <TrendingUp className={`w-5 h-5 text-indigo-500`} />
          Quick Actions
        </h2>
        <div className={`grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4`}>
          {quickActions.map((action, index) => {
            const Icon = action.icon
            return (
              <Link
                key={index}
                to={action.link}
                className={`flex flex-col items-center justify-center p-3 md:p-4 border ${isDarkMode ? 'border-gray-800' : 'border-gray-100'} ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group`}
              >
                <Icon className={`w-5 h-5 md:w-6 md:h-6 mb-2 ${action.color} group-hover:scale-110 transition-transform`} />
                <span className={`text-[10px] md:text-xs text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>{action.title}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Charts and Analytics Section */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6`}>
        {/* User Activity Chart */}
        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-md p-6`}>
          <div className={`flex items-center justify-between mb-4`}>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>User Activity</h3>
            <BarChart3 className={`w-5 h-5 text-gray-500`} />
          </div>
          <div className={`h-64`}>
            <div className={`flex items-end justify-between h-48 space-x-2`}>
              {analytics?.dailyUsers?.map((item, index) => (
                <div key={index} className={`flex flex-col items-center flex-1`}>
                  <div className={`flex items-end justify-center space-x-1 flex-1 w-full`}>
                    <div 
                      className={`w-8 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors`}
                      style={{ height: `${(item.users / Math.max(...analytics.dailyUsers.map(d => d.users))) * 80}%` }}
                    ></div>
                    <div 
                      className={`w-8 bg-green-500 rounded-t hover:bg-green-600 transition-colors`}
                      style={{ height: `${(item.tests / Math.max(...analytics.dailyUsers.map(d => d.tests))) * 80}%` }}
                    ></div>
                  </div>
                  <span className={`text-xs text-gray-500 mt-2`}>{item.day}</span>
                </div>
              )) || (
                <div className={`flex flex-col items-center justify-center w-full h-48 gap-3`}>
                  <BarChart3 className={`w-10 h-10 ${isDarkMode ? 'text-gray-700' : 'text-gray-200'}`} />
                  <p className={`text-sm ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>No activity data yet</p>
                  <div className={`flex items-end gap-2 opacity-30`}>
                    {[40, 65, 30, 80, 50, 70, 45].map((h, i) => (
                      <div key={i} className="flex gap-1 items-end">
                        <div className={`w-4 rounded-t ${isDarkMode ? 'bg-blue-900' : 'bg-blue-200'}`} style={{ height: `${h}px` }} />
                        <div className={`w-4 rounded-t ${isDarkMode ? 'bg-green-900' : 'bg-green-200'}`} style={{ height: `${h * 0.6}px` }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
            <div className={`flex justify-center space-x-6 mt-4`}>
              <div className={`flex items-center`}>
                <div className={`w-3 h-3 bg-blue-500 rounded mr-2`}></div>
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Users</span>
              </div>
              <div className={`flex items-center`}>
                <div className={`w-3 h-3 bg-green-500 rounded mr-2`}></div>
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tests</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Performing Tests */}
        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-md p-6`}>
          <div className={`flex items-center justify-between mb-4`}>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Top Performing Tests</h3>
            <TrendingUp className={`w-5 h-5 text-gray-500`} />
          </div>
          <div className={`space-y-3`}>
            {(analytics?.topTests || []).map((test, index) => (
              <div key={index} className={`flex items-center justify-between p-3 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg`}>
                <div className={`flex-1`}>
                  <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'} text-sm`}>{test.name}</p>
                  <div className={`flex items-center mt-1`}>
                    <span className={`text-xs text-gray-500 mr-3`}>Attempts: {test.attempts}</span>
                    <span className={`text-xs text-gray-500`}>Completion: {test.completion}</span>
                  </div>
                </div>
                <div className={`w-16 bg-gray-200 rounded-full h-2`}>
                  <div 
                    className={`bg-green-500 h-2 rounded-full`} 
                    style={{ width: test.completion.replace('%', '') + '%' }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6`}>
        {/* We place an empty div or combine with another dashboard component to maintain grid layout, or just let Recent Activity span */}
        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-md p-6 lg:col-span-2`}>
          <div className={`flex items-center justify-between mb-4`}>
            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recent Activity</h2>
            <Filter className={`w-5 h-5 text-gray-500`} />
          </div>
          <div className={`space-y-4`}>
            {recentActivity.map((activity, index) => {
              const getIcon = (iconName) => {
                switch(iconName) {
                  case 'users': return Users;
                  case 'test': return TestTube2;
                  case 'book': return BookOpen;
                  case 'video': return Video;
                  default: return HelpCircle;
                }
              }
              
              const Icon = getIcon(activity.icon)
              return (
                <div key={index} className={`flex items-start gap-3 p-3 hover:${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg transition-colors`}>
                  <div className={`bg-gray-100 p-2 rounded-full ${activity.color}`}>
                    <Icon className={`w-4 h-4`} />
                  </div>
                  <div className={`flex-1`}>
                    <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'} text-sm`}>{activity.title}</p>
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{activity.description}</p>
                  </div>
                  <span className={`text-xs text-gray-500 whitespace-nowrap`}>{activity.time}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Platform Overview */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6`}>
        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-md p-6`}>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>User Growth</h2>
          <div className={`grid grid-cols-2 gap-4`}>
            <div className={`text-center p-4 bg-blue-50 rounded-lg`}>
              <Users className={`w-8 h-8 text-blue-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{analytics?.userGrowth?.total || stats?.users || 0}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Users</p>
            </div>
            <div className={`text-center p-4 ${isDarkMode ? 'bg-green-500/10' : 'bg-green-50'} rounded-lg`}>
              <Activity className={`w-8 h-8 text-green-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{analytics?.userGrowth?.activeUsers || stats?.activeUsers || 0}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Active Users</p>
            </div>
            <div className={`text-center p-4 bg-purple-50 rounded-lg col-span-2`}>
              <TrendingUp className={`w-8 h-8 text-purple-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>+{analytics?.userGrowth?.growthRate || '0'}%</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Growth Rate</p>
            </div>
          </div>
        </div>

        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-md p-6`}>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Content Engagement</h2>
          <div className={`grid grid-cols-2 md:grid-cols-2 gap-4`}>
            <div className={`text-center p-4 bg-blue-50 rounded-lg`}>
              <BookOpen className={`w-8 h-8 text-blue-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats?.topics || 0}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Topics</p>
            </div>

            <div className={`text-center p-4 bg-orange-50 rounded-lg`}>
              <FileText className={`w-8 h-8 text-orange-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats?.pdfs || 0}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>PDFs</p>
            </div>
            <div className={`text-center p-4 ${isDarkMode ? 'bg-green-500/10' : 'bg-green-50'} rounded-lg`}>
              <TestTube2 className={`w-8 h-8 text-green-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats?.tests || 0}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tests</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      {stats?.pageViews && (
        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-md p-6`}>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Platform Performance</h2>
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4`}>
            <div className={`text-center p-4 bg-blue-50 rounded-lg`}>
              <Eye className={`w-8 h-8 text-blue-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats?.pageViews || 0}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Page Views</p>
            </div>
            <div className={`text-center p-4 ${isDarkMode ? 'bg-green-500/10' : 'bg-green-50'} rounded-lg`}>
              <Clock className={`w-8 h-8 text-green-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats?.avgTimeOnSite || '0m'}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Avg Time</p>
            </div>
            <div className={`text-center p-4 bg-yellow-50 rounded-lg`}>
              <AlertTriangle className={`w-8 h-8 text-yellow-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats?.errors || 0}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Errors</p>
            </div>
            <div className={`text-center p-4 bg-purple-50 rounded-lg`}>
              <DollarSign className={`w-8 h-8 text-purple-600 mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats?.revenue || '₹0'}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Revenue</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
