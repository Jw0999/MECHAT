import React, { useEffect, useState, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, Video } from 'lucide-react';
import { downloadFile } from '@/lib/storage';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  mediaUrl?: string;
  isVideo?: boolean;
  fileName?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  mediaUrl,
  isVideo = false,
  fileName,
}) => {
  const effectiveUrl = mediaUrl || imageUrl || '';
  const effectiveFileName = fileName || (isVideo ? 'video.mp4' : 'photo.jpg');

  const [isZoomed, setIsZoomed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset zoom & rotation on open/change, and pause video if closing
  useEffect(() => {
    if (isOpen) {
      setIsZoomed(false);
      setRotation(0);
      setIsLoading(true);
      if (isVideo && videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    } else if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [isOpen, effectiveUrl, isVideo]);

  if (!isOpen || !effectiveUrl) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadFile(effectiveUrl, effectiveFileName);
  };

  const toggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsZoomed((prev) => !prev);
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-2xl animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Top Controls Header Bar */}
      <header
        className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 flex items-center justify-between text-white shrink-0 z-10 bg-gradient-to-b from-black/80 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Filename & Info */}
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition text-white"
            title="Close viewer (Esc)"
          >
            <X size={22} />
          </button>
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate max-w-[200px] sm:max-w-md">{effectiveFileName}</h3>
            <p className="text-[11px] text-[#9BA5A8]">
              {isVideo ? 'Video player' : 'Tap picture to toggle zoom'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Rotate & Zoom (photos only), and Download */}
        <div className="flex items-center gap-2 shrink-0">
          {!isVideo && (
            <>
              <button
                onClick={handleRotate}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition text-white"
                title="Rotate 90°"
              >
                <RotateCw size={19} />
              </button>

              <button
                onClick={toggleZoom}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition text-white"
                title={isZoomed ? 'Zoom out' : 'Zoom in'}
              >
                {isZoomed ? <ZoomOut size={19} /> : <ZoomIn size={19} />}
              </button>
            </>
          )}

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-brand hover:bg-brand-hover text-[#0B0F10] font-bold text-xs shadow-lg shadow-brand/20 active:scale-95 transition"
            title={isVideo ? 'Download video' : 'Download full resolution picture'}
          >
            <Download size={16} strokeWidth={2.4} />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </header>

      {/* Main Center Media Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-auto p-2 sm:p-6">
        {isVideo ? (
          <div
            className="relative max-h-[82vh] max-w-[95vw] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={videoRef}
              src={effectiveUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[82vh] max-w-[95vw] rounded-2xl shadow-2xl object-contain bg-black"
            />
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 border-3 border-brand/30 border-t-brand rounded-full animate-spin" />
              </div>
            )}

            <img
              src={effectiveUrl}
              alt={effectiveFileName}
              onLoad={() => setIsLoading(false)}
              onClick={toggleZoom}
              style={{
                transform: `rotate(${rotation}deg) scale(${isZoomed ? 1.8 : 1})`,
                transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
              }}
              className={`max-h-[82vh] max-w-[95vw] object-contain rounded-lg shadow-2xl cursor-zoom-in ${
                isZoomed ? 'cursor-zoom-out' : ''
              }`}
            />
          </>
        )}
      </div>

      {/* Bottom Safe Area Inset Spacer */}
      <footer className="pb-[max(12px,env(safe-area-inset-bottom,0px))] shrink-0 pointer-events-none" />
    </div>
  );
};
