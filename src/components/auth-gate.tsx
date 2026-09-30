'use client';

/**
 * 认证闸门：未登录时显示登录/注册页，登录后渲染主应用。
 * 登录成功后把本地数据与云端账号打通（startCloudSync）。
 *
 * 设计：用单个 useForm + mode 动态切换 zod schema，避免 React 条件渲染
 * 复用 DOM 节点导致 Controller 事件拦截的问题。
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { BrandLogo } from '@/components/brand-logo';
import { supabase } from '@/lib/supabase';
import { startCloudSync } from '@/lib/cloud';
import { isUsernameTaken, claimUsername } from '@/lib/profile';
import { Toaster, toast } from 'sonner';

const emailSchema = z
  .string()
  .min(1, '请输入邮箱')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '邮箱格式不对，检查一下');

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '请输入密码'),
  confirm: z.string().optional(),
});

const usernameSchema = z
  .string()
  .min(1, '请输入用户名')
  .max(20, '用户名最多 20 个字');

const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: z.string().min(8, '密码至少 8 位，更安全').max(72, '密码太长了'),
    confirm: z.string().min(1, '请再输一次密码'),
  })
  .refine((d) => d.password === d.confirm, {
    message: '两次输入的密码不一致',
    path: ['confirm'],
  });

// 登录与注册共用一份类型；register 才有 username / confirm 必填
type AuthValues = {
  username?: string;
  email: string;
  password: string;
  confirm?: string;
};

/** 把 Supabase 的英文报错翻译成大白话 */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials'))
    return '邮箱或密码不对；如果这个邮箱还没注册，请先点上方「注册」';
  if (m.includes('already registered') || m.includes('already been registered'))
    return '这个邮箱已经注册过了，直接登录吧';
  if (m.includes('rate limit')) return '操作太频繁了，稍等一分钟再试';
  if (m.includes('email not confirmed')) return '邮箱还没验证，去邮箱里点一下确认链接';
  if (m.includes('network') || m.includes('fetch')) return '网络开小差了，检查一下再试';
  return message;
}

function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  // 单个 useForm，schema 根据 mode 切换
  const form = useForm<AuthValues>({
    resolver: zodResolver(mode === 'login' ? loginSchema : registerSchema),
    defaultValues: { username: '', email: '', password: '', confirm: '' },
    mode: 'onSubmit',
  });

  const onSubmit = async (values: AuthValues) => {
    if (!supabase) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email.trim(),
          password: values.password,
        });
        if (error) throw new Error(error.message);
        toast.success('欢迎回来');
        onAuthed();
      } else {
        const username = values.username?.trim() ?? '';
        // 1. 查重：用户名被占用就挡住，别等数据库报错
        if (await isUsernameTaken(username)) {
          toast.error('这个用户名已经有人用了，换一个吧');
          return;
        }
        // 2. 注册
        const { data, error } = await supabase.auth.signUp({
          email: values.email.trim(),
          password: values.password,
          options: {
            data: { username },
          },
        });
        if (error) throw new Error(error.message);
        if (data.session) {
          // 3. 把用户名认领到 profiles（注册下唯一约束兜底）
          await claimUsername(username);
          toast.success('注册成功，开始使用吧');
          onAuthed();
        } else {
          toast.success('注册成功，去邮箱点一下验证链接就能登录了');
          setMode('login');
        }
      }
    } catch (e) {
      toast.error(friendlyAuthError(e instanceof Error ? e.message : '操作失败'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    form.reset();
    form.clearErrors();
  };

  return (
    <div className="ally-fadein flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <BrandLogo size="lg" />
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          冷场别慌，登录后搭子陪你把每一句聊下去
        </p>
      </div>

      <div className="space-y-4 px-6 pb-6">
        <div className="rounded-3xl border bg-card p-4 shadow-sm">
          {/* 登录 / 注册切换 */}
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`rounded-xl py-2 text-sm font-medium transition ${
                  mode === m
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <Form {...form}>
            <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              {mode === 'register' && (
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">用户名</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          autoComplete="nickname"
                          placeholder="给自己起个昵称"
                          className="rounded-xl bg-muted/40"
                          {...field}
                        />
                      </FormControl>
                      {form.formState.errors.username?.message && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.username.message as string}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">邮箱</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="rounded-xl bg-muted/40"
                        {...field}
                      />
                    </FormControl>
                    {form.formState.errors.email?.message && (
                      <p className="text-xs text-destructive">{form.formState.errors.email.message as string}</p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        placeholder={mode === 'login' ? '输入密码' : '至少 8 位'}
                        className="rounded-xl bg-muted/40"
                        {...field}
                      />
                    </FormControl>
                    {form.formState.errors.password?.message && (
                      <p className="text-xs text-destructive">{form.formState.errors.password.message as string}</p>
                    )}
                  </FormItem>
                )}
              />
              {mode === 'register' && (
                <FormField
                  control={form.control}
                  name="confirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">确认密码</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="再输一次"
                          className="rounded-xl bg-muted/40"
                          {...field}
                        />
                      </FormControl>
                      {form.formState.errors.confirm?.message && (
                        <p className="text-xs text-destructive">{form.formState.errors.confirm.message as string}</p>
                      )}
                    </FormItem>
                  )}
                />
              )}
              <Button type="submit" className="w-full rounded-2xl py-6 text-base" disabled={loading}>
                {loading ? (mode === 'login' ? '登录中…' : '注册中…') : mode === 'login' ? '登录' : '注册'}
              </Button>
            </form>
          </Form>
        </div>

        <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          登录后你的试用次数和聊天记录会保存在云端，换手机也不丢
        </p>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!supabase) {
      // 环境变量缺失时不拦截，避免把应用锁死
      setChecking(false);
      setAuthed(true);
      return;
    }
    let mounted = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      if (user) {
        startCloudSync();
        setAuthed(true);
      }
      setChecking(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onAuthed = () => {
    startCloudSync();
    setAuthed(true);
  };

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (!authed) return <AuthScreen onAuthed={onAuthed} />;
  return <>{children}</>;
}
