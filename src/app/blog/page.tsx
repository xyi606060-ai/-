'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listPosts, formatDate, type BlogPostMeta } from '@/lib/blog';
import { Button } from '@/components/ui/button';
import { PenLine, NotebookPen } from 'lucide-react';

export default function BlogListPage() {
  const [posts, setPosts] = useState<BlogPostMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const list = await listPosts();
      if (!mounted) return;
      setPosts(list);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <NotebookPen className="size-10 text-love" />
        <p className="mt-4 text-sm font-medium text-foreground">这里还没有文章</p>
        <p className="mt-1 text-xs text-muted-foreground">记录下你的心动瞬间，来写第一篇吧</p>
        <Button asChild className="mt-5 gap-1.5 rounded-2xl">
          <Link href="/blog/new">
            <PenLine className="size-4" />
            写第一篇文章
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <Link
          key={p.id}
          href={`/blog/${p.id}`}
          className="block rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow"
        >
          <h2 className="text-base font-semibold leading-snug text-foreground">{p.title}</h2>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/12 text-[10px] text-primary">
                {p.author.slice(0, 1)}
              </span>
              {p.author}
            </span>
            <span>·</span>
            <span>{formatDate(p.created_at)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}