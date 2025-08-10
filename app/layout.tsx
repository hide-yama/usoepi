import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'USOEPI ウソエピ - 写真で遊ぶ実話・フェイククイズ',
  description: '写真の要素を使った実話・フェイク混在の三択クイズゲーム。AIが写真から要素を検出し、紛らわしいフェイクを自動生成します。',
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
      <body className="bg-[#0b0c10] text-[#e9edf3]">
        {children}
      </body>
    </html>
  );
}


