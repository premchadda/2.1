import { Link } from 'react-router-dom'

const Logo = ({ 
  className = '', 
  iconSize = 'w-5 h-5 sm:w-6 sm:h-6', 
  containerSize = 'w-8 h-8 sm:w-10 sm:h-10', 
  textSize = 'text-xl sm:text-2xl', 
  hideText = false,
  onClick
}) => {
  return (
    <Link 
      to="/" 
      onClick={onClick}
      className={`flex items-center gap-3 group cursor-pointer flex-shrink-0 ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {/* Deep Glow Layer */}
        <div className="absolute inset-0 bg-indigo-500/30 blur-xl rounded-full group-hover:bg-indigo-500/50 transition-all duration-700 animate-pulse"></div>
        
        {/* Animated Container */}
        <div className={`relative ${containerSize} bg-slate-900 rounded-[0.9rem] flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:rotate-[8deg] transition-all duration-500 overflow-hidden border border-white/10`}>
          {/* Internal Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 opacity-90 group-hover:opacity-100 transition-opacity"></div>
          
          {/* Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
          
          {/* The Custom Mark (Rocket Replacement for Premium feel) */}
          <svg 
            viewBox="0 0 24 24" 
            className={`${iconSize} relative z-10 text-white fill-current drop-shadow-md animate-bounce-subtle`}
            xmlns="http://www.w3.org/2000/svg"
          >
             <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
             <path d="M12 16L7 18.2L12 6L17 18.2L12 16Z" fillOpacity="0.5" />
          </svg>
        </div>
        
        {/* Floating Particle Accents */}
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-ping opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>

      {!hideText && (
        <div className="flex flex-col leading-none">
          <span className={`${textSize} font-black text-slate-900 dark:text-white tracking-tighter group-hover:text-indigo-600 transition-colors duration-300`}>
            TRST<span className="text-indigo-600 group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-300">PREP</span>
          </span>
          <span className="text-[8px] font-black text-slate-400 dark:text-gray-500 tracking-[0.3em] uppercase mt-0.5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">Intelligence</span>
        </div>
      )}
    </Link>
  )
}

export default Logo
