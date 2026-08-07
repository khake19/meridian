import * as React from 'react';
import { cn } from './utils';

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn('flex h-[34px] w-full rounded-none border border-input bg-card px-2.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50', className)} {...props} />;
}
