import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from './utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;

export function DropdownMenuContent({ className, sideOffset = 5, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      className={cn('z-50 min-w-44 overflow-hidden rounded-none border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none', className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>;
}

export function DropdownMenuSubContent({ className, sideOffset = 4, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.SubContent
      sideOffset={sideOffset}
      className={cn('z-50 min-w-40 overflow-hidden rounded-none border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none', className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>;
}

export function DropdownMenuSubTrigger({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return <DropdownMenuPrimitive.SubTrigger
    className={cn('flex cursor-default select-none items-center px-2 py-1.5 text-xs outline-none transition-colors focus:bg-muted data-[state=open]:bg-muted', inset && 'pl-8', className)}
    {...props}
  />;
}

export function DropdownMenuItem({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
  return <DropdownMenuPrimitive.Item
    className={cn('relative flex cursor-default select-none items-center px-2 py-1.5 text-xs outline-none transition-colors focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40', inset && 'pl-8', className)}
    {...props}
  />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
