import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type Size = 'default' | 'sm' | 'lg' | 'icon';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

const variantClasses = (v: Variant) => {
  switch (v) {
    case 'destructive':
      return 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90';
    case 'outline':
      return 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground';
    case 'secondary':
      return 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80';
    case 'ghost':
      return 'hover:bg-accent hover:text-accent-foreground';
    case 'link':
      return 'text-primary underline-offset-4 hover:underline';
    default:
      return 'bg-primary text-primary-foreground shadow hover:bg-primary/90';
  }
};

const sizeClasses = (s: Size) => {
  switch (s) {
    case 'sm':
      return 'h-8 rounded-md px-3 text-xs';
    case 'lg':
      return 'h-10 rounded-md px-8';
    case 'icon':
      return 'h-9 w-9';
    default:
      return 'h-9 px-4 py-2';
  }
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(base, variantClasses(variant), sizeClasses(size), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export function buttonClasses({
  variant = 'default',
  size = 'default',
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return cn(base, variantClasses(variant), sizeClasses(size), className);
}

export { Button };
