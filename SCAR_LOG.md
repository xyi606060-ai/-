# 伤疤日志（SCAR LOG）

> 记录代码里出过的坑、根因、教训。每一条都要能指导下一次动手之前先想清楚。

---

## SCAR-001 2026-09-29 两套 Form 条件渲染 + 同名字段 = DOM 复用事件拦截

**问题**：注册页 email / password 输入框完全无法输入，confirm 框正常；空提交只显示最后一个字段错误；浏览器原生 form submit 抢先执行导致 URL 被改写。

**代码坏味道**：
- ❌ 两套独立的 `useForm` + 两套 `<Form>` 组件，email 和 password 的 name 相同
- ❌ 在同一个 JSX 块里条件渲染两套结构高度相似的 Form
- ❌ `async onSubmit` 里调 `e.preventDefault()` —— React 不 await async handler
- ❌ Zod 把空字符串也拿去跑 `z.email()` 正则，"空"和"格式错"语义混淆
- ❌ `<Toaster>` 分散装在两个层级（AuthScreen 和主界面各有一个）
- ❌ 用 `FormMessage` 走 `useFormState` 订阅，但没验证过是否配合 react-hook-form v7

**根因链**：
1. React 条件切换 login / register 两套 Form 时，email 和 password 的 `<input name="email">` DOM 节点被复用
2. loginForm 的 Controller fiber 还绑在这个 DOM 上，拦截了 onChange
3. registerForm 状态永远更新不了 → 输入框看起来"死了"
4. confirm 字段登录模式不存在，没有复用冲突 → 唯独它能填

**修复**：
1. ✅ 单个 `useForm` 实例，`mode` 切换时换 `resolver: zodResolver(mode === 'login' ? loginSchema : registerSchema)`
2. ✅ confirm 字段用条件渲染控制显隐（`{mode === 'register' && <FormField name="confirm" />}`），不是整套 Form 条件渲染
3. ✅ 错误提示直接读 `form.formState.errors.xxx?.message`，不走 `<FormMessage>`
4. ✅ `form` 加 `noValidate` 禁原生校验；`submit` 用同步 `void form.handleSubmit(onSubmit)`
5. ✅ Zod schema 改为 `.string().min(1, '请输入邮箱').regex(...)`，先判空再判格式

**高内聚低耦合原则**：
- ✅ 一个认证表单管所有模式（login / register 都是同一个 Form 的不同 schema）
- ✅ schema 是纯函数，和组件解耦，要改规则只改 schema
- ✅ 错误渲染逻辑统一（直接读 formState.errors），不再依赖 shadcn FormMessage 的黑盒订阅行为

**防呆规则（下次加表单之前先过一遍）**：
1. **不要用条件渲染切两套同名字段的 Form**。要么用单个 Form + 动态 schema，要么给两套 Form 容器加 `key={`login`}` / `key={`register`}` 强制 React 卸载重建（但这是兜底方案，首选动态 schema）
2. **async onSubmit 里别指望 preventDefault 生效**。要么用同步 wrapper（`const submit = (e) => { e.preventDefault(); void asyncFn(); }`），要么在 `<form>` 上加 `noValidate` 并用 `form.handleSubmit`
3. **Zod 里"空"和"格式错"是两件事**。先 `.min(1, '请输入邮箱')`，再 `.regex(...)`，别用 `.email()` 一把梭
4. **shadcn/ui 的 FormMessage 在未 touched 字段上可能不渲染**。直接读 `form.formState.errors.fieldName?.message` 更可靠
5. **改代码之前先热更新跑通再改下一个**。别堆 3 个改动一起测，出问题不知道是哪个导致的

---

## SCAR-002 2026-09-29 Supabase SQL + RLS：我让用户手动粘贴执行了

**问题**：我能连 Supabase JS client，但没有数据库层面的直接连接方式（psql / supabase-cli），所以让用户手动去 SQL Editor 粘 SQL。

**根因**：开发流程里缺了"自动执行 Supabase 迁移"这一环。正常做法是把建表 + 开 RLS + 建策略的 SQL 写成 migration 文件，然后用 supabase-cli 一键 `db push` 到远端。

**待办**（之后有空做）：
- 安装 `supabase` CLI
- 把建表 + 开 RLS + 建策略写成 `supabase/migrations/xxx_init.sql`
- 以后改数据库结构用 `supabase db diff` 生成增量 migration，再 `supabase db push` 到远端
- 用户零手动操作

**教训**：
- 涉及外部服务初始化的步骤，先想清楚能不能自动化。不能自动化就先说明白为什么不能，再让用户动手。这次我没解释清楚就扔了段 SQL 过去，体验很差

---

## SCAR-003 2026-09-30 浏览器自动化操作 Supabase Dashboard

**问题**：
1. Supabase 的 auth/providers 页面会让 WebView 卡死（`WebView is not ready yet` 持续超时），evaluate / snapshot 全部失败
2. SQL editor 的 Monaco 编辑器多 tab 时，`monaco.editor.getModels()[0]` 拿到的是旧 tab 的 model，setValue 写错地方导致 Run 报 "query too small"

**根因**：
1. auth/providers 是重 JS 的 SPA 路由，旧 tab 的 WebView 渲染进程卡死，且 navigate 不真正跳转（URL 一直停留在 SQL editor）
2. SQL editor 每个 tab 一个 Monaco model，且「New query」会开新 tab；`getModels()[0]` 不是当前可见编辑器

**解决方案**：
1. **WebView 卡死**：用 `browser_tabs({ action: 'new' })` 开新 tab 继续操作（cookie 共享，登录态保留）；不要在原卡死的 tab 里反复 evaluate 硬等
2. **Monaco 定位**：用 `window.monaco.editor.getEditors()[0].getModel().setValue(sql)` 定位当前可见编辑器，而不是 `getModels()[0]`
3. **evaluate 脚本铁律**：顶层 script 必须是「单个表达式」，禁止多语句（不自动 return）和 IIFE（引擎 auto-wrap 导致 double-wrap 返回 undefined）；复杂逻辑写进 `.map(x => ({...}))` 表达式体箭头，别用 `=> { ... }` 块体
4. **SQL 含 DROP 会弹「Potential issue detected」确认框**：点「Run query」确认即可（用幂等的 `DROP POLICY IF EXISTS` 保证可重复执行）

**教训**：
- 操作外部 SPA 后台，先确认每个路由的稳定性，卡死立刻开新 tab，不值得在一个 tab 上耗几十秒
- 浏览器自动化外，数据库结构的可靠验证方式是「行为验证」（注册一个测试账号 + 写数据），不只看 UI 上的 Success
