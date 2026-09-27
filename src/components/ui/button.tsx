import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Section 16.6: 44px minimum touch target, visible focus ring in --accent.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 min-h-11',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-ink hover:opacity-90',
        outline: 'border border-rule bg-card text-ink hover:bg-accent-soft',
        ghost: 'text-ink hover:bg-accent-soft',
        quiet: 'text-ink-muted hover:text-ink underline underline-offset-4',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-3 py-1.5 min-h-9',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { Button, buttonVariants };
