'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'motion/react';
import { User, Sparkles, ArrowRight, Loader2, Ghost, Brain } from 'lucide-react';

const AVATARS = [
  '👽', '👻', '🤖', '👾', '🎃', '😺', '🐶', '🦊', '🐼', '🐯'
];

type GameMode = 'mind_reader' | 'spy';

const GAME_MODES = [
  { 
    id: 'mind_reader' as GameMode, 
    name: 'وش يفكر صديقك؟', 
    desc: 'تتوقع إجابات أصدقائك',
    icon: Brain,
    color: 'from-fuchsia-500 to-purple-500'
  },
  { 
    id: 'spy' as GameMode, 
    name: 'الجاسوس', 
    desc: 'اكشف الجاسوس بينكم',
    icon: Ghost,
    color: 'from-cyan-500 to-blue-500'
  },
];

function HomeContent() {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('mind_reader');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket, setRoom, setPlayer } = useGameStore();

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoomCode(roomParam);
      setIsJoining(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!socket) return;
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsConnecting(!socket.connected);
    
    const onConnect = () => {
      setIsConnecting(false);
      setConnectionError('');
    };
    
    const onConnectError = (err: any) => {
      setIsConnecting(false);
      setConnectionError('Connection failed. Please try again.');
      console.error('Socket connection error:', err);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  const handleCreateRoom = () => {
    if (!name.trim()) return;
    const { socket } = useGameStore.getState();
    if (!socket) return;

    socket.emit('create_room', { name, avatar, gameMode: selectedMode }, (response: any) => {
      if (response.success) {
        setRoom(response.room);
        setPlayer(response.player);
        router.push(`/${selectedMode}/room/${response.roomId}`);
      } else {
        alert(response.error || 'Failed to create room');
      }
    });
  };

  const handleJoinRoom = () => {
    if (!name.trim() || !roomCode.trim()) return;
    const { socket } = useGameStore.getState();
    if (!socket) return;

    socket.emit('join_room', { roomId: roomCode, name, avatar }, (response: any) => {
      if (response.success) {
        setRoom(response.room);
        setPlayer(response.player);
        const gameMode = response.room?.gameMode || 'mind_reader';
        router.push(`/${gameMode}/room/${roomCode}`);
      } else {
        alert(response.error);
      }
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white flex flex-col items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400">
          وش يفكر صديقك؟
        </h1>
        <p className="text-xl text-purple-200 opacity-80">تتوقع وش يفكر فيه خويك؟</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 relative overflow-hidden"
      >
        {/* Decorative background circle */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="space-y-6 relative z-10">
          {/* Game Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-3 text-center">اختر اللعبة</label>
            <div className="grid grid-cols-2 gap-3">
              {GAME_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`p-4 rounded-xl transition-all duration-300 flex flex-col items-center gap-2 ${
                      selectedMode === mode.id 
                        ? `bg-gradient-to-br ${mode.color} scale-105 shadow-lg border-2 border-white/30` 
                        : 'bg-white/5 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <Icon className={`w-8 h-8 ${selectedMode === mode.id ? 'text-white' : 'text-purple-300'}`} />
                    <span className={`font-bold text-sm ${selectedMode === mode.id ? 'text-white' : 'text-purple-200'}`}>
                      {mode.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2">اسمك</label>
            <div className="relative group">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 w-5 h-5 group-focus-within:text-fuchsia-400 transition-colors" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اكتب اسمك هنا..."
                className="w-full bg-black/20 border border-purple-500/30 rounded-xl py-3 pr-10 pl-4 text-white placeholder:text-purple-300/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 transition-all"
                maxLength={20}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2 text-center">اختر شخصيتك</label>
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`text-3xl p-2 rounded-xl transition-all duration-300 ${
                    avatar === a 
                      ? 'bg-fuchsia-500/40 scale-110 shadow-[0_0_20px_rgba(217,70,239,0.6)] border border-fuchsia-400/50' 
                      : 'hover:bg-white/10 hover:scale-105 border border-transparent'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            {isConnecting ? (
              <div className="text-center p-4 text-purple-200 flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
                <span className="animate-pulse">جاري الاتصال بالسيرفر...</span>
              </div>
            ) : connectionError ? (
              <div className="text-center p-4 text-red-400 bg-red-500/10 rounded-xl border border-red-500/20">
                {connectionError}
                <button onClick={() => window.location.reload()} className="block mx-auto mt-2 text-sm underline">تحديث الصفحة</button>
              </div>
            ) : isJoining ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">كود الغرفة</label>
                  <input 
                    type="text" 
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="مثال: 1234"
                    className="w-full bg-black/20 border border-purple-500/30 rounded-xl py-4 px-4 text-white text-center text-3xl font-bold tracking-[0.5em] placeholder:text-purple-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all uppercase"
                    maxLength={4}
                    dir="ltr"
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsJoining(false)}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all border border-white/10"
                  >
                    رجوع
                  </button>
                  <button 
                    onClick={handleJoinRoom}
                    disabled={!name.trim() || roomCode.length !== 4}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    ادخل <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleCreateRoom}
                  disabled={!name.trim()}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold shadow-[0_0_25px_rgba(192,38,211,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-lg group"
                >
                  <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" /> سو غرفة جديدة
                </button>
                <button 
                  onClick={() => setIsJoining(true)}
                  className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all border border-white/10"
                >
                  ادخل غرفة موجودة
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 max-w-md w-full text-center"
      >
        <h3 className="text-purple-300 font-bold mb-4 flex items-center justify-center gap-2">
          <div className="h-px w-8 bg-purple-500/30" />
          كيف تلعب؟
          <div className="h-px w-8 bg-purple-500/30" />
        </h3>
        <div className="grid grid-cols-2 gap-4 text-xs text-purple-300/60">
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <span className="block text-fuchsia-400 font-bold mb-1">1. الضحية</span>
            واحد منكم يصير الضحية ونجاوب على سؤال عنه
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <span className="block text-cyan-400 font-bold mb-1">2. التوقع</span>
            الباقين يتوقعون وش بيجاوب الضحية
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <span className="block text-amber-400 font-bold mb-1">3. المطابقة</span>
            إذا توقعك نفس جوابه، مبروك النقاط!
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <span className="block text-green-400 font-bold mb-1">4. الفوز</span>
            اللي يجمع أكثر نقاط هو اللي يعرف أخوياه صح
          </div>
        </div>
      </motion.div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white flex items-center justify-center">جاري التحميل...</div>}>
      <HomeContent />
    </Suspense>
  );
}
