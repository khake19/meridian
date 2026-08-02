import * as React from 'react';
import { cn } from './utils';

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn('flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', className)} {...props} />;
}
