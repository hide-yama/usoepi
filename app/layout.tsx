import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'USOEPI ウソエピ - 巧みなウソエピソードを見抜け',
  description: '写真にまつわる実話の中に、AIが生成した巧妙なウソエピソードが2つ混ざっています。本物のエピソードを見抜けるか挑戦しよう！',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}


