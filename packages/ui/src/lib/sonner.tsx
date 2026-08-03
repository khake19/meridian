import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return <Sonner
    position="bottom-right"
    offset={80}
    closeButton
    toastOptions={{ duration: 8000 }}
    {...props}
  />;
}

export { toast };
