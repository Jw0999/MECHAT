import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { AppLayout } from '@/features/shell/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster, toast } from 'sonner';
import { MessageCircle } from 'lucide-react';

export const App: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorDesc = hashParams.get('error_description');
      if (errorDesc) {
        toast.error(decodeURIComponent(errorDesc).replace(/\+/g, ' '));
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    initAuth();
  }, [initAuth]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#0B0F10] flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-3xl bg-brand flex items-center justify-center text-[#0B0F10] shadow-2xl shadow-brand/30 animate-pulse">
          <MessageCircle size={36} strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-bold tracking-tight mt-4 text-[#F5F7F7]">MeChat</h1>
        <p className="text-xs text-[#9BA5A8] mt-1 font-mono">Connecting...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#151A1C',
            border: '1px solid #252C2E',
            color: '#F5F7F7',
            borderRadius: '16px',
            fontSize: '13px',
          },
        }}
      />
      {user ? <AppLayout /> : <AuthScreen />}
    </ErrorBoundary>
  );
};

export default App;
