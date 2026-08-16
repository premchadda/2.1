import { QUESTION_CATEGORIES } from '../../../../shared/config/questionCategories.js'

// Category Tab Bar Component
export const CategoryTabBar = ({ activeCategory, onCategoryChange, categoryCounts }) => {
  return (
    <div className="mb-1">
      <div style={{
        display: 'flex',
        gap: '0',
        padding: '3px',
        backgroundColor: '#f1f5f9',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        width: 'fit-content'
      }}>
        {QUESTION_CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id
          const count = categoryCounts[cat.id] || 0
          const Icon = cat.icon

          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '8px 24px',
                borderRadius: '9px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                fontFamily: 'inherit',
                ...(isActive
                  ? {
                    background: '#ffffff',
                    color: cat.id === 'mock-tests' ? '#6366f1' : cat.id === 'pyp' ? '#f59e0b' : '#10b981',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }
                  : {
                    background: 'transparent',
                    color: '#64748b',
                  })
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Icon style={{ width: '16px', height: '16px' }} />
                <span style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap'
                }}>
                  {cat.label}
                </span>
              </div>
              <span style={{
                fontSize: '15px',
                fontWeight: 800,
                color: isActive ? 'inherit' : '#94a3b8',
                backgroundColor: isActive ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.05)',
                padding: '2px 8px',
                borderRadius: '6px',
                lineHeight: 1
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
      {/* Active category description */}
      <p style={{
        fontSize: '13px',
        color: '#94a3b8',
        marginTop: '8px',
        paddingLeft: '4px'
      }}>
        {QUESTION_CATEGORIES.find(c => c.id === activeCategory)?.description}
      </p>
    </div>
  )
}
