export { default as AdminLayout } from './AdminLayout.jsx'
export { default as ProtectedRoute } from './ProtectedRoute.jsx'
export { default as Breadcrumb } from './common/Breadcrumb.jsx'
export { default as AdminPageHeader } from './admin/AdminPageHeader.jsx'
export { default as CommandPalette } from './common/CommandPalette.jsx'
export { default as AdminBottomNav } from './AdminBottomNav.jsx'

// Logo component inline export
export function Logo({ containerSize = "", iconSize = "w-6 h-6", textSize = "text-xl" }) {
  return (
    <div className={`flex items-center gap-2 shrink-0 ${containerSize}`}>
      <div className={`${iconSize} shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center`}>
        <span className="text-white font-bold text-sm">T</span>
      </div>
      <span className={`${textSize} font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent shrink-0`}>
        TrstPrep
      </span>
    </div>
  )
}
