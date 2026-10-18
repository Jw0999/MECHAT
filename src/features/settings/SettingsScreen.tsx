import React, { useState } from 'react';
import {
  Moon,
  Sun,
  Laptop,
  User,
  Shield,
  Bell,
  HardDrive,
  LogOut,
  Edit2,
  Database,
  Check,
  Info,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import { EditProfileModal } from './EditProfileModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import {
  requestPushNotificationPermission,
  showPushNotification,
  getNotificationPermissionStatus,
  isIOSDevice,
  isStandalonePWA,
} from '@/lib/notifications';

export const SettingsScreen: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const settings = useAuthStore((s) => s.settings);
  const updateSettings = useAuthStore((s) => s.updateSettings);
  const logout = useAuthStore((s) => s.logout);
  const isConfigured = useAuthStore((s) => s.isConfigured);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string>(() =>
    getNotificationPermissionStatus()
  );

  const handleRequestNotificationPermission = async () => {
    const res = await requestPushNotificationPermission();
    setNotificationStatus(getNotificationPermissionStatus());

    if (res === 'granted') {
      toast.success('Notification permission granted!');
      await showPushNotification('MeChat', {
        body: 'Live notifications are now enabled! 🎉',
      });
    } else if (res === 'ios_pwa_required') {
      toast.info(
        'On iPhone, notifications require adding MeChat to your Home Screen first (Tap Share ⎋ -> "Add to Home Screen").',
        { duration: 7000 }
      );
    } else if (res === 'denied') {
      toast.error('Notification permission was denied. Check your browser/system settings.');
    } else if (res === 'unsupported') {
      toast.error('This browser does not support notifications.');
    } else {
      toast.info(`Notification status: ${res}`);
    }
  };

  const handleClearCache = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
    toast.success('Local cache cleared');
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] transition-colors overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-2 shrink-0">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-xs text-[#9BA5A8]">Preferences, security & account</p>
      </div>

      <div className="p-4 space-y-5 max-w-2xl mx-auto w-full pb-20">
        {/* Profile Card */}
        {profile && (
          <div className="flex items-center justify-between p-4 rounded-3xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <img
                  src={
                    profile.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
                  }
                  alt={profile.display_name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-brand"
                />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-brand rounded-full ring-2 ring-[#151A1C]" />
              </div>

              <div>
                <h2 className="text-base font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                  {profile.display_name}
                </h2>
                <p className="text-xs text-brand font-medium">@{profile.username}</p>
                {profile.bio && (
                  <p className="text-xs text-[#9BA5A8] mt-1 max-w-xs truncate">{profile.bio}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsEditProfileOpen(true)}
              className="p-2.5 rounded-full bg-[#252C2E] dark:bg-[#252C2E] light:bg-[#E9EDE8] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] hover:text-brand transition"
              title="Edit Profile"
            >
              <Edit2 size={16} />
            </button>
          </div>
        )}

        {/* Backend & Deployment Status */}
        <div className="p-4 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
          <div className="flex items-center gap-2 mb-2">
            <Database size={17} className="text-brand" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9BA5A8]">
              Backend Connection
            </h3>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#9BA5A8]">Supabase Status</span>
            <span
              className={cn(
                'font-bold px-2.5 py-0.5 rounded-full text-[11px]',
                isConfigured && !isDemoMode
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-amber-500/20 text-amber-300'
              )}
            >
              {isConfigured && !isDemoMode ? 'Connected (Live)' : 'Demo / Local Mode'}
            </span>
          </div>

          {!isConfigured && (
            <p className="text-[11px] text-[#9BA5A8] mt-2 leading-relaxed">
              To connect your live Supabase project, paste your <code className="text-brand">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-brand">VITE_SUPABASE_ANON_KEY</code> into the <code className="text-brand">.env</code> file.
            </p>
          )}
        </div>

        {/* Appearance Section */}
        <div className="p-4 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#9BA5A8] mb-3">
            Appearance
          </h3>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'dark' as Theme, label: 'Dark', icon: Moon },
              { id: 'light' as Theme, label: 'Light', icon: Sun },
              { id: 'system' as Theme, label: 'System', icon: Laptop },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = theme === t.id;

              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    'flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all',
                    isSelected
                      ? 'bg-brand text-[#0B0F10] border-brand shadow-md'
                      : 'border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-[#9BA5A8] hover:text-[#F5F7F7] dark:hover:text-[#F5F7F7] light:hover:text-[#171B18]'
                  )}
                >
                  <Icon size={18} className="mb-1" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Privacy Section */}
        <div className="p-4 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={17} className="text-brand" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9BA5A8]">
              Privacy & Receipts
            </h3>
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <div>
              <p className="font-semibold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                Read Receipts
              </p>
              <p className="text-[11px] text-[#9BA5A8]">Show double checkmarks when read</p>
            </div>
            <input
              type="checkbox"
              checked={settings?.read_receipts ?? true}
              onChange={(e) => updateSettings({ read_receipts: e.target.checked })}
              className="w-4 h-4 accent-[#A5E548] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <div>
              <p className="font-semibold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                Online Presence
              </p>
              <p className="text-[11px] text-[#9BA5A8]">Let contacts see when you are active</p>
            </div>
            <input
              type="checkbox"
              checked={settings?.presence_visible ?? true}
              onChange={(e) => updateSettings({ presence_visible: e.target.checked })}
              className="w-4 h-4 accent-[#A5E548] cursor-pointer"
            />
          </div>
        </div>

        {/* Notifications & Sounds */}
        <div className="p-4 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={17} className="text-brand" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9BA5A8]">
              Notifications
            </h3>
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <div>
              <p className="font-semibold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                In-App Sound Effects
              </p>
              <p className="text-[11px] text-[#9BA5A8]">Play audio chime on incoming messages</p>
            </div>
            <input
              type="checkbox"
              checked={settings?.sound_enabled ?? true}
              onChange={(e) => updateSettings({ sound_enabled: e.target.checked })}
              className="w-4 h-4 accent-[#A5E548] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <div>
              <p className="font-semibold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                Push Notification Permission
              </p>
              <p className="text-[11px] text-[#9BA5A8]">
                Status:{' '}
                <span
                  className={cn(
                    'font-bold',
                    notificationStatus === 'granted'
                      ? 'text-brand'
                      : notificationStatus === 'denied'
                      ? 'text-red-400'
                      : 'text-amber-400'
                  )}
                >
                  {notificationStatus === 'granted'
                    ? 'Enabled'
                    : notificationStatus === 'denied'
                    ? 'Blocked'
                    : 'Not enabled'}
                </span>
              </p>
            </div>
            <button
              onClick={handleRequestNotificationPermission}
              className={cn(
                'text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-sm',
                notificationStatus === 'granted'
                  ? 'bg-brand/20 text-brand border border-brand/40 hover:bg-brand/30'
                  : 'bg-brand text-[#0B0F10] hover:bg-brand-hover'
              )}
            >
              {notificationStatus === 'granted' ? 'Test Notification' : 'Enable Notifications'}
            </button>
          </div>

          {isIOSDevice() && !isStandalonePWA() && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
              💡 <strong>iPhone tip:</strong> To receive push notifications on iOS, tap the Share icon ⎋ at the bottom of Safari and select <strong>"Add to Home Screen"</strong>.
            </div>
          )}
        </div>

        {/* Storage & Clear Cache */}
        <div className="p-4 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={17} className="text-brand" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9BA5A8]">
              Storage & App Info
            </h3>
          </div>

          <div className="flex items-center justify-between text-xs py-1 text-[#9BA5A8]">
            <span>Version</span>
            <span className="font-mono text-brand font-bold">MeChat v1.0.0 (PWA)</span>
          </div>

          <div className="mt-3">
            <button
              onClick={handleClearCache}
              className="text-xs font-bold text-[#9BA5A8] hover:text-red-400 transition"
            >
              Clear Local Storage & Offline Cache
            </button>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm border border-red-500/30 transition shadow-sm"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </div>
  );
};
