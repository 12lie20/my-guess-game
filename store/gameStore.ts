import { create } from 'zustand';

export type Player = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isHost: boolean;
  prediction?: string;
  isReady: boolean;
};

export type RoomState = 'LOBBY' | 'QUESTION' | 'PREDICTION' | 'REVEAL' | 'SCORE';

export type Room = {
  id: string;
  players: Player[];
  state: RoomState;
  subjectId?: string;
  currentQuestion?: string;
  subjectAnswer?: string;
  round: number;
};

type GameStore = {
  socket: any;
  setSocket: (socket: any) => void;
  room: Room | null;
  setRoom: (room: Room | null) => void;
  player: Player | null;
  setPlayer: (player: Player | null) => void;
  typingStatus: Record<string, string>;
  setTypingStatus: (playerId: string, status: string) => void;
};

export const useGameStore = create<GameStore>((set) => ({
  socket: null,
  setSocket: (socket) => set({ socket }),
  room: null,
  setRoom: (room) => set({ room }),
  player: null,
  setPlayer: (player) => set({ player }),
  typingStatus: {},
  setTypingStatus: (playerId, status) => set((state) => ({
    typingStatus: { ...state.typingStatus, [playerId]: status }
  })),
}));
