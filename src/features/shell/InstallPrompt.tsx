import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if user previously dismissed
      const dismissed = localStorage.getItem('mechat_pwa_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('mechat_pwa_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-slide-up">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shrink-0">
          <Download size={20} className="text-[#0B0F10]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
            Install MeChat App
          </p>
          <p className="text-xs text-[#9BA5A8]">Fast access & home screen alerts</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleInstall}
          className="bg-brand text-[#0B0F10] text-xs font-bold px-3 py-1.5 rounded-full hover:bg-brand-hover transition"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-[#9BA5A8] hover:text-[#F5F7F7] rounded-full transition"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
