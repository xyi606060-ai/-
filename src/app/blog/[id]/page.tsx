'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPost, deletePost, formatDate, type BlogPost } from '@/lib/blog';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function BlogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const p = await getPost(id);
      if (!mounted) return;
      if (!p) {
        setNotFound(true);
        return;
      }
      setPost(p);
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (mounted) setIsOwner(Boolean(user && user.id === p.user_id));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const onDelete = async () => {
    if (!window.confirm('确定删除这篇文章吗？删除后无法恢复。')) return;
    setDeleting(true);
    const ok = await deletePost(id);
    setDeleting(false);
    if (ok) {
      toast.success('已删除');
      router.push('/blog');
    } else {
      toast.error('删除失败，请稍后再试');
    }
  };

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-muted-foreground">文章不存在，或已被删除</p>
        <Button asChild variant="outline" className="mt-5 gap-1.5 rounded-2xl">
          <Link href="/blog">
            <ArrowLeft className="size-4" />
            返回列表
          </Link>
        </Button>
      </div>
    );
  }

  if (!post) {
    return <p className="py-20 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  return (
    <article className="animate-[ally-fadein_0.2s_ease-out_both]">
      <h1 className="text-2xl font-bold leading-tight text-foreground">{post.title}</h1>
      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/12 text-[11px] text-primary">
          {post.author.slice(0, 1)}
        </span>
        <span>{post.author}</span>
        <span>·</span>
        <span>{formatDate(post.created_at)}</span>
      </div>

      {isOwner && (
        <div className="mt-4 flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl">
            <Link href={`/blog/new?edit=${post.id}`}>
              <Pencil className="size-3.5" />
              编辑
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={deleting}
            onClick={() => void onDelete()}
            className="gap-1.5 rounded-xl text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            {deleting ? '删除中…' : '删除'}
          </Button>
        </div>
      )}

      <hr className="my-5 border-border" />

      <div className="rich-content text-[15px]" dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}