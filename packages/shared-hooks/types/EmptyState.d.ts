import { ComponentType, ReactNode } from 'react';

type IllustrationType = 'search' | 'empty' | 'error' | 'success';

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  illustration?: IllustrationType;
  customIllustration?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'secondary';
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

declare const EmptyState: React.FC<EmptyStateProps>;
export default EmptyState;
