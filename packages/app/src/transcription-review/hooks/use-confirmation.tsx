import { useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@meridian/ui';

export interface ConfirmationOptions {
  title: string;
  description: string;
  actionLabel?: string;
  destructive?: boolean;
}

export function useConfirmation() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  function confirm(nextOptions: ConfirmationOptions) {
    resolver.current?.(false);
    setOptions(nextOptions);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }

  function finish(confirmed: boolean) {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
  }

  const confirmationDialog = <AlertDialog open={Boolean(options)} onOpenChange={(open) => { if (!open && options) finish(false); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{options?.title}</AlertDialogTitle>
        <AlertDialogDescription>{options?.description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => finish(false)}>Cancel</AlertDialogCancel>
        <AlertDialogAction className={options?.destructive ? '!bg-destructive !text-white hover:!bg-destructive/90' : undefined} onClick={() => finish(true)}>{options?.actionLabel || 'Continue'}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;

  return { confirm, confirmationDialog };
}
