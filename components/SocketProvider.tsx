'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';

let socketInstance: any = null;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const setSocket = useGameStore((state) => state.setSocket);

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io({
        transports: ['websocket'],
      });
      setSocket(socketInstance);
    }
  }, [setSocket]);

  return <>{children}</>;
}
