import React, { useState, useRef } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen || !profile) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const res = await uploadAvatar(file);
    setIsUploading(false);

    if (res.success) {
      toast.success('Avatar updated');
    } else {
      toast.error(res.error || 'Avatar upload failed');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !username.trim()) {
      toast.error('Display name and username are required');
      return;
    }

    setIsSaving(true);
    const res = await updateProfile({
      display_name: displayName.trim(),
      username: username.trim().toLowerCase(),
      bio: bio.trim(),
    });
    setIsSaving(false);

    if (res.success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] rounded-3xl p-5 shadow-2xl overflow-hidden text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD]">
          <h2 className="text-base font-bold">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-1 text-[#9BA5A8] hover:text-[#F5F7F7] rounded-full transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <img
                src={
                  profile.avatar_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
                }
                alt={profile.display_name}
                className="w-20 h-20 rounded-full object-cover border-2 border-brand shadow-lg"
              />
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                {isUploading ? (
                  <Loader2 size={20} className="animate-spin text-brand" />
                ) : (
                  <Camera size={20} className="text-white" />
                )}
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <span
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-brand font-bold mt-2 cursor-pointer hover:underline"
            >
              Change Photo
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#1E2325] dark:bg-[#1E2325] light:bg-[#E9EDE8] text-sm text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] rounded-xl px-3.5 py-2.5 border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#1E2325] dark:bg-[#1E2325] light:bg-[#E9EDE8] text-sm text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] rounded-xl px-3.5 py-2.5 border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A few words about you..."
              className="w-full bg-[#1E2325] dark:bg-[#1E2325] light:bg-[#E9EDE8] text-sm text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] placeholder-[#9BA5A8] rounded-xl px-3.5 py-2 border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] focus:outline-none focus:border-brand resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-brand hover:bg-brand-hover text-[#0B0F10] font-bold text-sm py-3 rounded-full transition shadow-lg shadow-brand/20"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};
