import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Gamepad2, Users, Plus, KeyRound, Loader2, MessageSquare, Play, Sparkles, Check } from 'lucide-react';
import { RoomLobbyModal } from './RoomLobbyModal';
import { TicTacToeGameScreen } from './tic-tac-toe/TicTacToeGameScreen';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { gameRoomService } from './services/gameRoomService';
import { createInitialWhotGameState } from './whot/whotRules';
import { createInitialTriviaState } from './trivia/triviaRules';
import type { GameRoom, GameType } from '@/types/games.types';
import { cn, getInitials } from '@/lib/utils';
import { toast } from 'sonner';

// Lazy load pool, whot, and trivia modules to keep initial bundle ultra-lightweight
const PoolGameScreen = lazy(() => import('./pool/PoolGameScreen'));
const WhotGameScreen = lazy(() => import('./whot/WhotGameScreen'));
const TriviaGameScreen = lazy(() => import('./trivia/TriviaGameScreen'));

export const GamesHomeScreen: React.FC = () => {
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [category, setCategory] = useState<'2player' | 'group'>('2player');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isCreatingGroupGame, setIsCreatingGroupGame] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    gameType: GameType | null;
    mode: 'create' | 'join';
  }>({
    isOpen: false,
    gameType: null,
    mode: 'create',
  });

  const conversations = useChatStore((s) => s.conversations);
  const groups = conversations.filter((c) => c.type === 'group');
  const currentUser = useAuthStore((s) => s.user);
  const currentProfile = useAuthStore((s) => s.profile);

  // Auto-select first group when available
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];

  const handleOpenCreate = (gameType: GameType) => {
    setModalState({ isOpen: true, gameType, mode: 'create' });
  };

  const handleOpenJoin = () => {
    setModalState({ isOpen: true, gameType: null, mode: 'join' });
  };

  const handleStartGroupGame = async (gameType: 'whot' | 'trivia') => {
    if (!selectedGroup) {
      toast.error('Please select a group chat first');
      return;
    }

    setIsCreatingGroupGame(true);
    try {
      // Gather group members
      let members = (selectedGroup.members || []).map((m) => ({
        id: m.user_id,
        display_name: m.profile?.display_name || 'Member',
        avatar_url: m.profile?.avatar_url,
      }));

      // Ensure current user is included
      if (currentUser && !members.some((m) => m.id === currentUser.id)) {
        members.unshift({
          id: currentUser.id,
          display_name: currentProfile?.display_name || 'You',
          avatar_url: currentProfile?.avatar_url,
        });
      }

      // If group has fewer than 2 members in demo, add opponent
      if (members.length < 2) {
        members.push({
          id: 'demo-user-2',
          display_name: 'Squad Member',
          avatar_url: null,
        });
      }

      const initialState =
        gameType === 'whot'
          ? createInitialWhotGameState(members, selectedGroup.id)
          : createInitialTriviaState(members, selectedGroup.id);

      const room = await gameRoomService.createRoom(
        gameType,
        initialState,
        selectedGroup.id,
        members.map((m) => ({ user_id: m.id, profile: m as any }))
      );

      // Announce game in group chat
      const gameTitle = gameType === 'whot' ? 'Naija Whot! (Whot Whot)' : 'Trivia Clash';
      try {
        await useChatStore
          .getState()
          .sendMessage(
            selectedGroup.id,
            `🎮 ${currentProfile?.display_name || 'Host'} started a game of ${gameTitle}! Join room code: ${room.room_code}`
          );
      } catch {}

      toast.success(`${gameTitle} match started for ${selectedGroup.title}!`);
      setActiveRoom(room);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start group game');
    } finally {
      setIsCreatingGroupGame(false);
    }
  };

  // If in an active match, render that specific game screen
  if (activeRoom) {
    if (activeRoom.game_type === 'pool') {
      return (
        <Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#9BA5A8]">
              <Loader2 size={32} className="animate-spin text-brand mb-2" />
              <p className="text-sm font-semibold">Loading 8-Ball Pool...</p>
            </div>
          }
        >
          <PoolGameScreen
            initialRoom={activeRoom}
            onExit={() => setActiveRoom(null)}
          />
        </Suspense>
      );
    }

    if (activeRoom.game_type === 'tic_tac_toe') {
      return (
        <TicTacToeGameScreen
          initialRoom={activeRoom}
          onExit={() => setActiveRoom(null)}
        />
      );
    }

    if (activeRoom.game_type === 'whot') {
      return (
        <Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#9BA5A8]">
              <Loader2 size={32} className="animate-spin text-brand mb-2" />
              <p className="text-sm font-semibold">Loading Naija Whot...</p>
            </div>
          }
        >
          <WhotGameScreen
            initialRoom={activeRoom}
            onExit={() => setActiveRoom(null)}
          />
        </Suspense>
      );
    }

    if (activeRoom.game_type === 'trivia') {
      return (
        <Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#9BA5A8]">
              <Loader2 size={32} className="animate-spin text-brand mb-2" />
              <p className="text-sm font-semibold">Loading Trivia Clash...</p>
            </div>
          }
        >
          <TriviaGameScreen
            initialRoom={activeRoom}
            onExit={() => setActiveRoom(null)}
          />
        </Suspense>
      );
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-y-auto bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] p-4 md:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
            <Gamepad2 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MeChat Games</h1>
            <p className="text-xs text-[#9BA5A8]">Ultra-lightweight multiplayer games for 2 players & groups</p>
          </div>
        </div>

        <button
          onClick={handleOpenJoin}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-xs font-semibold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] hover:border-brand/40 transition-colors"
        >
          <KeyRound size={14} className="text-brand" />
          <span>Join with Code</span>
        </button>
      </div>

      {/* Segmented Switcher: 2 Players vs Group Chat */}
      <div className="max-w-4xl mx-auto w-full mb-6">
        <p className="text-xs font-bold text-[#9BA5A8] uppercase tracking-wider mb-2">
          Choose Game Mode:
        </p>
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
          <button
            onClick={() => setCategory('2player')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all',
              category === '2player'
                ? 'bg-brand text-[#0B0F10] shadow-sm shadow-brand/20'
                : 'text-[#9BA5A8] hover:text-white'
            )}
          >
            <Users size={16} />
            <span>2 Players (1v1)</span>
          </button>
          <button
            onClick={() => setCategory('group')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all',
              category === 'group'
                ? 'bg-brand text-[#0B0F10] shadow-sm shadow-brand/20'
                : 'text-[#9BA5A8] hover:text-white'
            )}
          >
            <MessageSquare size={16} />
            <span>Group Chat Games</span>
          </button>
        </div>
      </div>

      {/* Mode 1: 2 Players Section */}
      {category === '2player' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full animate-fade-in">
          {/* Card 1: 8-Ball Pool */}
          <div className="flex flex-col justify-between p-5 rounded-3xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] hover:border-brand/30 transition-all duration-200 group shadow-sm">
            <div>
              {/* CSS-rendered pool table preview */}
              <div className="relative w-full h-36 rounded-2xl bg-[#261a12] border-2 border-[#3d2719] p-2 overflow-hidden mb-4 shadow-inner">
                {/* Green Felt */}
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#198754] to-[#0e5f39] relative flex items-center justify-center">
                  {/* 6 Pockets */}
                  <div className="absolute top-1 left-1 w-3.5 h-3.5 rounded-full bg-black shadow-inner" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-black shadow-inner" />
                  <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-black shadow-inner" />
                  <div className="absolute bottom-1 left-1 w-3.5 h-3.5 rounded-full bg-black shadow-inner" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-black shadow-inner" />
                  <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-black shadow-inner" />

                  {/* Cue Ball */}
                  <div className="absolute left-1/4 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md" />

                  {/* Triangle Rack preview with 8-ball in center */}
                  <div className="absolute right-1/4 translate-x-1/2 flex items-center gap-0.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-md" />
                    <div className="flex flex-col gap-0.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-blue-600 shadow-md" />
                      <div className="w-3.5 h-3.5 rounded-full bg-black border border-white/20 text-[6px] text-white flex items-center justify-center font-bold shadow-md">
                        8
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-red-600 shadow-md" />
                      <div className="w-3.5 h-3.5 rounded-full bg-purple-600 shadow-md" />
                      <div className="w-3.5 h-3.5 rounded-full bg-orange-500 shadow-md" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-lg font-bold tracking-tight">8-Ball Pool</h2>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Users size={12} />
                  2 Players Online
                </span>
              </div>

              <p className="text-xs text-[#9BA5A8] leading-relaxed mb-4">
                Real-time 2D Canvas pool with suction pocket drops, aiming guides, legal target protection, and standard 8-ball win rules.
              </p>
            </div>

            <button
              onClick={() => handleOpenCreate('pool')}
              className="w-full py-2.5 px-4 rounded-xl bg-brand text-[#0B0F10] font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand/90 active:scale-98 transition-all shadow-sm shadow-brand/10"
            >
              <Plus size={16} />
              <span>Create Pool Match</span>
            </button>
          </div>

          {/* Card 2: Tic-Tac-Toe */}
          <div className="flex flex-col justify-between p-5 rounded-3xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] hover:border-brand/30 transition-all duration-200 group shadow-sm">
            <div>
              {/* CSS-rendered 3x3 board preview */}
              <div className="w-full h-36 rounded-2xl bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] p-3 flex items-center justify-center mb-4">
                <div className="grid grid-cols-3 gap-1.5 w-28 h-28">
                  <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center font-black text-emerald-400 text-base">
                    X
                  </div>
                  <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center font-black text-amber-400 text-base">
                    O
                  </div>
                  <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center font-black text-emerald-400 text-base">
                    X
                  </div>
                  <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center font-black text-amber-400 text-base">
                    O
                  </div>
                  <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center font-black text-emerald-400 text-base">
                    X
                  </div>
                  <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center font-black text-zinc-600 text-base">
                    -
                  </div>
                  <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center font-black text-amber-400 text-base">
                    O
                  </div>
                  <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center font-black text-zinc-600 text-base">
                    -
                  </div>
                  <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center font-black text-emerald-400 text-base">
                    X
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-lg font-bold tracking-tight">Tic-Tac-Toe</h2>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Users size={12} />
                  2 Players Online
                </span>
              </div>

              <p className="text-xs text-[#9BA5A8] leading-relaxed mb-4">
                Classic 3×3 grid with turn-based realtime synchronization, win detection, rematches, and interactive celebration.
              </p>
            </div>

            <button
              onClick={() => handleOpenCreate('tic_tac_toe')}
              className="w-full py-2.5 px-4 rounded-xl bg-brand text-[#0B0F10] font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand/90 active:scale-98 transition-all shadow-sm shadow-brand/10"
            >
              <Plus size={16} />
              <span>Create Tic-Tac-Toe Match</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Group Chat Games Section */}
      {category === 'group' && (
        <div className="max-w-4xl mx-auto w-full space-y-5 animate-fade-in">
          {/* Step 1: Pick Group Chat */}
          <div className="p-4 rounded-3xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-brand uppercase tracking-wider block mb-1">
                  1. Pick Group Chat to Play With:
                </span>
                <p className="text-xs text-[#9BA5A8]">
                  The game will be linked directly to your group, and all members can play together.
                </p>
              </div>

              {groups.length > 0 ? (
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0B0F10] border border-[#252C2E] text-xs font-bold text-[#F5F7F7] focus:border-brand focus:outline-none"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title || 'Group'} ({g.members?.length || 2} members)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-amber-400 font-semibold">
                  No group chats found. Create a group in MeChat first!
                </div>
              )}
            </div>

            {selectedGroup && (
              <div className="mt-3 pt-3 border-t border-[#252C2E] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">
                    {getInitials(selectedGroup.title || 'Group')}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{selectedGroup.title || 'Selected Group'}</p>
                    <p className="text-[10px] text-[#9BA5A8]">
                      {selectedGroup.members?.length || 2} members in this group
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  Ready for Group Match
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Dedicated Two Group Games */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Group Game 1: Naija Whot! */}
            <div className="flex flex-col justify-between p-5 rounded-3xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] hover:border-brand/30 transition-all group shadow-sm">
              <div>
                {/* CSS Whot Cards Preview */}
                <div className="relative w-full h-36 rounded-2xl bg-[#0B0F10] border border-[#252C2E] p-3 flex items-center justify-center gap-2 mb-4 overflow-hidden shadow-inner">
                  {/* Card 1: Circle */}
                  <div className="w-14 h-22 rounded-xl border border-amber-400/40 bg-amber-400/10 p-1.5 flex flex-col justify-between shadow-md -rotate-6">
                    <span className="text-[10px] font-bold text-amber-400">1</span>
                    <span className="text-lg font-black text-amber-400 text-center">●</span>
                    <span className="text-[7px] font-bold text-amber-400 text-center">HOLD ON</span>
                  </div>
                  {/* Card 2: Whot 20 */}
                  <div className="w-16 h-24 rounded-xl border-2 border-brand/60 bg-brand/10 p-2 flex flex-col justify-between shadow-xl z-10 scale-105">
                    <span className="text-xs font-black text-brand">20</span>
                    <span className="text-xl font-black text-brand text-center">WHOT!</span>
                    <span className="text-[7px] font-black text-brand text-center uppercase">Wild</span>
                  </div>
                  {/* Card 3: Triangle */}
                  <div className="w-14 h-22 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-1.5 flex flex-col justify-between shadow-md rotate-6">
                    <span className="text-[10px] font-bold text-emerald-400">2</span>
                    <span className="text-lg font-black text-emerald-400 text-center">▲</span>
                    <span className="text-[7px] font-bold text-emerald-400 text-center">PICK 2</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-lg font-bold tracking-tight">Naija Whot! (Whot Whot)</h2>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <Users size={12} />
                    {selectedGroup?.members?.length || 2} Group Players
                  </span>
                </div>

                <p className="text-xs text-[#9BA5A8] leading-relaxed mb-4">
                  The iconic African matching card game! Shapes, Hold On (1), Pick Two (2), General Market (14), and Whot (20) wild cards. First to shout "Check!" wins.
                </p>
              </div>

              <button
                onClick={() => handleStartGroupGame('whot')}
                disabled={isCreatingGroupGame || !selectedGroup}
                className="w-full py-2.5 px-4 rounded-xl bg-brand text-[#0B0F10] font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand/90 active:scale-98 transition-all shadow-sm shadow-brand/10 disabled:opacity-50"
              >
                {isCreatingGroupGame ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} />
                )}
                <span>Play Whot in {selectedGroup?.title || 'Group'}</span>
              </button>
            </div>

            {/* Group Game 2: Trivia Clash */}
            <div className="flex flex-col justify-between p-5 rounded-3xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] hover:border-brand/30 transition-all group shadow-sm">
              <div>
                {/* CSS Trivia Preview */}
                <div className="relative w-full h-36 rounded-2xl bg-[#0B0F10] border border-[#252C2E] p-4 flex flex-col justify-between mb-4 shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold">
                      Afrobeats & Football
                    </span>
                    <span className="font-mono text-amber-400 font-bold text-[11px]">⏱ 15s</span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#151A1C] border border-[#252C2E] text-center">
                    <p className="text-xs font-bold truncate">Who won the UEFA Champions League?</p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-center">
                      ✓ Real Madrid
                    </div>
                    <div className="p-1 rounded-lg bg-[#151A1C] text-[#9BA5A8] text-center">
                      Arsenal
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-lg font-bold tracking-tight">Trivia Clash</h2>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <Users size={12} />
                    All Group Members
                  </span>
                </div>

                <p className="text-xs text-[#9BA5A8] leading-relaxed mb-4">
                  Fast-paced group quiz showdown! Rapid-fire questions across music, culture, sports, and tech. Real-time scores and final championship podium.
                </p>
              </div>

              <button
                onClick={() => handleStartGroupGame('trivia')}
                disabled={isCreatingGroupGame || !selectedGroup}
                className="w-full py-2.5 px-4 rounded-xl bg-brand text-[#0B0F10] font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand/90 active:scale-98 transition-all shadow-sm shadow-brand/10 disabled:opacity-50"
              >
                {isCreatingGroupGame ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} />
                )}
                <span>Play Trivia in {selectedGroup?.title || 'Group'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lobby Modal for 2-Player Create / Join */}
      <RoomLobbyModal
        isOpen={modalState.isOpen}
        gameType={modalState.gameType}
        mode={modalState.mode}
        onClose={() => setModalState({ isOpen: false, gameType: null, mode: 'create' })}
        onRoomJoined={(room) => setActiveRoom(room)}
      />
    </div>
  );
};

export default GamesHomeScreen;
