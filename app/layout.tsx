import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { SocketProvider } from '@/components/SocketProvider';
import { Tajawal } from 'next/font/google';

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'وش يفكر صديقك؟',
  description: 'لعبة وش يفكر صديقك؟',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body suppressHydrationWarning className="font-sans">
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  );
}
