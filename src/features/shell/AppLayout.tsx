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
import { GamesHomeScreen } from '@/features/games/GamesHomeScreen';
import { CallOverlayModal } from '@/features/calling/CallOverlayModal';
import { GroupCallModal } from '@/features/calling/GroupCallModal';
import { useChatStore } from '@/stores/chatStore';
import { useCallStore } from '@/stores/callStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { MessageCircle, Users, X } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const currentTab = useNavigationStore((s) => s.currentTab);
  const setCurrentTab = useNavigationStore((s) => s.setCurrentTab);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const initGlobalMessageSubscription = useChatStore((s) => s.initGlobalMessageSubscription);
  const stopGlobalMessageSubscription = useChatStore((s) => s.stopGlobalMessageSubscription);
  const initCallSignaling = useCallStore((s) => s.initCallSignaling);
  const stopCallSignaling = useCallStore((s) => s.stopCallSignaling);
  const incomingGroupCall = useCallStore((s) => s.incomingGroupCall);
  const initiateGroupCall = useCallStore((s) => s.initiateGroupCall);
  const dismissIncomingGroupCall = useCallStore((s) => s.dismissIncomingGroupCall);

  useEffect(() => {
    loadConversations();
    initGlobalMessageSubscription();
    initCallSignaling();

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadConversations();
        const currentActiveId = useChatStore.getState().activeConversationId;
        if (currentActiveId) {
          useChatStore.getState().loadMessages(currentActiveId);
        }
        initCallSignaling();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus);
    }

    // 10-second heartbeat check while document is visible to guarantee live sync
    const interval = setInterval(() => {
      handleVisibilityOrFocus();
    }, 10000);

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus);
      }
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
              {currentTab === 'games' && <GamesHomeScreen />}
              {currentTab === 'settings' && <SettingsScreen />}
            </div>
          )}
        </div>

        {/* Desktop View: Full-width for Games, Split 2-Column for Chats/Calls/Groups/Settings */}
        <div className="hidden md:flex flex-1 h-full w-full">
          {currentTab === 'games' ? (
            <div className="flex-1 h-full overflow-hidden">
              <GamesHomeScreen />
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation (Hidden when viewing a specific chat on mobile) */}
      {!activeConversationId && (
        <BottomNav currentTab={currentTab} onSelectTab={handleSelectTab} />
      )}

      {/* Incoming Group Call Floating Alert Banner */}
      {incomingGroupCall && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-[#151A1C]/95 backdrop-blur-xl border border-brand/50 shadow-2xl rounded-2xl p-3 flex items-center justify-between animate-fade-in text-[#F5F7F7]">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-xl bg-brand/20 text-brand flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate">
                {incomingGroupCall.caller.display_name}
              </h4>
              <p className="text-[11px] text-[#9BA5A8] truncate">
                Group {incomingGroupCall.callType === 'video' ? 'Video' : 'Voice'} Call • {incomingGroupCall.groupTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                initiateGroupCall(
                  incomingGroupCall.groupId,
                  incomingGroupCall.groupTitle,
                  incomingGroupCall.callType,
                  incomingGroupCall.members
                );
                dismissIncomingGroupCall();
              }}
              className="px-3.5 py-1.5 rounded-full bg-brand hover:bg-brand-hover text-[#0B0F10] text-xs font-bold shadow-md active:scale-95 transition"
            >
              Join
            </button>
            <button
              onClick={dismissIncomingGroupCall}
              className="p-1.5 rounded-full text-[#9BA5A8] hover:text-white transition"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
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
