import React, { useState, Suspense, lazy } from 'react';
import { Gamepad2, Users, Plus, KeyRound, Loader2 } from 'lucide-react';
import { RoomLobbyModal } from './RoomLobbyModal';
import { TicTacToeGameScreen } from './tic-tac-toe/TicTacToeGameScreen';
import type { GameRoom, GameType } from '@/types/games.types';

// Lazy load pool module to keep initial bundle ultra-lightweight
const PoolGameScreen = lazy(() => import('./pool/PoolGameScreen'));

export const GamesHomeScreen: React.FC = () => {
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    gameType: GameType | null;
    mode: 'create' | 'join';
  }>({
    isOpen: false,
    gameType: null,
    mode: 'create',
  });

  const handleOpenCreate = (gameType: GameType) => {
    setModalState({ isOpen: true, gameType, mode: 'create' });
  };

  const handleOpenJoin = () => {
    setModalState({ isOpen: true, gameType: null, mode: 'join' });
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
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-y-auto bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] p-4 md:p-6 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
            <Gamepad2 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MeChat Games</h1>
            <p className="text-xs text-[#9BA5A8]">Real-time 2-player online multiplayer</p>
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

      {/* Exactly Two Game Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
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

                {/* Head string line */}
                <div className="absolute top-0 bottom-0 left-1/4 border-l border-white/10 border-dashed" />

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
              Real-time 2D Canvas pool with accurate ball collisions, cushion bounces, shot power, aiming guides, and standard 8-ball rules.
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
                <div className="rounded-lg bg-brand/20 border border-brand/50 flex items-center justify-center font-black text-brand text-base shadow-sm">
                  X
                </div>
                <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center" />

                <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center" />
                <div className="rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] flex items-center justify-center" />
                <div className="rounded-lg bg-brand/20 border border-brand/50 flex items-center justify-center font-black text-brand text-base shadow-sm">
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
              Classic 3×3 grid game. Turn-based multiplayer with instant move synchronization, win detection, draws, and rematches.
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

      {/* Lobby Modal for Room Code Creation or Entering */}
      <RoomLobbyModal
        gameType={modalState.gameType}
        mode={modalState.mode}
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, gameType: null, mode: 'create' })}
        onRoomJoined={(room) => setActiveRoom(room)}
      />
    </div>
  );
};
