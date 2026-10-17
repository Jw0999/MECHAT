import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500/90 text-black px-4 py-2 text-xs font-semibold flex items-center justify-between sticky top-0 z-50 backdrop-blur shadow-md">
      <div className="flex items-center gap-2">
        <WifiOff size={16} />
        <span>You are currently offline. Cached messages remain accessible.</span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 bg-black/15 hover:bg-black/25 px-2.5 py-1 rounded-full text-[11px] transition"
      >
        <RefreshCw size={12} />
        Retry
      </button>
    </div>
  );
};
