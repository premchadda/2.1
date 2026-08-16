import SharedSpinner from '../../../../shared/components/common/LoadingSpinner'

export const LoadingSpinner = ({ size = 'lg', className = '' }) => (
  <div className="flex items-center justify-center min-h-[400px]">
    <SharedSpinner size={size} className={className} />
  </div>
)

export default LoadingSpinner
