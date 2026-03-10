'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Users, Play, CheckCircle2, Loader2, Trophy, ArrowRight, Flame, Zap, Lightbulb } from 'lucide-react';

const REACTIONS = ['😂', '😱', '👏', '🔥', '🤔', '😎', '❤️', '💯'];

function normalizeArabic(text: string): string {
  if (!text) return '';
  let normalized = text.toLowerCase().trim();
  normalized = normalized.replace(/[\u064B-\u065F]/g, '');
  normalized = normalized.replace(/[أإآ]/g, 'ا');
  normalized = normalized.replace(/ة/g, 'ه');
  normalized = normalized.replace(/ى/g, 'ي');
  normalized = normalized.replace(/(^|\s)ال/g, '$1');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

function isMatch(answer1: string, answer2: string): boolean {
  const norm1 = normalizeArabic(answer1);
  const norm2 = normalizeArabic(answer2);
  if (norm1 === norm2) return true;
  if (norm1.length > 2 && norm2.length > 2) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }
  return false;
}

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const { socket, room, player, setRoom, typingStatus, reactions, addReaction, clearReactions } = useGameStore();
  const [answer, setAnswer] = useState('');
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!player) {
      router.push(`/?room=${id}`);
      return;
    }

    if (!socket) return;

    socket.on('room_update', (updatedRoom: any) => {
      setRoom(updatedRoom);
      setHint('');
      if (updatedRoom.state === 'QUESTION') {
        setAnswer('');
        useGameStore.getState().clearTypingStatus();
      } else if (updatedRoom.state === 'PREDICTION') {
        setAnswer('');
      } else if (updatedRoom.state === 'REVEAL' || updatedRoom.state === 'SCORE') {
        useGameStore.getState().clearTypingStatus();
      }
    });

    socket.on('player_typing', ({ playerId, status }: any) => {
      useGameStore.getState().setTypingStatus(playerId, status);
    });

    socket.on('new_reaction', (reaction: any) => {
      addReaction(reaction);
    });

    socket.on('hint_received', ({ hint }: any) => {
      setHint(hint);
    });

    return () => {
      socket.off('room_update');
      socket.off('player_typing');
      socket.off('new_reaction');
      socket.off('hint_received');
    };
  }, [socket, player, router, setRoom, id, addReaction, clearReactions]);

  if (!room || !player) return null;

  const handleCopyLink = () => {
    const url = `${window.location.origin}?room=${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = () => {
    socket.emit('start_game', id);
  };

  const submitAnswer = () => {
    if (!answer.trim()) return;
    socket.emit('submit_answer', { roomId: id, answer });
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnswer(e.target.value);
    socket.emit('typing', { roomId: id });
  };

  const useDouble = () => {
    socket.emit('use_double', id);
  };

  const useHint = () => {
    socket.emit('use_hint', id);
  };

  const sendReaction = (emoji: string) => {
    socket.emit('send_reaction', { roomId: id, emoji });
  };

  const revealAnswers = () => {
    socket.emit('reveal_answers', id);
  };

  const nextRound = () => {
    socket.emit('next_round', id);
    clearReactions();
  };

  const isSubject = room.subjectId === player.id;
  const subjectPlayer = room.players.find(p => p.id === room.subjectId);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white p-4 md:p-8 font-sans overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-fuchsia-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-fuchsia-400">
              الغرفة: {id}
            </div>
            <button 
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'تم النسخ!' : 'انسخ الرابط'}
            </button>
          </div>
          <div className="flex items-center gap-2 text-purple-200">
            <Users className="w-5 h-5" />
            <span className="font-medium">{room.players.length} لاعبين</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {/* LOBBY STATE */}
          {room.state === 'LOBBY' && (
            <motion.div 
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid md:grid-cols-2 gap-8"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                  <Users className="text-fuchsia-400" /> غرفة الانتظار
                </h2>
                <div className="space-y-4 mb-8">
                  {room.players.map((p) => (
                    <motion.div 
                      key={p.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-4 bg-black/20 p-4 rounded-xl border border-white/5"
                    >
                      <span className="text-4xl drop-shadow-lg">{p.avatar}</span>
                      <div className="flex-1">
                        <div className="font-bold text-lg flex items-center gap-2">
                          {p.name} {p.id === player.id && <span className="text-xs bg-fuchsia-500/20 text-fuchsia-300 px-2 py-1 rounded-full">أنت</span>}
                          {p.isHost && <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full">الهوست</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                {player.isHost ? (
                  <button 
                    onClick={startGame}
                    disabled={room.players.length < 2}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    <Play className="w-5 h-5 rotate-180" /> ابدأ اللعب
                  </button>
                ) : (
                  <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10 text-purple-200 flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" /> ننتظر الهوست يبدأ...
                  </div>
                )}
              </div>
              
              <div className="hidden md:flex flex-col items-center justify-center text-center p-8">
                <div className="text-6xl mb-6 animate-bounce">🤔</div>
                <h3 className="text-2xl font-bold mb-4 text-purple-200">كيف تلعب؟</h3>
                <ul className="text-right space-y-4 text-purple-300/80">
                  <li className="flex items-start gap-3">
                    <span className="bg-fuchsia-500/20 text-fuchsia-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                    نختار واحد منكم يكون هو &quot;الضحية&quot;.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-cyan-500/20 text-cyan-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                    نسأل سؤال عن الضحية.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-amber-500/20 text-amber-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                    الباقين يتوقعون وش بيجاوب الضحية.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-green-500/20 text-green-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</span>
                    إذا توقعك نفس جوابه، تفوز بنقاط!
                  </li>
                </ul>
              </div>
            </motion.div>
          )}

          {/* QUESTION & PREDICTION STATE */}
          {(room.state === 'QUESTION' || room.state === 'PREDICTION') && (
            <motion.div 
              key="question"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl text-center mb-8">
                <div className="inline-block px-4 py-1.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-sm font-bold mb-6 border border-fuchsia-500/30">
                  الجولة {room.round}
                </div>
                
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="text-5xl drop-shadow-xl">{subjectPlayer?.avatar}</span>
                  <div className="text-right">
                    <div className="text-sm text-purple-300 uppercase tracking-wider font-bold">الضحية</div>
                    <div className="text-2xl font-bold text-white">{subjectPlayer?.name}</div>
                  </div>
                </div>

                <h2 className="text-3xl md:text-4xl font-bold mb-8 leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-purple-200">
                  {room.currentQuestion}
                </h2>

                {isSubject ? (
                  <div className="space-y-4">
                    {room.state === 'QUESTION' ? (
                      <>
                        <p className="text-fuchsia-300 font-medium mb-4">جاوب بصراحة! الباقين بيحاولون يتوقعون جوابك.</p>
                        <input 
                          type="text" 
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          placeholder="جوابك..."
                          className="w-full bg-black/30 border border-fuchsia-500/50 rounded-xl py-4 px-6 text-white text-xl placeholder:text-purple-300/30 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 transition-all text-center"
                        />
                        <button 
                          onClick={submitAnswer}
                          disabled={!answer.trim()}
                          className="w-full py-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold shadow-lg disabled:opacity-50 transition-all text-lg mt-4"
                        >
                          اعتمد الجواب
                        </button>
                      </>
                    ) : (
                      <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                        <h3 className="text-xl font-bold text-green-300 mb-2">تم اعتماد الجواب!</h3>
                        <p className="text-green-200/70">ننتظر الباقين يتوقعون...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {room.state === 'QUESTION' ? (
                      <div className="p-6 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 text-purple-200">
                        <Loader2 className="w-6 h-6 animate-spin text-fuchsia-400" />
                        <span className="text-lg">ننتظر {subjectPlayer?.name} يجاوب...</span>
                      </div>
                    ) : (
                      <>
                        {player.prediction || typingStatus[player.id] === 'Submitted' ? (
                          <div className="p-6 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                            <CheckCircle2 className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
                            <h3 className="text-xl font-bold text-cyan-300 mb-2">تم اعتماد توقعك!</h3>
                            <p className="text-cyan-200/70">ننتظر الباقين...</p>
                          </div>
                        ) : (
                          <>
                            <p className="text-cyan-300 font-medium mb-4">وش تتوقع {subjectPlayer?.name} جاوب؟</p>
                            {hint && (
                              <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-center">
                                <span className="text-amber-300">التلميحة: </span>
                                <span className="text-amber-200 font-bold text-xl">{hint}</span>
                              </div>
                            )}
                            <input 
                              type="text" 
                              value={answer}
                              onChange={handleTyping}
                              placeholder="توقعك..."
                              className="w-full bg-black/30 border border-cyan-500/50 rounded-xl py-4 px-6 text-white text-xl placeholder:text-purple-300/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all text-center"
                            />
                            <div className="flex gap-3 mt-4">
                              <button 
                                onClick={submitAnswer}
                                disabled={!answer.trim()}
                                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg disabled:opacity-50 transition-all text-lg"
                              >
                                ارسل توقعك
                              </button>
                              {!player.usedDouble && (
                                <button 
                                  onClick={useDouble}
                                  disabled={!answer.trim()}
                                  className="px-4 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
                                  title="ضاعف نقاطك!"
                                >
                                  <Zap className="w-5 h-5" /> دبل
                                </button>
                              )}
                            </div>
                            {!player.usedHint && !player.usedDouble && player.score >= 50 && !hint && (
                              <button 
                                onClick={useHint}
                                className="w-full py-3 mt-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-medium transition-all flex items-center justify-center gap-2"
                              >
                                <Lightbulb className="w-5 h-5" /> اشترِ تلميحة (-50 نقطة)
                              </button>
                            )}
                            {player.usedDouble && (
                              <div className="mt-3 p-2 bg-orange-500/20 border border-orange-500/40 rounded-xl text-center">
                                <span className="text-orange-300 font-bold flex items-center justify-center gap-2">
                                  <Zap className="w-4 h-4" /> الدبل مفعل! (+200 نقطة)
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Player Status Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {room.players.filter(p => p.id !== room.subjectId).map(p => (
                  <div key={p.id} className="bg-black/20 rounded-xl p-3 border border-white/5 flex items-center gap-3">
                    <span className="text-2xl">{p.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate flex items-center gap-1">
                        {p.name}
                        {p.winStreak >= 2 && (
                          <span className="flex items-center gap-0.5 text-orange-400">
                            <Flame className="w-3 h-3" />
                            <span className="text-xs">{p.winStreak}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-purple-300 truncate">
                        {p.prediction || typingStatus[p.id] === 'Submitted' ? (
                          <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> جاهز</span>
                        ) : (
                          <span className="text-amber-400/80 italic">{typingStatus[p.id] === 'typing' ? 'يكتب...' : 'يفكر...'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* REVEAL & SCORE STATE */}
          {(room.state === 'REVEAL' || room.state === 'SCORE') && (
            <motion.div 
              key="reveal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl mb-8">
                <h2 className="text-2xl font-bold text-center text-purple-200 mb-8">{room.currentQuestion}</h2>
                
                <div className="flex flex-col items-center mb-12">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className="text-7xl mb-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  >
                    {subjectPlayer?.avatar}
                  </motion.div>
                  <div className="text-sm text-fuchsia-300 uppercase tracking-widest font-black mb-2">جواب {subjectPlayer?.name}</div>
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-white to-cyan-400 text-center px-4 py-2"
                  >
                    &quot;{room.subjectAnswer}&quot;
                  </motion.div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-10">
                  {room.players.filter(p => p.id !== room.subjectId).map((p, idx) => {
                    const isCorrect = room.state === 'SCORE' && isMatch(p.prediction || '', room.subjectAnswer || '');
                    return (
                      <motion.div 
                        key={p.id}
                        initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + (idx * 0.1) }}
                        className={`p-5 rounded-2xl border-2 transition-all duration-500 ${
                          room.state === 'SCORE' 
                            ? isCorrect 
                              ? 'bg-green-500/20 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)] scale-105 z-10' 
                              : 'bg-red-500/10 border-red-500/20 opacity-50 grayscale-[0.5]'
                            : 'bg-black/30 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-4 mb-3">
                          <div className="relative">
                            <span className="text-3xl">{p.avatar}</span>
                            {room.state === 'SCORE' && isCorrect && (
                              <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1"
                              >
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </motion.div>
                            )}
                          </div>
                          <span className="font-bold text-lg flex-1 truncate flex items-center gap-1">
                            {p.name}
                            {p.winStreak >= 2 && (
                              <span className="flex items-center gap-0.5 text-orange-400">
                                <Flame className="w-3 h-3" />
                                <span className="text-xs">{p.winStreak}</span>
                              </span>
                            )}
                          </span>
                          {room.state === 'SCORE' && isCorrect && (
                            <motion.span 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="text-green-400 font-black text-xl drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                            >
                              {p.usedDouble ? '+200' : '+100'}
                            </motion.span>
                          )}
                        </div>
                        <div className="text-xl text-white/90 font-medium italic bg-black/20 p-3 rounded-xl border border-white/5">
                          &quot;{p.prediction}&quot;
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Reactions Bar */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-center text-purple-300 mb-3 text-sm">تفاعل مع الإجابات!</p>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {REACTIONS.map((emoji) => (
                      <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => sendReaction(emoji)}
                        className="text-2xl p-2 hover:bg-white/10 rounded-full transition-colors"
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                  {reactions.length > 0 && (
                    <div className="mt-4 flex justify-center gap-1 flex-wrap">
                      {reactions.slice(-10).map((r, idx) => (
                        <motion.span
                          key={idx}
                          initial={{ scale: 0, y: 20, opacity: 0 }}
                          animate={{ scale: 1, y: 0, opacity: 1 }}
                          className="text-2xl"
                        >
                          {r.emoji}
                        </motion.span>
                      ))}
                    </div>
                  )}
                </div>

                {player.isHost && (
                  <div className="flex justify-center pt-4">
                    {room.state === 'REVEAL' ? (
                      <button 
                        onClick={revealAnswers}
                        className="py-5 px-12 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-white font-black shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all hover:scale-105 active:scale-95 text-xl flex items-center gap-3 group"
                      >
                        <Trophy className="w-6 h-6 group-hover:rotate-12 transition-transform" /> احسب النقاط
                      </button>
                    ) : (
                      <button 
                        onClick={nextRound}
                        className="py-5 px-12 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95 text-xl flex items-center gap-3 group"
                      >
                        الجولة الجاية <ArrowRight className="w-6 h-6 rotate-180 group-hover:-translate-x-2 transition-transform" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Leaderboard */}
              {room.state === 'SCORE' && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-black/40 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-3xl"
                >
                  <h3 className="text-2xl font-black mb-6 flex items-center gap-3 text-amber-400">
                    <Trophy className="w-7 h-7" /> الترتيب الحالي
                  </h3>
                  <div className="space-y-3">
                    {[...room.players].sort((a, b) => b.score - a.score).map((p, i) => (
                      <motion.div 
                        key={p.id} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`flex items-center gap-5 p-4 rounded-2xl transition-colors ${
                          i === 0 ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-white/5 border border-white/5'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xl ${
                          i === 0 ? 'bg-amber-500 text-black' : 
                          i === 1 ? 'bg-slate-300 text-black' : 
                          i === 2 ? 'bg-amber-700 text-white' : 'text-purple-300'
                        }`}>
                          {i + 1}
                        </div>
                        <span className="text-4xl">{p.avatar}</span>
                        <div className="flex-1 font-bold text-xl flex items-center gap-2">
                          {p.name}
                          {p.winStreak >= 2 && (
                            <span className="flex items-center gap-1 text-orange-400 bg-orange-400/10 px-2 py-1 rounded-full">
                              <Flame className="w-4 h-4" />
                              <span className="text-sm">{p.winStreak}</span>
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-2xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">{p.score}</div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
