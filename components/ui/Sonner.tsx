import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'bg-card text-card-foreground border border-border shadow-lg rounded-md text-sm',
        },
      }}
    />
  );
}
