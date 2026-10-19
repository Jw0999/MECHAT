import React from 'react';
import { Phone, MessageCircle, Users, Gamepad2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import type { NavTab } from './BottomNav';

interface DesktopSidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ currentTab, onSelectTab }) => {
  const conversations = useChatStore((s) => s.conversations);
  const profile = useAuthStore((s) => s.profile);
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const navItems = [
    { id: 'calling' as NavTab, label: 'Calling', icon: Phone, badge: 0 },
    { id: 'chat' as NavTab, label: 'Chat', icon: MessageCircle, badge: totalUnread },
    { id: 'groups' as NavTab, label: 'Groups', icon: Users, badge: 0 },
    { id: 'games' as NavTab, label: 'Games', icon: Gamepad2, badge: 0 },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings, badge: 0 },
  ];

  return (
    <aside className="hidden md:flex flex-col justify-between w-64 lg:w-72 h-screen border-r border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#FFFFFF] p-4 select-none shrink-0 transition-colors">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 py-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/20">
            <MessageCircle size={22} className="text-[#0B0F10] fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] flex items-center gap-1.5">
              MeChat
              <span className="text-[10px] font-semibold bg-brand/20 text-brand px-1.5 py-0.5 rounded-full">
                PWA
              </span>
            </h1>
            <p className="text-xs text-[#9BA5A8]">Real-time messenger</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 group',
                  isActive
                    ? 'bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] text-brand shadow-sm'
                    : 'text-[#9BA5A8] hover:bg-[#151A1C]/50 dark:hover:bg-[#151A1C]/50 light:hover:bg-[#F0F3ED] hover:text-[#F5F7F7] dark:hover:text-[#F5F7F7] light:hover:text-[#171B18]'
                )}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.3 : 1.9}
                    className={cn(
                      'transition-colors',
                      isActive ? 'stroke-brand' : 'stroke-current'
                    )}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge > 0 && (
                  <span className="bg-brand text-[#0B0F10] text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile footer */}
      {profile && (
        <div
          onClick={() => onSelectTab('settings')}
          className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#F0F3ED] cursor-pointer hover:border-brand/40 border border-transparent transition-all"
        >
          <div className="relative">
            <img
              src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`}
              alt={profile.display_name}
              className="w-10 h-10 rounded-full object-cover border border-[#252C2E]"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-brand rounded-full ring-2 ring-[#151A1C]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
              {profile.display_name}
            </p>
            <p className="text-xs text-[#9BA5A8] truncate">@{profile.username}</p>
          </div>
        </div>
      )}
    </aside>
  );
};
