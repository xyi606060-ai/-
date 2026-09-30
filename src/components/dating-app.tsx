'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Toaster, toast } from 'sonner';
import {
  Sparkles,
  ImagePlus,
  X,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Send,
  RotateCcw,
  UserPlus,
  Settings,
  MessageSquarePlus,
} from 'lucide-react';
import { readAndCompress } from '@/lib/image';
import { copyText } from '@/lib/clipboard';
import {
  getGender,
  hasGender,
  getContacts,
  upsertContact,
  genId,
  leftQuota,
  consumeUsage,
  type Contact,
  type Gender,
} from '@/lib/storage';
import { SettingsTab } from '@/components/settings-tab';
import { Welcome } from '@/components/welcome';
import { BrandLogo } from '@/components/brand-logo';

const STAGES = ['刚认识', '聊了几天', '正在升温', '快约见面了'] as const;
const STAGE_EMOJI: Record<string, string> = {
  刚认识: '👋',
  聊了几天: '💬',
  正在升温: '🌙',
  快约见面了: '🫶',
};

interface SuggestResult {
  stage: string;
  transcript: string;
  candidates: { text: string; tone: string }[];
}

function now() {
  return Date.now();
}

// 从粘贴文本里粗略识别"对方"称呼作为 TA 默认名（如「小红：…」）
function inferTaName(content: string): string {
  if (!content || !content.trim()) return '';
  const m = content.trim().match(/^(.{1,6})[：:]/);
  if (!m) return '';
  const who = m[1].trim();
  const generic = ['TA', '对方', '他', '她', '我', '你', '朋友', '聊天'];
  if (!who || generic.includes(who)) return '';
  return who;
}

// 识别不到时退化命名：TA + 序号
function fallbackTaName(): string {
  const n = getContacts().length;
  return `TA ${n + 1}`;
}

export function DatingApp() {
  const [inWelcome, setInWelcome] = useState<boolean>(() => !hasGender());
  const [gender, setGender] = useState<{ your: Gender; ta: Gender }>(() => getGender());
  const [remaining, setRemaining] = useState<number>(() => leftQuota().left);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [contactsRefresh, setContactsRefresh] = useState(0);

  // 新建 TA 表单
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<Gender>(() => getGender().ta);
  const [newStage, setNewStage] = useState<string>('刚认识');

  // 生成状态
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [stage, setStage] = useState<string>('刚认识');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestResult | null>(null);

  // 就地"顺着这句继续"流式接招
  const [feeding, setFeeding] = useState(false);
  const [feedText, setFeedText] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  // 切换 TA 时重置表单与结果
  useEffect(() => {
    setStage(activeContact?.stage ?? '刚认识');
    setResult(null);
    setFeedText('');
    setFeeding(false);
    setScreenshots([]);
    setText('');
  }, [activeContact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSettingsSheet = () => {
    setShowSettings(true);
  };

  const gotoCreate = () => {
    setCreateMode(true);
    setShowSettings(false);
  };

  const createContact = () => {
    const typed = newName.trim();
    const name = typed || inferTaName(text) || fallbackTaName();
    const c: Contact = {
      id: genId(),
      name,
      gender: newGender,
      stage: newStage,
      messages: [],
      records: [],
      createdAt: now(),
      updatedAt: now(),
    };
    upsertContact(c);
    setActiveContact(c);
    setCreateMode(false);
    setNewName('');
    setContactsRefresh((n) => n + 1);
    toast.success(`已添加「${name}」，开始和 TA 聊吧`);
  };

  const pickExisting = (c: Contact) => {
    setActiveContact(c);
    setCreateMode(false);
    setShowSettings(false);
  };

  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = [...screenshots];
    for (const file of Array.from(files)) {
      try {
        const uri = await readAndCompress(file);
        next.push(uri);
      } catch {
        toast.error('有图片读取失败');
      }
    }
    setScreenshots(next.slice(0, 6));
  }, [screenshots]);

  const removeShot = (idx: number) => {
    setScreenshots((s) => s.filter((_, i) => i !== idx));
  };

  const generate = useCallback(async () => {
    if (!activeContact) {
      toast.warning('请先新建或选择一个 TA');
      return;
    }
    if (screenshots.length === 0 && !text.trim()) {
      toast.warning('请先上传聊天截图，或粘贴对方的发言');
      return;
    }
    if (leftQuota().exhausted) {
      toast.info('试用次数已用尽，更多功能解锁开发中');
      return;
    }
    setLoading(true);
    setResult(null);
    setFeedText('');
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshots,
          text: text.trim() || undefined,
          stage,
          yourGender: gender.your,
          taGender: activeContact.gender !== 'unknown' ? activeContact.gender : gender.ta,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '生成失败');
      }
      const data: SuggestResult = json.data;
      setResult(data);
      setStage(data.stage);

      consumeUsage();
      setRemaining(leftQuota().left);

      // 归档到该 TA 名下
      const updated: Contact = {
        ...activeContact,
        stage: data.stage,
        records: [
          ...(data.transcript || screenshots.length
            ? [
                {
                  time: now(),
                  transcript: data.transcript,
                  candidates: data.candidates,
                },
              ]
            : []),
          ...activeContact.records,
        ],
        updatedAt: now(),
      };
      upsertContact(updated);
      setActiveContact(updated);
      setContactsRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '生成失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, [activeContact, screenshots, text, stage, gender]);

  // 就地"顺着这句继续"：以所选候选为上下文，流式续出下一句，不另开页面
  const continueFeed = useCallback(
    async (candidate: { text: string }) => {
      if (!activeContact || feeding) return;
      if (leftQuota().exhausted) {
        toast.info('试用次数已用尽');
        return;
      }
      setFeeding(true);
      setFeedText('');
      const history: { role: 'user' | 'assistant'; content: string }[] = [];
      for (const m of activeContact.messages) {
        history.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
      }
      history.push({ role: 'assistant', content: candidate.text });
      const historyTail = history.slice(-10);
      try {
        const res = await fetch('/api/talk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage: stage || activeContact.stage,
            transcript: '',
            history: historyTail,
            yourGender: gender.your,
            taGender:
              activeContact.gender !== 'unknown' ? activeContact.gender : gender.ta,
          }),
        });
        if (!res.ok || !res.body) throw new Error('续写失败');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setFeedText(acc);
        }
        const trimmed = acc.trim();
        setFeedText(trimmed);
        consumeUsage();
        setRemaining(leftQuota().left);
        if (trimmed) {
          const updated: Contact = {
            ...activeContact,
            messages: [...activeContact.messages, { role: 'assistant' as const, content: trimmed }],
            updatedAt: now(),
          };
          upsertContact(updated);
          setActiveContact(updated);
          setContactsRefresh((n) => n + 1);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '续写失败，请稍后再试');
      } finally {
        setFeeding(false);
      }
    },
    [activeContact, feeding, stage, gender],
  );

  const onCopy = async (t: string) => {
    await copyText(t);
    setCopied(t);
    toast.success('已复制，可直接发送');
    setTimeout(() => setCopied(null), 1500);
  };

  const savedContacts = getContacts();

  // 主题色由"我自己"的性别决定
  const themeGender = gender.your;

  return (
    <div
      data-atao-gender={themeGender}
      className="flex h-dvh w-full bg-background"
    >
      {inWelcome ? (
        <Welcome
          onContinue={() => {
            setGender(getGender());
            setInWelcome(false);
            setRemaining(leftQuota().left);
          }}
        />
      ) : (
        <div className="flex w-full">
          {/* 左侧常驻侧边栏 */}
          <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar">
            <div className="flex items-center gap-2 border-b px-4 py-3.5">
              <BrandLogo size="sm" />
            </div>
            <div className="ally-scroll flex-1 overflow-y-auto p-3">
              <Button className="mb-3 w-full gap-2 rounded-2xl" onClick={gotoCreate}>
                <MessageSquarePlus className="size-4" /> 新建对话
              </Button>
              <div className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">历史对象</div>
              {savedContacts.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">还没有对话，点「新建对话」开始吧</p>
              ) : (
                <div className="space-y-1">
                  {savedContacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickExisting(c)}
                      className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition hover:bg-accent/50 ${
                        activeContact?.id === c.id ? 'border-primary/40 bg-accent' : 'border-transparent'
                      }`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm text-primary">
                        {c.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {STAGE_EMOJI[c.stage]} {c.stage}
                        </span>
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {c.messages.length > 0 || c.records.length > 0 ? '继续聊' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t p-3">
              <Button variant="ghost" className="w-full justify-start gap-2 rounded-xl text-sm" onClick={openSettingsSheet}>
                <Settings className="size-4" /> 我的设置
              </Button>
            </div>
          </aside>

          {/* 右侧主区 */}
          <div className="flex flex-1 flex-col">
            {/* 顶栏 */}
            <header className="flex items-center justify-end gap-2 border-b bg-background/90 px-6 py-3 backdrop-blur">
              <Badge variant="secondary" className="gap-1 py-1 text-[11px]">
                <Sparkles className="size-3 text-sun" />
                {remaining > 0 ? `剩 ${remaining} 次` : '已用完'}
              </Badge>
              <Button variant="ghost" size="icon" className="size-9" onClick={openSettingsSheet} title="我的">
                <Settings className="size-5" />
              </Button>
            </header>

            {/* 主内容 */}
            <main className="ally-scroll mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-6">
            {showSettings ? (
              <SettingsTab />
            ) : createMode || !activeContact ? (
              <section className="rounded-3xl border bg-card p-4 shadow-sm">
                <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  <UserPlus className="size-4 text-love" /> 新建一位 TA
                </h2>
                <p className="mb-3 text-xs text-muted-foreground">先把要聊的人记下来，之后话术都归到 ta 名下</p>
                <Textarea
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="TA 的名字或昵称（如：小红）· 留空自动识别"
                  className="min-h-[44px] resize-none rounded-xl bg-muted/40 text-sm"
                  rows={1}
                />
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1.5">
                    {(['male', 'female', 'unknown'] as Gender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setNewGender(g)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          newGender === g
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {g === 'male' ? '👨 男' : g === 'female' ? '👩 女' : '❓ 暂不确定'}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewStage(s)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          newStage === s
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {STAGE_EMOJI[s]} {s}
                      </button>
                    ))}
                  </div>
                </div>
                <Button className="mt-4 w-full gap-2 rounded-2xl" onClick={createContact}>
                  <UserPlus className="size-4" /> 开始和 TA 聊
                </Button>

                {savedContacts.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <div className="mb-2 text-xs text-muted-foreground">或者从已有对象里选一个继续：</div>
                    <div className="flex flex-wrap gap-1.5">
                      {savedContacts.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pickExisting(c)}
                          className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <div className="flex flex-col gap-4">
                {/* 当前 TA */}
                <section className="rounded-3xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-9 items-center justify-center rounded-full bg-primary/12 text-base text-primary">
                        {activeContact.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{activeContact.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {STAGE_EMOJI[activeContact.stage]} {activeContact.stage}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={gotoCreate}>
                      <UserPlus className="size-3.5" /> 换 / 新建
                    </Button>
                  </div>
                </section>

                {/* 输入区 */}
                <section className="rounded-3xl border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                      <ImagePlus className="size-4 text-love" /> 你和 TA 的聊天记录
                    </h2>
                    {screenshots.length > 0 && (
                      <span className="text-xs text-muted-foreground">{screenshots.length}/6 张</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mb-2 flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-accent/40"
                  >
                    <ImagePlus className="size-5 text-love" />
                    点击上传聊天截图（可多张）
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void onFiles(e.target.files)}
                  />

                  {screenshots.length > 0 && (
                    <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                      {screenshots.map((s, i) => (
                        <div key={i} className="relative shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s} alt={`截图 ${i + 1}`} className="h-20 w-16 rounded-lg border object-cover" />
                          <button
                            type="button"
                            onClick={() => removeShot(i)}
                            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground/80 text-background"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="或直接粘贴对方跟你说的话（选填）"
                    className="min-h-[64px] resize-none rounded-2xl bg-muted/40 text-sm"
                  />

                  <div className="mt-3">
                    <div className="mb-1.5 text-xs text-muted-foreground">你们现在的关系阶段</div>
                    <div className="flex flex-wrap gap-1.5">
                      {STAGES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStage(s)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${
                            stage === s
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {STAGE_EMOJI[s]} {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="mt-4 w-full gap-2 rounded-2xl py-6 text-base"
                    disabled={loading}
                    onClick={() => void generate()}
                  >
                    {loading ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {loading ? '搭子正在帮你组织语言…' : '帮我想怎么回'}
                  </Button>
                </section>

                {/* 生成结果 + 就地续写 */}
                {(result || feeding || feedText) && (
                  <section className="rounded-3xl border bg-card p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-sm font-semibold">接话建议</h3>
                      {result && (
                        <Badge variant="secondary" className="py-0.5 text-[11px]">
                          {STAGE_EMOJI[result.stage]} {result.stage}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-7"
                        onClick={() => {
                          setResult(null);
                          setFeedText('');
                          setFeeding(false);
                          setCopied(null);
                        }}
                        title="重新来"
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    </div>

                    {result && result.candidates.length > 0 && (
                      <div className="space-y-2.5">
                        {result.candidates.map((c, i) => (
                          <div key={i} className="ally-rise rounded-2xl border p-3" style={{ animationDelay: `${i * 0.08}s` }}>
                            <div className="mb-1.5 flex items-center gap-1.5">
                              <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                                {i + 1}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{c.tone}</span>
                              <div className="ml-auto flex gap-0.5">
                                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => void onCopy(c.text)}>
                                  {copied === c.text ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => toast.success('已记下：这条你最喜欢')}>
                                  <ThumbsUp className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => toast.info('已记下：这条太油腻，下次注意')}>
                                  <ThumbsDown className="size-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-[15px] leading-relaxed">{c.text}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 w-full gap-1.5 rounded-xl text-xs"
                              disabled={feeding}
                              onClick={() => void continueFeed(c)}
                            >
                              <Send className="size-3.5 text-love" />
                              {feeding ? '正在续写…' : '顺着这句，继续推下一句'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {result && result.transcript.trim() && (
                      <p className="mt-3 rounded-xl bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">搭子摘录：</span>
                        {result.transcript}
                      </p>
                    )}

                    {(feeding || feedText) && (
                      <div className="ally-rise mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                          <MessageSquarePlus className="size-3.5" />
                          搭子顺着往下接 ↓
                          {feeding && (
                            <span className="ml-auto inline-block size-3 animate-ping rounded-full bg-primary/60" />
                          )}
                        </div>
                        <p className="min-h-[1.5em] whitespace-pre-wrap text-[15px] leading-relaxed">
                          {feedText || '正在组织语言…'}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 gap-1.5 rounded-xl text-xs"
                            onClick={() => feedText && void onCopy(feedText)}
                          >
                            <Copy className="size-3.5" /> 复制这句
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 rounded-xl text-xs"
                            disabled={feeding || !feedText}
                            onClick={() => feedText && void continueFeed({ text: feedText })}
                          >
                            <Send className="size-3.5 text-love" /> 再续一句
                          </Button>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
                  AI 话术仅供思路参考，建议人工润色后再发送 · 聊天内容仅用于本次生成
                </p>
              </div>
            )}
          </main>
          </div>

          <Toaster position="top-center" />
        </div>
      )}
    </div>
  );
}