'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { createPost, updatePost, getPost } from '@/lib/blog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// 富文本编辑器必须在客户端挂载后加载（依赖浏览器 DOM），SSR 关闭
const RichEditor = dynamic(
  () => import('@/components/rich-editor').then((m) => m.RichEditor),
  { ssr: false },
);

/** 去掉 HTML 标签后的纯文本长度，用于判断正文是否为空 */
function plainLen(html: string): number {
  return html.replace(/<[^>]*>/g, '').trim().length;
}

export function PostEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit') ?? '';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!supabase) {
        router.replace('/');
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      // 写文章必须登录；未登录回首页
      if (!user) {
        router.replace('/');
        return;
      }
      if (editId) {
        const p = await getPost(editId);
        if (!mounted) return;
        if (!p) {
          router.replace('/blog');
          return;
        }
        setTitle(p.title);
        setContent(p.content);
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [editId, router]);

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      toast.error('标题不能为空');
      return;
    }
    if (plainLen(content) === 0) {
      toast.error('正文不能为空');
      return;
    }
    setSaving(true);
    if (editId) {
      const ok = await updatePost(editId, { title: t, content });
      setSaving(false);
      if (ok) {
        toast.success('已更新');
        router.push(`/blog/${editId}`);
      } else {
        toast.error('保存失败，请稍后再试');
      }
    } else {
      const newId = await createPost({ title: t, content });
      setSaving(false);
      if (newId) {
        toast.success('发布成功');
        router.push(`/blog/${newId}`);
      } else {
        toast.error('发布失败，请稍后再试');
      }
    }
  };

  if (!ready) {
    return <p className="py-20 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="给这篇笔记起个标题"
        maxLength={80}
        className="h-11 rounded-xl bg-muted/40 text-base font-medium"
      />
      <RichEditor value={content} onChange={setContent} />
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 gap-1.5 rounded-2xl">
          {saving ? '保存中…' : editId ? '保存修改' : '发布文章'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} className="rounded-2xl">
          取消
        </Button>
      </div>
    </form>
  );
}