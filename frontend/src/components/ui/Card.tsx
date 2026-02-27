import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient' | 'glass';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-madhive-purple-dark border border-madhive-purple-medium',
      gradient: 'bg-gradient-to-br from-madhive-purple-dark to-madhive-purple-medium border border-madhive-purple-medium',
      glass: 'bg-madhive-purple-dark/80 backdrop-blur-sm border border-madhive-purple-medium',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg p-6 shadow-lg',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export { Card };
export type { CardProps };
