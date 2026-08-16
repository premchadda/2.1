import { useState, lazy, Suspense } from 'react'
import { Users, Shield } from 'lucide-react'
import { useSearchParams, useLocation } from 'react-router-dom'

const UsersManager = lazy(() => import('./UsersManager'))
const RolePermissionsManager = lazy(() => import('./RolePermissionsManager'))

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
]

export default function UsersPermissions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const defaultTab = location.pathname.includes('roles-permissions') ? 'roles' : 'users'
  const activeTab = searchParams.get('tab') || defaultTab

  const setActiveTab = (tabId) => {
    setSearchParams({ tab: tabId })
  }

  return (
    <div className="space-y-0">
      {/* Tab Bar */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
        <div className="px-6 pt-4 pb-0">
          <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-indigo-500 dark:to-indigo-400 rounded-lg shadow-md" />
                  )}
                  <span className="relative flex items-center gap-2">
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="border-b border-gray-200 dark:border-gray-700" />
      </div>

      {/* Tab Content */}
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      }>
        {activeTab === 'users' && <UsersManager />}
        {activeTab === 'roles' && <RolePermissionsManager />}
      </Suspense>
    </div>
  )
}
