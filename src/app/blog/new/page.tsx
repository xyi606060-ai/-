import { Suspense } from 'react';
import { PostEditor } from '@/components/blog/post-editor';

export default function BlogNewPage() {
  return (
    <Suspense
      fallback={<p className="py-20 text-center text-sm text-muted-foreground">加载中…</p>}
    >
      <PostEditor />
    </Suspense>
  );
}