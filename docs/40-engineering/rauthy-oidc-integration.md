# Rauthy OIDC 新账号接入基线

## 范围

本轮只增加可配置的新登录路径。Rauthy 负责身份认证，Platform 继续持有业务账户、
权益和钱包。旧账号都是测试数据，但本实现既不迁移旧身份，也不删除旧库或任何数据。
不按邮箱、用户名或旧 Linux.do ID 自动绑定账户。不修改 Asset、Loom、Hook 仓库。

参考服务端为个人 fork 的 `personal` 分支，基于稳定版本 Rauthy v0.36.2
（`dd61ac3c84d6b238108dc8438b53043b5177a662`）。本轮没有部署该服务或创建真实管理员。
Linux.do 上游登录是可选来源；其缺邮箱问题不阻塞 Rauthy 标准新账号 OIDC 登录。

## 配置开关

默认 `AUTH_PROVIDER=linuxdo`，不加载 Rauthy 配置，也不调用 Rauthy。
启用新路径需要在 Web 与 account-api 两侧显式配置：

- `AUTH_PROVIDER=rauthy`
- `RAUTHY_ISSUER_URL`：与发现文档、ID token 完全一致的 issuer

Web 另外要求 `RAUTHY_CLIENT_ID`、`RAUTHY_CLIENT_SECRET`、至少 32 字符的独立
`NEXTAUTH_SECRET`，以及正确的 `AUTH_URL` / `NEXTAUTH_URL` 与内部账户 API 配置。
account-api 不需要 OAuth 客户端 secret；它仍要求既有内部服务请求鉴权。
示例只含占位符，不可直接用于正式环境。配置错误会失败，不降级成匿名或开发账号。

Rauthy v0.36.2 的实际 issuer 形如 `https://identity.example.com/auth/v1/`，
包含结尾斜线。必须原样保存，不可为了比较而去掉斜线。JWKS 使用同源
`/auth/v1/oidc/certs`。客户端准确登记回调 `https://app.example.com/api/auth/callback/rauthy`，
启用授权码流及 S256 PKCE。Web 请求 `openid profile email`，但缺少可选邮箱不阻塞
Platform 新业务账户创建。Rauthy 自身的注册/邮箱要求仍由其服务端管理。

生产只允许 HTTPS。合成本地测试可在 `NODE_ENV=development` 或 `test` 下额外设置
`RAUTHY_ALLOW_INSECURE_LOOPBACK=true`，只允许 localhost、127.0.0.1、[::1] 的 HTTP issuer。
此选项不能在 production 生效。发布 compose 使用 env_file；现有 local compose 不会
自动透传新增变量，需要明确的本地覆盖配置。此 PR 不启动或更改任何部署。

## 身份与授权边界

- Auth.js 执行发现文档、state、nonce、S256 与协议 claims 检查
- signIn 回调额外用 JWKS 验证 ID token 的真实签名、精确 issuer、audience、exp、iat、
  subject、authorized party；只接受 RS256、ES256、EdDSA，不接受 HS256 或 unsigned
- 发现文档和 token 请求仅允许已配置 issuer 同源，禁止跟随重定向，设定请求超时
- 验证通过后，JWT 回调只向已鉴权的内部 `/internal/identity/rauthy-upsert` 提交身份
- 新表 `oidc_identities` 用 `(issuer, subject)` 唯一约束绑定一个新 `users.id`；
  事务级锁保护并发首次登录，业务账户与一次 `user.registered` outbox 事件同事务提交
- 新账号 `username` 是稳定 ASCII handle `rauthy_${users.id}`，用于公开资料路由和内部请求头；
  上游可变/Unicode 显示名另存 OIDC `displayName`，同名、改名都不改变 handle 或账号归属
- 邮箱与显示名只是属性，不查询同邮箱账户做合并，不赋予 Linux.do trust level、管理员
  或 Email-Native 邮件调用能力；缺失验证声明保持 false
- `UserSummary.provider=rauthy`，`providerIssuer` 是 issuer，`providerUserId` 是 subject；
  这只用于资料表达，不能当作旧 Linux.do 授权标识
- Web 会话把 OIDC 身份放在 `identitySubject` / `identityIssuer`，省略旧
  `providerUserId`，内部请求只传新的业务 `users.id`，避免裸 sub 碰撞旧管理员允许名单
- Rauthy 账号的 Platform 管理员授权必须显式使用新的 `users.id`；不导入上游角色

首页、全局登录按钮及 Loom 授权页会按配置选择登录入口。Loom 的设备持有证明、
S256、nonce、兑换与撤销合同保持原样；这个入口切换不等于修改其设备授权协议。

## 会话边界与当前限制

浏览器只获得 Auth.js 会话，不暴露上游 access token / ID token / client secret。
Rauthy 会话最长持续到 ID token 的 exp 或本地登录后 15 分钟，两者取较早值。
到期拒绝会话并需要重新登录，当前没有 refresh-token 持久化或自动刷新。
切换/关闭 Rauthy 配置或 issuer 后，不再接受已有 Rauthy 本地会话。

退出按钮只清除 Platform 本地会话；当前不执行 Rauthy 全局 SSO 注销或 back-channel logout。
在 Rauthy 禁用用户/撤销会话，不代表已发的 Platform cookie 立即失效；最长等待上述本地
会话期限。这项限制必须在部署前决定是否接受或补齐，不能宣传为即时全局撤销。

目前没有实现给 Asset 的 `principal/access_token/expires_at` 会话桥、应用专用 audience、
refresh token、Rauthy 实例启动配置或真实邮件服务。Asset 仍必须独立验证其 issuer、audience
和 JWKS；默认 EdDSA 不应导致放宽它的验签，应按客户端要求配置 RS256。

## 验证

Web focused tests（从仓库根目录）：

```sh
cd web
node --test --import tsx src/auth.test.ts src/lib/rauthy-auth.test.ts src/rauthy-callback.test.ts
```

这些测试用真实 Auth.js 处理 CSRF、发现、回调、加密会话、退出和到期，使用临时生成的
真实 RSA/EC/Ed25519 密钥。所有发现/JWKS/token/内部账户请求均由合成响应拦截，没有
真实 Rauthy、外部账号或真实凭据。涵盖错误签名/issuer/aud/nonce/exp、state、PKCE、
授权码重放、不伪造邮箱、JWT 不向浏览器泄漏 access token、裸 sub 不继承旧管理员身份。
这不是浏览器视觉测试或运行中的 Rauthy 服务器端到端验收。

账户域另有真实隔离 PostgreSQL 集成，验证唯一性、并发首登、重复登录、事务回滚、
新身份资料读取与内部路由鉴权。具体命令见账户域 package.json 的 Rauthy 集成脚本。
必须运行相关类型检查与现有回归，不得把 fixture 通过当成部署完成。

## 后续门槛

1. 独立审查与精确 PR head CI 通过后合并，仍保持配置默认关闭
2. 用获准的隔离 Rauthy 实例与合成用户完成服务器 + 浏览器端到端验收
3. 分别实现/验证应用授权、全局注销或撤销策略及实际账户界面
4. 真实管理员、客户端凭据、邮件服务、生产部署均另行获得授权

回退是关闭配置并回退代码，不删除新增身份表或用户数据；不承诺新 Rauthy 用户能用
旧 Linux.do 路径登录。现有账户邮件验证码与 console/debugCode 示例的安全债仍需独立
处理，本 PR 没有把它们自动视为生产安全或扩大到钱包等无关改动。
