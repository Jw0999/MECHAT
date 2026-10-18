import React, { useState, useEffect } from 'react';
import { BottomNav, type NavTab } from './BottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import { OfflineBanner } from './OfflineBanner';
import { InstallPrompt } from './InstallPrompt';
import { ChatListScreen } from '@/features/chat/ChatListScreen';
import { ConversationDetailScreen } from '@/features/chat/ConversationDetailScreen';
import { CallingScreen } from '@/features/calling/CallingScreen';
import { GroupsScreen } from '@/features/groups/GroupsScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { CallOverlayModal } from '@/features/calling/CallOverlayModal';
import { GroupCallModal } from '@/features/calling/GroupCallModal';
import { useChatStore } from '@/stores/chatStore';
import { useCallStore } from '@/stores/callStore';
import { MessageCircle } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('chat');
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const initGlobalMessageSubscription = useChatStore((s) => s.initGlobalMessageSubscription);
  const stopGlobalMessageSubscription = useChatStore((s) => s.stopGlobalMessageSubscription);
  const initCallSignaling = useCallStore((s) => s.initCallSignaling);
  const stopCallSignaling = useCallStore((s) => s.stopCallSignaling);

  useEffect(() => {
    loadConversations();
    initGlobalMessageSubscription();
    initCallSignaling();

    // 10-second heartbeat check while document is visible to guarantee live sync
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadConversations();
        const currentActiveId = useChatStore.getState().activeConversationId;
        if (currentActiveId) {
          useChatStore.getState().loadMessages(currentActiveId);
        }
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      stopGlobalMessageSubscription();
      stopCallSignaling();
    };
  }, [loadConversations, initGlobalMessageSubscription, stopGlobalMessageSubscription, initCallSignaling, stopCallSignaling]);

  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    // On mobile, selecting a tab exits an active chat
    if (window.innerWidth < 768) {
      setActiveConversationId(null);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full max-w-full overflow-hidden bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] transition-colors">
      {/* Offline Alert Bar */}
      <OfflineBanner />

      {/* Desktop & Tablet Sidebar */}
      <DesktopSidebar currentTab={currentTab} onSelectTab={handleSelectTab} />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative w-full h-full">
        {/* Mobile View: Either show active conversation or active tab */}
        <div className="flex-1 flex md:hidden relative h-full w-full overflow-hidden">
          {activeConversationId ? (
            <ConversationDetailScreen
              conversationId={activeConversationId}
              onBack={() => setActiveConversationId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col h-full w-full pb-[calc(56px+env(safe-area-inset-bottom,8px))] overflow-hidden">
              {currentTab === 'calling' && <CallingScreen />}
              {currentTab === 'chat' && (
                <ChatListScreen
                  onSelectConversation={(id) => setActiveConversationId(id)}
                  onOpenNewGroup={() => setCurrentTab('groups')}
                />
              )}
              {currentTab === 'groups' && (
                <GroupsScreen
                  onSelectConversation={(id) => setActiveConversationId(id)}
                />
              )}
              {currentTab === 'settings' && <SettingsScreen />}
            </div>
          )}
        </div>

        {/* Desktop View: Split 2-Column or 3-Column Layout */}
        <div className="hidden md:flex flex-1 h-full w-full">
          {/* Middle Pane: Active Tab List */}
          <div className="w-80 lg:w-96 h-full border-r border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] shrink-0">
            {currentTab === 'calling' && <CallingScreen />}
            {currentTab === 'chat' && (
              <ChatListScreen
                onSelectConversation={(id) => setActiveConversationId(id)}
                onOpenNewGroup={() => setCurrentTab('groups')}
              />
            )}
            {currentTab === 'groups' && (
              <GroupsScreen
                onSelectConversation={(id) => setActiveConversationId(id)}
              />
            )}
            {currentTab === 'settings' && <SettingsScreen />}
          </div>

          {/* Right Pane: Active Chat Conversation or Empty Placeholder */}
          <div className="flex-1 h-full flex flex-col bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5]">
            {activeConversationId ? (
              <ConversationDetailScreen
                conversationId={activeConversationId}
                onBack={() => setActiveConversationId(null)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
                <div className="w-16 h-16 rounded-3xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] flex items-center justify-center text-brand mb-4 shadow-xl">
                  <MessageCircle size={32} />
                </div>
                <h3 className="text-lg font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] mb-1">
                  Select a Conversation
                </h3>
                <p className="text-xs text-[#9BA5A8] max-w-xs">
                  Choose a chat from the list or start a new conversation to begin messaging.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation (Hidden when viewing a specific chat on mobile) */}
      {!activeConversationId && (
        <BottomNav currentTab={currentTab} onSelectTab={handleSelectTab} />
      )}

      {/* Fullscreen Call Overlay for Audio & Video calls */}
      <CallOverlayModal />

      {/* Fullscreen Group Call Overlay for Multi-Peer Voice & Video */}
      <GroupCallModal />

      {/* PWA Install Banner */}
      <InstallPrompt />
    </div>
  );
};
