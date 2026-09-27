import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '接话搭子 | 线上交友话术助手',
    template: '%s | 接话搭子',
  },
  description:
    '接话搭子是一款 AI 交友话术助手：不知道如何开场、不知道怎么接话怎么办？上传和 TA 的聊天截图，帮你自然、不油腻地接住每一句，把关系聊得更近。',
  keywords: ['接话搭子', '交友话术', '聊天助手', 'AI 破冰', '聊天技巧', '约会话术', '线上交友'],
  authors: [{ name: '接话搭子' }],
  generator: 'Coze Code',
  openGraph: {
    title: '接话搭子 | 你的聊天军师',
    description: '不知道如何开场、不知道怎么接话？上传聊天截图，帮你自然、不油腻地接住每一句。',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#f47b8f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
