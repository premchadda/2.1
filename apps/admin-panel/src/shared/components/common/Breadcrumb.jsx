import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb-container hidden md:flex items-center gap-2 text-sm text-gray-500 py-3 overflow-x-auto scrollbar-hide">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const path = item.path || item.to;
        
        return (
          <div key={index} className="flex items-center gap-2 whitespace-nowrap">
            {index === 0 && <Home className="w-4 h-4" />}
            
            {path && !isLast ? (
              <Link 
                to={path}
                className="breadcrumb-link text-brand-start hover:underline font-medium"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`breadcrumb-current ${isLast ? 'text-gray-900 font-medium' : ''}`}>
                {item.label}
              </span>
            )}
            
            {!isLast && (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default Breadcrumb
