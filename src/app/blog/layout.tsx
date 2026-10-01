import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand-logo';
import { ArrowLeft, PenLine } from 'lucide-react';
import { Toaster } from 'sonner';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2.5 px-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            返回
          </Link>
          <Link href="/blog" className="flex items-center gap-2">
            <LogoMark className="size-7" />
            <span className="text-base font-bold text-foreground">恋爱笔记</span>
          </Link>
          <div className="ml-auto">
            <Button asChild size="sm" className="gap-1.5 rounded-xl">
              <Link href="/blog/new">
                <PenLine className="size-4" />
                写一篇文章
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 py-8">{children}</main>
      <Toaster position="top-center" />
    </div>
  );
}