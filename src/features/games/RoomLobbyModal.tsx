import React, { useState } from 'react';
import { X, Users, KeyRound, Loader2, Plus, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { gameRoomService } from './services/gameRoomService';
import { createInitialTicTacToeState } from './tic-tac-toe/ticTacToeRules';
import { createInitialPoolGameState } from './pool/poolPhysics';
import type { GameRoom, GameType } from '@/types/games.types';

interface RoomLobbyModalProps {
  gameType: GameType | null;
  mode: 'create' | 'join';
  isOpen: boolean;
  onClose: () => void;
  onRoomJoined: (room: GameRoom) => void;
}

export const RoomLobbyModal: React.FC<RoomLobbyModalProps> = ({
  gameType,
  mode,
  isOpen,
  onClose,
  onRoomJoined,
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const title =
    mode === 'create'
      ? `Create ${gameType === 'pool' ? '8-Ball Pool' : 'Tic-Tac-Toe'} Room`
      : 'Join Game with Code';

  const handleCreate = async () => {
    if (!gameType) return;
    setIsLoading(true);

    try {
      const initialState =
        gameType === 'pool' ? createInitialPoolGameState() : createInitialTicTacToeState();

      const newRoom = await gameRoomService.createRoom(gameType, initialState);
      onRoomJoined(newRoom);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      toast.error('Please enter a room code');
      return;
    }

    setIsLoading(true);
    try {
      const joinedRoom = await gameRoomService.joinRoom(roomCode, gameType || undefined);
      onRoomJoined(joinedRoom);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] shadow-2xl p-6 text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
              {mode === 'create' ? <Plus size={20} /> : <LogIn size={20} />}
            </div>
            <h3 className="font-bold text-base tracking-tight">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#9BA5A8] hover:text-white hover:bg-[#252C2E] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Create Flow */}
        {mode === 'create' ? (
          <div className="space-y-4">
            <p className="text-xs text-[#9BA5A8] leading-relaxed">
              Create a private online multiplayer room. You will receive a 6-character room code to
              share with your friend.
            </p>

            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-2xl bg-brand text-[#0B0F10] font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand/90 active:scale-98 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating Room...</span>
                </>
              ) : (
                <>
                  <Users size={16} />
                  <span>Create Room</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Join Flow */
          <form onSubmit={handleJoin} className="space-y-4">
            <p className="text-xs text-[#9BA5A8] leading-relaxed">
              Enter the 6-character invitation code shared by your friend to join their match.
            </p>

            <div className="relative">
              <KeyRound
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA5A8]"
              />
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7X9K2P"
                autoFocus
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-center font-mono text-lg font-bold tracking-widest placeholder:text-[#9BA5A8]/50 placeholder:font-sans placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:border-brand transition-colors uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || roomCode.trim().length === 0}
              className="w-full py-3 px-4 rounded-2xl bg-brand text-[#0B0F10] font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand/90 active:scale-98 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Joining Room...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Join Match</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
