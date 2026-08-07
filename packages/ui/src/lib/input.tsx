import * as React from 'react';
import { cn } from './utils';

export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} className={cn('flex h-[34px] w-full rounded-none border border-input bg-card px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50', className)} {...props} />;
}
