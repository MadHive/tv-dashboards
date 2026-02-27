import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary:
        'bg-madhive-pink hover:bg-madhive-pink-bright text-madhive-purple-deepest disabled:bg-madhive-purple-medium disabled:text-madhive-chalk/40',
      secondary:
        'bg-madhive-purple-medium hover:bg-madhive-purple-light text-madhive-chalk border border-madhive-purple-light disabled:opacity-50',
      danger:
        'bg-error/20 hover:bg-error/30 text-error border border-error/30 disabled:opacity-50',
      ghost:
        'bg-transparent hover:bg-madhive-purple-medium/50 text-madhive-chalk disabled:opacity-50',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-tv-sm',
      md: 'px-4 py-2 text-tv-base',
      lg: 'px-6 py-3 text-tv-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-madhive-pink focus:ring-offset-2 focus:ring-offset-madhive-purple-dark',
          'disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="sr-only">Loading...</span>
          </>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };
