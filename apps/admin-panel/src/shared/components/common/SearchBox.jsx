import React from 'react';
import { Search, XCircle, ArrowRight } from 'lucide-react';

/**
 * Shared SearchBox component for Hero sections
 * Automatically stays compact on mobile and allows for customization
 */
const SearchBox = ({ 
  value, 
  onChange, 
  onClear, 
  onSubmit,
  placeholder = "Search...", 
  className = "",
  iconColorClass = "group-focus-within:text-brand-start",
  containerClass = "max-w-xl",
  inputClass = "shadow-2xl text-lg",
  showAction = false,
  actionText = "Search",
  ...props 
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(e);
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className={`relative animate-slide-up group ${containerClass} ${className}`} 
      style={{ animationDelay: '0.2s' }}
    >
      <Search className={`w-4 h-4 md:w-5 md:h-5 absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-gray-400 ${iconColorClass} transition-colors pointer-events-none`} />
      <input 
        type="text" 
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full pl-10 md:pl-12 pr-10 md:pr-4 py-2.5 md:py-4 rounded-xl md:rounded-2xl border-0 focus:ring-4 focus:ring-white/20 text-gray-800 text-sm md:text-lg outline-none transition-all ${inputClass} ${showAction ? 'pr-24 md:pr-32' : ''}`}
        {...props}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {value && onClear && (
          <button 
            type="button"
            onClick={onClear}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <XCircle className="w-4 h-4 md:w-5 md:h-5 fill-current" />
          </button>
        )}
        {showAction && (
          <button
            type="submit"
            className="px-3 md:px-5 py-1.5 md:py-2 bg-brand-start text-white text-[10px] md:text-sm font-bold rounded-lg md:rounded-xl hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            {actionText}
            <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
          </button>
        )}
      </div>
    </form>
  );
};

export default SearchBox;
