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

function normalizeArabic(text: string): string {
  if (!text) return '';
  let normalized = text.toLowerCase().trim();
  // Remove diacritics (tashkeel)
  normalized = normalized.replace(/[\u064B-\u065F]/g, '');
  // Normalize Alif
  normalized = normalized.replace(/[أإآ]/g, 'ا');
  // Normalize Teh Marbuta to Heh
  normalized = normalized.replace(/ة/g, 'ه');
  // Normalize Yaa to Alif Maksura
  normalized = normalized.replace(/ى/g, 'ي');
  // Remove "ال" from the beginning of words
  normalized = normalized.replace(/(^|\s)ال/g, '$1');
  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

function isMatch(answer1: string, answer2: string): boolean {
  const norm1 = normalizeArabic(answer1);
  const norm2 = normalizeArabic(answer2);
  
  if (norm1 === norm2) return true;
  
  // If one contains the other and it's a significant word
  if (norm1.length > 2 && norm2.length > 2) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }
  
  return false;
}

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
  winStreak: number;
  usedDouble: boolean;
  usedHint: boolean;
  votedFor?: string;
};

type GameMode = 'mind_reader' | 'spy';

type RoomState = 'LOBBY' | 'QUESTION' | 'PREDICTION' | 'REVEAL' | 'SCORE' | 'VOTING' | 'SPY_REVEAL';
type SpyState = 'LOBBY' | 'QUESTION' | 'VOTING' | 'SPY_REVEAL' | 'SCORE';

type Reaction = {
  playerId: string;
  emoji: string;
  timestamp: number;
};

type Room = {
  id: string;
  gameMode: GameMode;
  players: Player[];
  state: RoomState | SpyState;
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
  "وش أكثر صفة تحبها في نفسك؟",
  "لو تقدر ترجع بالزمن، لأي سنة بترجع؟",
  "وش الشيء اللي مستحيل تسويه لو ايش ما صار؟",
  "وش أكثر كلمة ترددها دايم؟",
  "لو كنت حيوان، وش ودك تكون؟",
  "وش أفضل مطعم جربته في حياتك؟",
  "وش الشيء اللي يخليك تعصب بسرعة؟",
  "لو خيروك تعيش في الماضي أو المستقبل، وش تختار؟",
  "وش أكثر تطبيق تستخدمه في جوالك؟",
  "وش الشيء اللي دايم يضحكك؟",
  "لو تقدر تقابل شخصية مشهورة (حية أو ميتة)، مين بتختار؟",
  "وش أغرب أكلة جربتها؟",
  "لو كنت رئيس دولة ليوم واحد، وش أول قرار بتتخذه؟",
  "وش الشيء اللي ندمت انك ما سويته؟",
  "لو تقدر تغير اسمك، وش بتسمي نفسك؟",
  "وش أكثر شيء يخليك فخور بنفسك؟",
  "لو كنت في جزيرة مهجورة، وش الثلاث أشياء اللي بتاخذها معك؟",
  "وش الشيء اللي كنت تحبه وانت صغير والحين كرهته؟",
  "لو تقدر تتعلم لغة جديدة في ثانية، وش بتختار؟",
  "وش أكثر شيء يشدك في الشخص اللي قدامك؟",
  "لو تقدر تغير شيء واحد في العالم، وش بيكون؟",
  "وش الشيء اللي دايم تضيعه؟",
  "لو كنت بطل في لعبة فيديو، وش بتكون اللعبة؟",
  "وش أكثر شيء يخليك تحس بالسعادة؟",
  "لو تقدر تسكن في أي مكان في العالم، وين بتختار؟",
  "وش الشيء اللي تمنيت انك عرفته قبل خمس سنين؟",
  "لو تقدر تكون خبير في أي مجال، وش بتختار؟",
  "وش أكثر شيء يخليك تحس بالراحة؟",
  "لو تقدر تغير عادة وحدة فيك، وش بتكون؟",
  "وش الشيء اللي دايم يخليك تفكر قبل ما تنام؟",
  "لو كنت تقدر تطير، وين أول مكان بتروح له؟",
  "وش أكثر شيء يخليك تحس بالامتنان؟",
  "لو تقدر تعيش حياة شخص ثاني ليوم واحد، مين بيكون؟",
  "وش الشيء اللي دايم يخليك تبتسم؟",
  "لو تقدر تخفي شيء واحد من العالم، وش بيكون؟",
  "وش أكثر شيء يخليك تحس بالثقة؟",
  "لو تقدر ترجع طفل ليوم واحد، وش بتسوي؟",
  "وش الشيء اللي دايم يخليك تحس بالفضول؟",
  "لو تقدر تكون في مكانين في نفس الوقت، وين بتكون؟",
  "وش أكثر شيء يخليك تحس بالهدوء؟",
  "لو تقدر تغير نهايتك المفضلة في فيلم أو كتاب، وش بتغير؟",
  "وش الشيء اللي دايم يخليك تحس بالنشاط؟",
  "لو تقدر تكون عندك موهبة فنية، وش بتختار؟",
  "وش أكثر شيء يخليك تحس بالانتماء؟",
  "لو تقدر تسافر للفضاء، وش أول كوكب بتزوره؟",
  "وش الشيء اللي دايم يخليك تحس بالتحدي؟",
  "لو تقدر تكون عندك ذاكرة صورية، وش أول شيء بتحفظه؟",
  "وش أكثر شيء يخليك تحس بالرضا؟",
  "لو تقدر تغير فصول السنة، وش الفصل اللي بتخليه دايم؟",
  "وش الشيء اللي دايم يخليك تحس بالإلهام؟",
  "لو تقدر تكون عندك قدرة التحدث مع الحيوانات، وش أول حيوان بتكلمه؟",
  "وش أكثر شيء يخليك تحس بالجمال؟",
  "لو تقدر تعيش في عالم خيالي، وش بيكون؟",
  "وش الشيء اللي دايم يخليك تحس بالتفاؤل؟",
  "لو تقدر تكون عندك قدرة التنفس تحت الماء، وين بتغوص؟",
  "وش أكثر شيء يخليك تحس بالحب؟",
  "لو تقدر تغير تاريخ ميلادك، لأي يوم بتغيره؟",
  "وش الشيء اللي دايم يخليك تحس بالدهشة؟",
  "لو تقدر تكون عندك قدرة الاختفاء، وش بتسوي؟",
  "وش أكثر شيء يخليك تحس بالأمان؟",
  "لو تقدر تعيش في عصر النهضة أو العصور الوسطى، وش تختار؟",
  "وش الشيء اللي دايم يخليك تحس بالحرية؟",
  "لو تقدر تكون عندك قدرة قراءة الأفكار، مين أول شخص بتقرأ أفكاره؟",
  "وش أكثر شيء يخليك تحس بالتميز؟",
  "لو تقدر تغير لون السماء، وش بتخليه؟",
  "وش الشيء اللي دايم يخليك تحس بالارتباط؟",
  "لو تقدر تكون عندك قدرة التحكم في الوقت، وش بتسوي؟",
  "وش أكثر شيء يخليك تحس بالبهجة؟",
  "لو تقدر تعيش في مدينة تحت البحر، وش بتسميها؟",
  "وش الشيء اللي دايم يخليك تحس بالقوة؟",
  "لو تقدر تكون عندك قدرة الشفاء السريع، وش بتسوي؟",
  "وش أكثر شيء يخليك تحس بالسلام؟",
  "لو تقدر تغير طعم أكلك المفضل، وش بتخليه؟",
  "وش الشيء اللي دايم يخليك تحس بالتركيز؟",
  "لو تقدر تكون عندك قدرة الرؤية في الظلام، وين بتروح؟",
  "وش أكثر شيء يخليك تحس بالحماس؟",
  "لو تقدر تعيش في غابة مطيرة، وش بتسوي؟",
  "وش الشيء اللي دايم يخليك تحس بالوضوح؟",
  "لو تقدر تكون عندك قدرة المشي على الجدران، وين بتوصل؟",
  "وش أكثر شيء يخليك تحس بالتوازن؟",
  "لو تقدر تغير رائحة المطر، وش بتخليها؟",
  "وش الشيء اللي دايم يخليك تحس بالعمق؟",
  "لو تقدر تكون عندك قدرة التحول لأي شخص، مين بتختار؟",
  "وش أكثر شيء يخليك تحس بالاتصال؟",
  "لو تقدر تعيش في قلعة قديمة، وش بتسوي فيها؟",
  "وش الشيء اللي دايم يخليك تحس بالنمو؟",
  "لو تقدر تكون عندك قدرة استدعاء أي شيء، وش بتطلب؟",
  "وش أكثر شيء يخليك تحس بالكمال؟",
  "لو تقدر تغير صوتك، وش بتخليه يشبه؟",
  "وش الشيء اللي دايم يخليك تحس بالبساطة؟",
  "لو تقدر تكون عندك قدرة الجري بسرعة البرق، وين بتروح؟",
  "وش أكثر شيء يخليك تحس بالروعة؟",
];

const SPY_QUESTIONS = [
  "وش أكثر شيء يخافون منه؟",
  "وش أكلة يحبونها؟",
  "وش لونهم المفضل؟",
  "وش فلمهم المفضل؟",
  "وش رياضتهم المفضلة؟",
  "وش بلد يحبون يسافروا لها؟",
  "وش animal يحبون؟",
  "وش شيء يكرهونه؟",
  "وش هوايتهم؟",
  "وش أغنيتهم المفضلة؟",
  "وش مشروبهم المفضل؟",
  "وش شيء يتمنونه؟",
  "وش لون شعرهم؟",
  "وش تاريخ ميلادهم؟",
  "وش مدينة سكنوا فيها؟",
  "وش University درسوا فيها؟",
  "وش اسم حيوانهم الأليف؟",
  "وش شيئ يشتغلون فيه؟",
  "وش restaurant يحبون؟",
  "وش sport يلعبون؟",
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

    socket.on('create_room', ({ name, avatar, gameMode = 'mind_reader' }, callback) => {
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
          winStreak: 0,
          usedDouble: false,
          usedHint: false,
        };

        rooms.set(roomId, {
          id: roomId,
          gameMode: gameMode as GameMode,
          players: [newPlayer],
          state: 'LOBBY',
          round: 1,
          subjectIndex: -1,
          reactions: [],
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
      const isFirstPlayer = room.players.length === 0;
      const newPlayer: Player = {
        id: socket.id,
        name: sanitizedName,
        avatar,
        score: 0,
        isHost: isFirstPlayer,
        isReady: false,
        winStreak: 0,
        usedDouble: false,
        usedHint: false,
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

      room.subjectIndex = -1;
      
      if (room.gameMode === 'spy') {
        startSpyRound(roomId);
      } else {
        startNewRound(roomId);
      }
    });

    socket.on('submit_answer', ({ roomId, answer }) => {
      if (!checkRateLimit(socket.id)) return;
      
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      const sanitizedAnswer = xss(answer).substring(0, 100);

      if (room.gameMode === 'spy') {
        if (room.state === 'QUESTION') {
          player.prediction = sanitizedAnswer;
          
          const allSubmitted = room.players.every(p => p.prediction);
          if (allSubmitted) {
            room.state = 'VOTING';
            io.to(roomId).emit('room_update', room);
          }
        }
      } else {
        if (room.state === 'QUESTION' && socket.id === room.subjectId) {
          room.subjectAnswer = sanitizedAnswer;
          room.state = 'PREDICTION';
          io.to(roomId).emit('room_update', room);
        } else if (room.state === 'PREDICTION' && socket.id !== room.subjectId) {
          if (player.prediction) return;
          
          player.prediction = sanitizedAnswer;
          io.to(roomId).emit('player_typing', { playerId: socket.id, status: 'Submitted' });
          
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

    socket.on('submit_vote', ({ roomId, targetId }) => {
      if (!checkRateLimit(socket.id)) return;
      
      const room = rooms.get(roomId);
      if (!room || room.state !== 'VOTING') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.votedFor) return;

      player.votedFor = targetId;
      if (!room.votes) room.votes = {};
      room.votes[socket.id] = targetId;

      const allVoted = room.players.every(p => p.votedFor);
      if (allVoted) {
        calculateSpyResults(roomId);
      } else {
        io.to(roomId).emit('room_update', room);
      }
    });

    function calculateSpyResults(roomId: string) {
      const room = rooms.get(roomId);
      if (!room) return;

      room.state = 'SCORE';
      
      const voteCount: Record<string, number> = {};
      room.players.forEach(p => {
        if (p.votedFor) {
          voteCount[p.votedFor] = (voteCount[p.votedFor] || 0) + 1;
        }
      });

      const spyCaught = room.spyId && voteCount[room.spyId] && voteCount[room.spyId] > 0;
      
      room.players.forEach(p => {
        if (room.spyId && p.id === room.spyId) {
          if (spyCaught) {
            p.score += 50;
          } else {
            p.score += 100;
          }
        } else if (room.spyId && p.votedFor === room.spyId) {
          p.score += 100;
        }
      });

      io.to(roomId).emit('room_update', room);
    }

    socket.on('next_spy_round', (roomId) => {
      if (!checkRateLimit(socket.id)) return;
      const room = rooms.get(roomId);
      if (!room || room.state !== 'SCORE') return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) return;

      room.round++;
      startSpyRound(roomId);
    });

    socket.on('typing', ({ roomId }) => {
      if (!checkRateLimit(socket.id)) return;
      const room = rooms.get(roomId);
      if (room && room.state === 'PREDICTION' && socket.id !== room.subjectId) {
        const player = room.players.find(p => p.id === socket.id);
        if (player && !player.prediction) {
          socket.to(roomId).emit('player_typing', { playerId: socket.id, status: 'typing' });
        }
      }
    });

    socket.on('reveal_answers', (roomId) => {
      if (!checkRateLimit(socket.id)) return;
      const room = rooms.get(roomId);
      if (!room || room.state !== 'REVEAL') return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) return;

      room.state = 'SCORE';
      
      // Calculate scores
      const subjectAnswer = room.subjectAnswer || '';
      room.players.forEach(p => {
        if (p.id !== room.subjectId && p.prediction) {
          if (isMatch(p.prediction, subjectAnswer)) {
            const points = p.usedDouble ? 200 : 100;
            p.score += points;
            p.winStreak += 1;
          } else {
            p.winStreak = 0;
          }
        }
      });

      io.to(roomId).emit('room_update', room);
    });

    socket.on('next_round', (roomId) => {
      if (!checkRateLimit(socket.id)) return;
      const room = rooms.get(roomId);
      if (!room || room.state !== 'SCORE') return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) return;

      room.round++;
      startNewRound(roomId);
    });

    socket.on('use_double', (roomId) => {
      const room = rooms.get(roomId);
      if (!room || room.state !== 'PREDICTION') return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.prediction || player.usedDouble) return;
      
      player.usedDouble = true;
      io.to(roomId).emit('room_update', room);
    });

    socket.on('use_hint', (roomId) => {
      const room = rooms.get(roomId);
      if (!room || room.state !== 'PREDICTION') return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.prediction || player.usedHint) return;
      
      if (player.score < 50) return;
      
      player.score -= 50;
      player.usedHint = true;
      
      const subjectAnswer = room.subjectAnswer || '';
      const hint = subjectAnswer.length > 0 ? subjectAnswer[0] + '...' : '...';
      
      io.to(roomId).emit('room_update', room);
      socket.emit('hint_received', { hint });
    });

    socket.on('send_reaction', ({ roomId, emoji }) => {
      const room = rooms.get(roomId);
      if (!room || (room.state !== 'REVEAL' && room.state !== 'SCORE')) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      
      const reaction: Reaction = {
        playerId: socket.id,
        emoji: xss(emoji).substring(0, 10),
        timestamp: Date.now(),
      };
      
      room.reactions.push(reaction);
      io.to(roomId).emit('new_reaction', reaction);
    });

    socket.on('disconnect', () => {
      rateLimits.delete(socket.id);
      
      // Find and remove player from all rooms
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const wasHost = room.players[playerIndex].isHost;
          const wasSubject = room.subjectId === socket.id;
          
          room.players.splice(playerIndex, 1);
          
          if (room.players.length === 0) {
            rooms.delete(roomId);
          } else {
            if (wasHost) {
              room.players[0].isHost = true;
            }
            
            // If the subject left during a round, we need to handle it
            if (wasSubject && room.state !== 'LOBBY' && room.state !== 'SCORE') {
              room.round++;
              startNewRound(roomId);
            } else {
              // Adjust subjectIndex if needed
              if (room.subjectIndex >= room.players.length) {
                room.subjectIndex = 0;
              }
              io.to(roomId).emit('room_update', room);
            }
          }
        }
      }
    });

    function startNewRound(roomId: string) {
      const room = rooms.get(roomId);
      if (!room) return;

      // Reset predictions, answers, double, hint, and reactions
      room.players.forEach(p => {
        p.prediction = undefined;
        p.usedDouble = false;
        p.usedHint = false;
      });
      room.subjectAnswer = undefined;
      room.reactions = [];

      // Select sequential subject
      room.subjectIndex = (room.subjectIndex + 1) % room.players.length;
      room.subjectId = room.players[room.subjectIndex].id;

      // Select random question
      const questionIndex = Math.floor(Math.random() * QUESTIONS.length);
      room.currentQuestion = QUESTIONS[questionIndex];

      room.state = 'QUESTION';
      io.to(roomId).emit('room_update', room);
    }

    function startSpyRound(roomId: string) {
      const room = rooms.get(roomId);
      if (!room) return;

      room.players.forEach(p => {
        p.prediction = undefined;
        p.votedFor = undefined;
      });
      room.reactions = [];
      room.votes = {};

      room.subjectIndex = (room.subjectIndex + 1) % room.players.length;
      room.subjectId = room.players[room.subjectIndex].id;
      room.spyId = room.subjectId;

      const questionIndex = Math.floor(Math.random() * SPY_QUESTIONS.length);
      room.currentQuestion = SPY_QUESTIONS[questionIndex];
      
      const spyQuestionIndex = Math.floor(Math.random() * SPY_QUESTIONS.length);
      room.spyQuestion = SPY_QUESTIONS[spyQuestionIndex];

      room.state = 'QUESTION';
      io.to(roomId).emit('room_update', room);
    }
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
