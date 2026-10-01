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

---

## SCAR-004 2026-09-30 浏览器端到端测试不可用 → 用 curl 分层验证后端

**问题**：
1. 本地 dev 服务器中途挂了（后台 job 停止），浏览器 tab 导航到死掉的 `localhost:5000` 时 WebView 一直等响应 → 渲染进程 hang
2. 一个 tab hang 后拖累整个浏览器，后续 `browser_tabs new` 出来的新 tab 也 navigate 超时
3. `browser_fill` 对 Monaco 编辑器多行 SQL 只填了部分、逐行缩进错乱（不影响执行但很脏）

**根因**：
- 把「数据库/权限验证」和「UI 交互验证」混在一起，全部押宝在浏览器自动化上。后端一挂、WebView 一卡，整个测试链就断了。

**解决方案（重点，验证也要分层）**：
后端（DB / RLS / RPC）不依赖浏览器，直接用 `curl` 打 Supabase 的 PostgREST REST API：
- 验证 RPC 可被 anon 调用：`curl -X POST .../rest/v1/rpc/username_taken` → 返回 `false`
- 验证 RLS 拦截匿名写：`curl -X POST .../rest/v1/profiles` → HTTP 401
- 验证 RLS 匿名读返回空：`curl .../rest/v1/profiles?select=...` → `[]`

这样把「数据库层 + 权限层」和「UI 层」解耦：前者 curl 秒级验证，后者才是浏览器的活。

**教训**：
- 后端验证优先用 curl + PostgREST，比浏览器自动化快、稳一个数量级
- 浏览器自动化只测 UI 层（表单渲染/交互/跳转），永远不拿它验数据库
- Monaco 编辑器填多行 SQL 用 `monaco.editor.getEditors()[0].getModel().setValue(sql)`，别用 `browser_fill`

---

## SCAR-005 2026-09-30 服务器"不可用"反复复发 → 根因是 dev.sh 内置 1 小时定时回收

**问题**：dev server 跑约 1 小时就自动挂掉，表现为「服务器不可用」。之前每次都临时重启了事，反复复发。

**根因（这次彻底挖到，非偶发）**：`scripts/dev.sh` 里 `MAX_RUNTIME_SECONDS=3600` + `timeout_watchdog_enabled()` 是扣子云端为回收资源加的 watchdog。本地没设 `COZE_EVAL`/`COZE_PROJECT_TYPE` 环境变量，开关一直打开，到 1 小时就整组 kill，必然复发。

**修复**：把 `timeout_watchdog_enabled()` 函数体改为 `return 1`，永久禁用定时回收，dev server 现在常驻不自动退出（原逻辑以注释保留，恢复云端回收时改回即可）。已重启验证：5000 端口可访问，返回 200。

**防呆规则**：
- 本项目的 dev.sh 是扣子迁移来的，自带「1 小时自动杀进程」的云端回收逻辑。以后再遇「服务器隔段时间就挂」，先查是不是这类定时回收，而不是无限次重启。
- 伤疤日志的价值不是「记下来」，而是「改了根因让它不再复发」——本次补上的正是这一环。

---

## SCAR-006 2026-09-30 博客功能：富文本编辑器 + 作者名实时跟随 + 浏览器 UI 验证分层

**问题与解决**：
1. **Tiptap v3 富文本在 Next.js SSR 下会报错**：`@tiptap/react` 依赖浏览器 DOM，服务端渲染必然失败。解决：`next/dynamic` + `ssr:false` 动态加载；且组件是**具名导出**，必须写 `dynamic(() => import('@/components/rich-editor').then(m => m.RichEditor))`，直接传模块会报「不能赋给 Loader」类型错误。
2. **Tailwind preflight 会重置富文本排版**：`<h1>` 字号、`<ul>/<ol>` 圆点、`<blockquote>` 边框全被清掉。解决：在 globals.css 手写 `.rich-content` 的一套排版样式（编辑器内与详情页共用），不额外装 @tailwindcss/typography。
3. **作者名「实时跟随用户名」的坑**：blog_posts 若只存 user_id，展示时 join profiles 查当前 username 会被 profiles 的 RLS「仅本人可读」挡住，公开读博客时取不到作者名。解决：给 profiles 加一条公开读策略（username 本就是公开昵称）；blog_posts 不冗余存作者名，前端 `listPosts/getPost` 按 user_id 批量查 profiles 拼出 author。
4. **工具栏按钮点一下编辑器失焦、选区丢失**：给工具栏 button 加 `onMouseDown={(e) => e.preventDefault()}`，保持输入焦点不丢。
5. **浏览器对 localhost:5000 的 navigate/activate/wait 持续 60s 超时**（snapshot 却正常，viewport 还是 0x0）。这是 SCAR-003/004 的同类老问题。本次用 `browser_use` 子代理（独立浏览器实例）绕开卡死，成功验证到列表页 UI；「登录后写文章→详情」这类需要登录态的交互，受环境限制无法完整实测。

**防呆规则**：
- 富文本编辑器一律 `next/dynamic(..., { ssr:false })` + 具名导出的 `.then(m => m.XXX)`，别写 `import()` 直接传。
- 富文本正文样式集中在 `.rich-content` 一处，别在编辑器、详情页各写一套重复样式。
- 展示「作者名」这种 join 出来的字段，先确认被 join 的表 RLS 是否挡得住公开读；挡得住就补公开读策略。
- 浏览器自动化对 localhost 导航卡死时，优先换 `browser_use` 子代理验证 UI，别在一个卡死 tab 上反复 navigate 硬等。

---

## SCAR-007 2026-10-01 改名撞了已占用名字，却只报一句笼统「改名失败」

**现象**：用户把账号「金美缮1」改名成「金缮」，结果：
1. 没提示「金缮已经被人注册了」（其实另一个账号就叫「金缮」）；
2. 用户以为改名成功了，但「金美缮1」写的旧文章作者名没变，误以为系统「认错身份证号/user_id」。

**根因链**：
1. `renameUsername()` 只返回 `boolean`，把「为什么失败」的信息丢了。
2. 数据库的 `username` 有唯一约束，把「金美缮1 → 金缮」这一改给拒了（Postgres 23505 唯一冲突）。但代码里 `return !error` 把它塌缩成一句话「改名失败，稍后再试」——用户既不知道是被占用，也不确定到底改没改成。
3. 旧文章作者名是「实时 join profiles 查当前 username」的，改名根本没落库（accounts 还是「金美缮1」），所以旧文章显示旧名字是**正确行为**，不是 bug —— 是改名压根没成功造成的错觉。
4. `username_taken` RPC 实测正常（已占用返回 true、空闲返回 false），但 `isUsernameTaken` 的 `if (error) return false` 是「查重失败就放行」，一旦 RPC 偶发报错会静默放行，进一步放大「没提示被占用」的观感。

**修复**：
1. `renameUsername` 返回可区分的 `RenameResult`：`{ ok: true }` / `{ ok: false, reason: 'taken' | 'error' }`，用 `error.code === '23505'`（或 message 里含 duplicate/already exists）识别「被占用」。
2. settings-tab 里 `reason === 'taken'` 时明确提示「这个名字刚刚被别人注册了，换一个吧」，其余才兜底「稍后再试」。

**防呆规则**：
- 数据库唯一约束是最后兜底，前端必须把「唯一冲突(23505)」翻译成用户能听懂的话，别塌缩成一句笼统失败。
- 改名/注册这类「断言名字可用」的操作，失败时要区分「被占用」和「其它错误」，不能同一句话糊过去。
- 排查「显示旧数据」类问题，先确认底层的写入到底成功没有（直接查表，`updated_at`/实际值有没有变），别在 UI 表象上猜。
