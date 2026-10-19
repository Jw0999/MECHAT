import React from 'react';
import { Phone, MessageCircle, Users, Gamepad2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chatStore';

export type NavTab = 'calling' | 'chat' | 'groups' | 'games' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const conversations = useChatStore((s) => s.conversations);
  
  // Calculate total unread count for Chat tab badge
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const navItems = [
    {
      id: 'calling' as NavTab,
      label: 'Calling',
      icon: Phone,
      badge: 0,
    },
    {
      id: 'chat' as NavTab,
      label: 'Chat',
      icon: MessageCircle,
      badge: totalUnread,
    },
    {
      id: 'groups' as NavTab,
      label: 'Groups',
      icon: Users,
      badge: 0,
    },
    {
      id: 'games' as NavTab,
      label: 'Games',
      icon: Gamepad2,
      badge: 0,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
      badge: 0,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-[max(10px,env(safe-area-inset-bottom,8px))] pt-2 px-2 glass-bottom-bar border-t border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD]/80 transition-colors">
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={cn(
                'relative flex flex-col items-center justify-center py-1.5 px-2 transition-all duration-200 select-none group',
                isActive
                  ? 'text-brand font-semibold scale-105'
                  : 'text-[#9BA5A8] hover:text-[#F5F7F7] dark:hover:text-[#F5F7F7] light:hover:text-[#171B18]'
              )}
            >
              <div className="relative">
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.4 : 1.9}
                  className={cn(
                    'transition-transform duration-200',
                    isActive ? 'stroke-brand' : 'stroke-current'
                  )}
                />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-brand text-[#0B0F10] text-[10px] font-extrabold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center shadow-md animate-pulse-subtle">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[11px] mt-1 tracking-tight transition-colors',
                  isActive ? 'text-brand font-bold' : 'text-[#9BA5A8]'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
