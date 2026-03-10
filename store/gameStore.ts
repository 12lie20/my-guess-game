import { create } from 'zustand';

export type Player = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isHost: boolean;
  prediction?: string;
  isReady: boolean;
  winStreak: number;
  usedDouble: boolean;
  usedHint: boolean;
  votedFor?: string;
};

export type GameMode = 'mind_reader' | 'spy';
export type RoomState = 'LOBBY' | 'QUESTION' | 'PREDICTION' | 'REVEAL' | 'SCORE' | 'VOTING' | 'SPY_REVEAL';

export type Reaction = {
  playerId: string;
  emoji: string;
  timestamp: number;
};

export type Room = {
  id: string;
  gameMode: GameMode;
  players: Player[];
  state: RoomState;
  subjectId?: string;
  currentQuestion?: string;
  spyQuestion?: string;
  subjectAnswer?: string;
  round: number;
  subjectIndex: number;
  reactions: Reaction[];
  votes?: Record<string, string>;
  spyId?: string;
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
  clearTypingStatus: () => void;
  reactions: Reaction[];
  addReaction: (reaction: Reaction) => void;
  clearReactions: () => void;
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
  clearTypingStatus: () => set({ typingStatus: {} }),
  reactions: [],
  addReaction: (reaction) => set((state) => ({ 
    reactions: [...state.reactions, reaction] 
  })),
  clearReactions: () => set({ reactions: [] }),
}));
