import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'フォト三択：ほんとかフェイクか（MVP）',
  description: 'ローカル端末で遊べる三択クイズ（AI生成をAPIで実行）',
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


