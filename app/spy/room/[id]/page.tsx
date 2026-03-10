'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Users, Play, CheckCircle2, Loader2, Trophy, ArrowRight, Ghost } from 'lucide-react';

export default function SpyRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const { socket, room, player, setRoom, typingStatus } = useGameStore();
  const [answer, setAnswer] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!player) {
      router.push('/');
      return;
    }

    if (!socket) return;

    socket.on('room_update', (updatedRoom: any) => {
      setRoom(updatedRoom);
      if (updatedRoom.state === 'QUESTION') {
        setAnswer('');
      } else if (updatedRoom.state === 'VOTING' || updatedRoom.state === 'SCORE') {
        useGameStore.getState().clearTypingStatus();
      }
    });

    socket.on('player_typing', ({ playerId, status }: any) => {
      useGameStore.getState().setTypingStatus(playerId, status);
    });

    return () => {
      socket.off('room_update');
      socket.off('player_typing');
    };
  }, [socket, player, router, setRoom, id]);

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

  const submitVote = (targetId: string) => {
    socket.emit('submit_vote', { roomId: id, targetId });
  };

  const nextRound = () => {
    socket.emit('next_spy_round', id);
  };

  const isSpy = room.spyId === player.id;
  const myVote = player.votedFor;

  const answeredCount = room.players.filter(p => p.prediction).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white p-4 md:p-8 font-sans overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-8 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 flex items-center gap-2">
              <Ghost className="w-6 h-6" /> الغرفة: {id}
            </div>
            <button 
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'تم!' : 'نسخ'}
            </button>
          </div>
          <div className="flex items-center gap-2 text-purple-200">
            <Users className="w-5 h-5" />
            <span className="font-medium">{room.players.length} لاعبين</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {room.state === 'LOBBY' && (
            <motion.div 
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid md:grid-cols-2 gap-8"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                  <Users className="text-cyan-400" /> غرفة الانتظار
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
                          {p.name} {p.id === player.id && <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full">أنت</span>}
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
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    <Play className="w-5 h-5" /> ابدأ اللعبة
                  </button>
                ) : (
                  <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10 text-purple-200 flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" /> ننتظر الهوست...
                  </div>
                )}
              </div>
              
              <div className="hidden md:flex flex-col items-center justify-center text-center p-8">
                <div className="text-6xl mb-6 animate-bounce">🕵️</div>
                <h3 className="text-2xl font-bold mb-4 text-purple-200">كيف تلعب؟</h3>
                <ul className="text-right space-y-4 text-purple-300/80">
                  <li className="flex items-start gap-3">
                    <span className="bg-cyan-500/20 text-cyan-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                    واحد منكم يصير <span className="text-cyan-300 font-bold">جاسوس</span>.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-purple-500/20 text-purple-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                    الجاسوس له سؤال مختلف عنكم.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-amber-500/20 text-amber-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                    تخمنون مين الجاسوس من الإجابات.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-green-500/20 text-green-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</span>
                    اللي يعرف الجاسوس ياخذ نقاط!
                  </li>
                </ul>
              </div>
            </motion.div>
          )}

          {room.state === 'QUESTION' && (
            <motion.div 
              key="question"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl text-center mb-8">
                <div className="inline-block px-4 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 text-sm font-bold mb-6 border border-cyan-500/30">
                  الجولة {room.round}
                </div>
                
                {isSpy ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-500/20 border border-amber-500/40 rounded-xl mb-6">
                      <span className="text-amber-300 font-bold">أنت الجاسوس! 🕵️</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold mb-8 leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-purple-200">
                      {room.spyQuestion}
                    </h2>
                    <p className="text-purple-300 mb-4">جاوب على هذا السؤال (لا أحد يعرف إجابتك!)</p>
                    <input 
                      type="text" 
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="جوابك..."
                      className="w-full bg-black/30 border border-cyan-500/50 rounded-xl py-4 px-6 text-white text-xl placeholder:text-purple-300/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all text-center"
                    />
                    <button 
                      onClick={submitAnswer}
                      disabled={!answer.trim()}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold shadow-lg disabled:opacity-50 transition-all text-lg mt-4"
                    >
                      أرسل إجابتك
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold mb-8 leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-purple-200">
                      {room.currentQuestion}
                    </h2>
                    <p className="text-purple-300 mb-4">جاوب بصراحة!</p>
                    <input 
                      type="text" 
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="جوابك..."
                      className="w-full bg-black/30 border border-purple-500/50 rounded-xl py-4 px-6 text-white text-xl placeholder:text-purple-300/30 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-center"
                    />
                    <button 
                      onClick={submitAnswer}
                      disabled={!answer.trim()}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg disabled:opacity-50 transition-all text-lg mt-4"
                    >
                      أرسل إجابتك
                    </button>
                  </div>
                )}
              </div>

              {/* Progress indicator */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-purple-300 mb-2">
                  <span>الإجابات ({answeredCount}/{room.players.length})</span>
                </div>
                <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(answeredCount / room.players.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {room.players.map(p => (
                  <div key={p.id} className={`bg-black/20 rounded-xl p-3 border border-white/5 flex items-center gap-3 ${
                    p.prediction ? 'bg-green-500/10 border-green-500/30' : ''
                  }`}>
                    <span className="text-2xl">{p.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{p.name}</div>
                      <div className="text-xs text-purple-300 truncate">
                        {p.prediction ? (
                          <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> جاهز</span>
                        ) : (
                          <span className="text-amber-400/80 italic">يكتب...</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {room.state === 'VOTING' && (
            <motion.div 
              key="voting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">صوت على الجاسوس!</h2>
                <p className="text-purple-300 mb-8">من تتوقع أنه الجاسوس؟</p>
                
                <div className="grid grid-cols-2 gap-4">
                  {room.players.filter(p => p.id !== player.id).map(p => (
                    <motion.button
                      key={p.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => submitVote(p.id)}
                      disabled={!!myVote}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        myVote === p.id 
                          ? 'bg-cyan-500/30 border-cyan-400' 
                          : 'bg-black/20 border-white/10 hover:border-cyan-500/50'
                      }`}
                    >
                      <span className="text-4xl block mb-2">{p.avatar}</span>
                      <span className="font-bold">{p.name}</span>
                      {myVote === p.id && (
                        <CheckCircle2 className="w-5 h-5 text-cyan-400 mx-auto mt-2" />
                      )}
                    </motion.button>
                  ))}
                </div>

                {myVote ? (
                  <div className="mt-6 p-4 bg-cyan-500/20 border border-cyan-500/40 rounded-xl">
                    <p className="text-cyan-300">تم تصويتك! انتظر الآخرين...</p>
                  </div>
                ) : (
                  <div className="mt-6 p-4 bg-amber-500/20 border border-amber-500/40 rounded-xl">
                    <p className="text-amber-300">اختر شخص واحد!</p>
                  </div>
                )}
              </div>

              {/* Voting progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-purple-300 mb-2">
                  <span>التصويت ({room.players.filter(p => p.votedFor).length}/{room.players.length})</span>
                </div>
                <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(room.players.filter(p => p.votedFor).length / room.players.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {room.players.map(p => {
                  const votedForPlayer = p.votedFor ? room.players.find(player => player.id === p.votedFor) : null;
                  return (
                    <div key={p.id} className={`bg-black/20 rounded-xl p-3 border border-white/5 flex items-center gap-3 ${
                      p.votedFor ? 'bg-cyan-500/10 border-cyan-500/30' : ''
                    }`}>
                      <span className="text-2xl">{p.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{p.name}</div>
                        <div className="text-xs">
                          {p.votedFor ? (
                            <span className="text-cyan-400 flex items-center gap-1">
                              صوت على <span className="font-bold">{votedForPlayer?.avatar} {votedForPlayer?.name}</span>
                            </span>
                          ) : (
                            <span className="text-amber-400/80">يصوت...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {room.state === 'SCORE' && (
            <motion.div 
              key="score"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl mb-8">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">
                    {room.players.find(p => p.id === room.spyId)?.avatar}
                  </div>
                  <div className="text-2xl font-bold text-cyan-300 mb-2">
                    الجاسوس هو: {room.players.find(p => p.id === room.spyId)?.name}
                  </div>
                  <div className="text-purple-200">
                    {room.votes && room.votes[room.spyId || ''] ? (
                      <span className="text-green-400">تم كشفه! 🎉</span>
                    ) : (
                      <span className="text-amber-400">هرب منا! 🕵️</span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <h3 className="text-xl font-bold text-purple-200 mb-4">جميع الإجابات:</h3>
                  {room.players.map((p) => (
                    <div 
                      key={p.id} 
                      className={`p-4 rounded-xl border ${
                        p.id === room.spyId 
                          ? 'bg-amber-500/20 border-amber-500/50' 
                          : 'bg-black/20 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.avatar}</span>
                        <span className="font-bold">{p.name}</span>
                        {p.id === room.spyId && <span className="text-amber-400 text-sm">(الجاسوس)</span>}
                        {room.votes && p.votedFor === room.spyId && <span className="text-green-400 text-sm">صوت عليه ✓</span>}
                      </div>
                      <div className="mt-2 text-purple-200 italic">"{p.prediction}"</div>
                    </div>
                  ))}
                </div>

                {player.isHost && (
                  <div className="flex justify-center">
                    <button 
                      onClick={nextRound}
                      className="py-5 px-12 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95 text-xl flex items-center gap-3"
                    >
                      الجولة الجاية <ArrowRight className="w-6 h-6 rotate-180" />
                    </button>
                  </div>
                )}
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-2xl rounded-3xl p-8 border border-white/10"
              >
                <h3 className="text-2xl font-black mb-6 flex items-center gap-3 text-amber-400">
                  <Trophy className="w-7 h-7" /> الترتيب
                </h3>
                <div className="space-y-3">
                  {[...room.players].sort((a, b) => b.score - a.score).map((p, i) => (
                    <motion.div 
                      key={p.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-5 p-4 rounded-2xl ${
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
                      <div className="flex-1 font-bold text-xl">{p.name}</div>
                      <div className="font-mono text-2xl font-black text-amber-400">{p.score}</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
