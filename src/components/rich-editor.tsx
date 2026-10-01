'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  type LucideIcon,
} from 'lucide-react';

interface Tool {
  label: string;
  icon: LucideIcon;
  run: (e: Editor) => void;
  active: (e: Editor) => boolean;
}

const TOOLS: Tool[] = [
  { label: '加粗', icon: Bold, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
  { label: '斜体', icon: Italic, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  { label: '删除线', icon: Strikethrough, run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive('strike') },
  { label: '大标题', icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
  { label: '小标题', icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }) },
  { label: '无序列表', icon: List, run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
  { label: '有序列表', icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
  { label: '引用', icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote') },
  { label: '撤销', icon: Undo2, run: (e) => e.chain().focus().undo().run(), active: () => false },
  { label: '重做', icon: Redo2, run: (e) => e.chain().focus().redo().run(), active: () => false },
];

/**
 * 博客富文本编辑器（基于 Tiptap StarterKit）。
 * 必须配合 next/dynamic + ssr:false 使用，避免服务端渲染报错。
 */
export function RichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'rich-content min-h-[240px] px-4 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap gap-1 border-b bg-muted/40 p-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => t.run(editor)}
            className={`flex size-8 items-center justify-center rounded-lg transition ${
              t.active(editor)
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <t.icon className="size-4" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="text-sm" />
    </div>
  );
}