import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import xssLib from 'xss';

const xss = typeof xssLib === 'function' ? xssLib : 
            (xssLib && (xssLib as any).default) ? (xssLib as any).default : 
            (xssLib && (xssLib as any).filterXSS) ? (xssLib as any).filterXSS : 
            ((str: string) => str);

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Rate Limiter for Socket.io
const rateLimits = new Map<string, { count: number, resetTime: number }>();
const RATE_LIMIT_MAX = 20; // max events
const RATE_LIMIT_WINDOW = 5000; // 5 seconds

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  let limit = rateLimits.get(socketId);
  if (!limit || now > limit.resetTime) {
    limit = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    rateLimits.set(socketId, limit);
    return true;
  }
  limit.count++;
  return limit.count <= RATE_LIMIT_MAX;
}

// Game State Types
type Player = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isHost: boolean;
  prediction?: string;
  isReady: boolean;
};

type RoomState = 'LOBBY' | 'QUESTION' | 'PREDICTION' | 'REVEAL' | 'SCORE';

type Room = {
  id: string;
  players: Player[];
  state: RoomState;
  subjectId?: string;
  currentQuestion?: string;
  subjectAnswer?: string;
  round: number;
};

const rooms = new Map<string, Room>();

const QUESTIONS = [
  "لو كان لازم تاكل أكلة وحدة طول عمرك، وش بتختار؟",
  "وش أكثر شيء تخاف منه بشكل غير منطقي؟",
  "وين ودك تسافر لو جاتك فرصة؟",
  "لو تقدر تختار قوة خارقة، وش بتختار؟",
  "وش فيلمك المفضل؟",
  "وش أكثر موقف محرج صار لك؟",
  "وش هوايتك المفضلة؟",
  "لو طاح عليك مليون ريال فجأة، وش أول شيء بتشتريه؟",
];

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('create_room', ({ name, avatar }, callback) => {
      try {
        if (!checkRateLimit(socket.id)) return callback({ success: false, error: 'Rate limit exceeded' });
        
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        const sanitizedName = xss(name).substring(0, 20);
        
        const newPlayer: Player = {
          id: socket.id,
          name: sanitizedName,
          avatar,
          score: 0,
          isHost: true,
          isReady: false,
        };

        rooms.set(roomId, {
          id: roomId,
          players: [newPlayer],
          state: 'LOBBY',
          round: 1,
        });

        socket.join(roomId);
        callback({ success: true, roomId, room: rooms.get(roomId), player: newPlayer });
      } catch (err: any) {
        console.error('Error in create_room:', err);
        callback({ success: false, error: 'Internal server error' });
      }
    });

    socket.on('join_room', ({ roomId, name, avatar }, callback) => {
      if (!checkRateLimit(socket.id)) return;
      
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ success: false, error: 'Room not found' });
      }

      if (room.state !== 'LOBBY') {
        return callback({ success: false, error: 'Game already in progress' });
      }

      const sanitizedName = xss(name).substring(0, 20);
      const newPlayer: Player = {
        id: socket.id,
        name: sanitizedName,
        avatar,
        score: 0,
        isHost: room.players.length === 0,
        isReady: false,
      };

      room.players.push(newPlayer);
      socket.join(roomId);
      
      io.to(roomId).emit('room_update', room);
      callback({ success: true, room, player: newPlayer });
    });

    socket.on('start_game', (roomId) => {
      if (!checkRateLimit(socket.id)) return;
      
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) return;

      if (room.players.length < 2) return;

      startNewRound(roomId);
    });

    socket.on('submit_answer', ({ roomId, answer }) => {
      if (!checkRateLimit(socket.id)) return;
      
      const room = rooms.get(roomId);
      if (!room) return;

      const sanitizedAnswer = xss(answer).substring(0, 100);

      if (room.state === 'QUESTION' && socket.id === room.subjectId) {
        room.subjectAnswer = sanitizedAnswer;
        room.state = 'PREDICTION';
        io.to(roomId).emit('room_update', room);
      } else if (room.state === 'PREDICTION' && socket.id !== room.subjectId) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.prediction = sanitizedAnswer;
          io.to(roomId).emit('player_typing', { playerId: socket.id, status: 'Submitted' });
          
          // Check if all non-subject players have submitted
          const allSubmitted = room.players
            .filter(p => p.id !== room.subjectId)
            .every(p => p.prediction);
            
          if (allSubmitted) {
            room.state = 'REVEAL';
            io.to(roomId).emit('room_update', room);
          }
        }
      }
    });

    socket.on('typing', ({ roomId }) => {
      if (!checkRateLimit(socket.id)) return;
      const room = rooms.get(roomId);
      if (room && room.state === 'PREDICTION' && socket.id !== room.subjectId) {
        socket.to(roomId).emit('player_typing', { playerId: socket.id, status: 'typing' });
      }
    });

    socket.on('reveal_answers', (roomId) => {
      if (!checkRateLimit(socket.id)) return;
      const room = rooms.get(roomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) return;

      room.state = 'SCORE';
      
      // Calculate scores (simple exact match for now, could be improved)
      const subjectAnswerLower = room.subjectAnswer?.toLowerCase().trim();
      room.players.forEach(p => {
        if (p.id !== room.subjectId && p.prediction) {
          if (p.prediction.toLowerCase().trim() === subjectAnswerLower) {
            p.score += 100;
          }
        }
      });

      io.to(roomId).emit('room_update', room);
    });

    socket.on('next_round', (roomId) => {
      if (!checkRateLimit(socket.id)) return;
      const room = rooms.get(roomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) return;

      room.round++;
      startNewRound(roomId);
    });

    socket.on('disconnect', () => {
      rateLimits.delete(socket.id);
      
      // Find and remove player from all rooms
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const wasHost = room.players[playerIndex].isHost;
          room.players.splice(playerIndex, 1);
          
          if (room.players.length === 0) {
            rooms.delete(roomId);
          } else {
            if (wasHost) {
              room.players[0].isHost = true;
            }
            io.to(roomId).emit('room_update', room);
          }
        }
      }
    });

    function startNewRound(roomId: string) {
      const room = rooms.get(roomId);
      if (!room) return;

      // Reset predictions and answers
      room.players.forEach(p => p.prediction = undefined);
      room.subjectAnswer = undefined;

      // Select random subject
      const subjectIndex = Math.floor(Math.random() * room.players.length);
      room.subjectId = room.players[subjectIndex].id;

      // Select random question
      const questionIndex = Math.floor(Math.random() * QUESTIONS.length);
      room.currentQuestion = QUESTIONS[questionIndex];

      room.state = 'QUESTION';
      io.to(roomId).emit('room_update', room);
    }
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
