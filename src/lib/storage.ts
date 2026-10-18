import { supabase, isSupabaseConfigured } from './supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

/**
 * Uploads a picture, document or audio recording to Supabase Storage ('chat-attachments').
 * Falls back cleanly to base64 Data URL or Object URL if in demo mode or if storage bucket is unavailable.
 */
export const uploadAttachment = async (
  file: File | Blob,
  conversationId: string,
  fileName?: string
): Promise<{ url: string; error?: string }> => {
  const isDemo = useAuthStore.getState().isDemoMode;
  const isConfigured = isSupabaseConfigured();

  // If in demo mode or not configured, generate base64/object URL
  if (isDemo || !isConfigured) {
    return await fileToDataUrlOrBlob(file);
  }

  try {
    const rawName =
      fileName || (file instanceof File ? file.name : `attachment_${Date.now()}`);
    const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${conversationId}/${Date.now()}_${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase storage upload error, falling back to base64 data URL:', uploadError);
      return await fileToDataUrlOrBlob(file);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);

    return { url: publicUrl };
  } catch (err: any) {
    console.warn('Storage upload exception, falling back to base64 data URL:', err);
    return await fileToDataUrlOrBlob(file);
  }
};

/**
 * Fallback to base64 data URL for images and small files under 4MB, ensuring media persists across sessions.
 */
const fileToDataUrlOrBlob = (file: File | Blob): Promise<{ url: string; error?: string }> => {
  return new Promise((resolve) => {
    if (file.size <= 4 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result as string });
      reader.onerror = () => resolve({ url: URL.createObjectURL(file) });
      reader.readAsDataURL(file);
    } else {
      resolve({ url: URL.createObjectURL(file) });
    }
  });
};

/**
 * Downloads documents and files directly to device with original filename.
 */
export const downloadFile = async (url: string, filename: string): Promise<boolean> => {
  if (!url) {
    toast.error('File URL is not available');
    return false;
  }

  const toastId = toast.loading(`Preparing download for ${filename}...`);

  try {
    // If it's a base64 Data URL or Blob URL, trigger direct anchor download
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloaded ${filename}`, { id: toastId });
      return true;
    }

    // For remote HTTP URLs, fetch as blob to bypass cross-origin browser navigation
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke memory reference after small delay
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);

    toast.success(`Downloaded ${filename}`, { id: toastId });
    return true;
  } catch (err) {
    console.warn('Direct fetch download failed, using standard anchor fallback:', err);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = filename || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Download started for ${filename}`, { id: toastId });
      return true;
    } catch {
      toast.error(`Failed to download ${filename}`, { id: toastId });
      return false;
    }
  }
};
