# Loom 设备登录与账号边界

Loom 是本机统一账号入口，继续使用 Platform 的 Linux.do 主账号身份。
本功能没有新增账号来源。Hook 复用本机 Loom，不持有中心登录私钥。

授权链路：Loom 生成 PKCE 与设备密钥 → 系统浏览器打开 `/loom/authorize` →
现有网页登录 → 用户核对账号、设备与校验码后确认 → Loom 以 verifier 和设备
签名交换唯一设备会话。浏览器账号变更后必须重新确认，重复交换不会注册第二台设备。

账户业务 owner 是 `packages/account-domain/src/modules/loom-account`；
`services/account-api` 只装配 internal 路由。Web 的
`/api/loom/account/{exchange,status,revoke}` 是受限 BFF，不接收客户端传入的
账户身份头或内部服务 token。批准接口仅通过已登录 Web server action 调用。

状态存储复用账户域 Redis/Valkey，并使用有期限的原子转换。每账号最多 8 个未
过期授权请求、16 个设备会话；请求有效期 10 分钟，设备授权 30 天。设备签名
绑定用途、时间和一次性 nonce，每设备每分钟最多接受 60 次证明请求。
服务重启可从共享 Redis 恢复；Redis 状态丢失后必须重新登录，不回退到信任缓存。

退出登录会撤销设备会话。Loom 离线退出时清除本机凭据并提示中心记录尚未删除；
中心记录到期后清理。[二维码投射中心协调](Loom二维码投射中心协调.md)已接入
独立用途的设备签名证明与授权撤销检查；本机跨网图像通道尚未实现，不能把登录
或中心接口通过计为直连、NAT 穿透或中继验收通过。

协议与签名字节定义见 Neuro 工作区内
`Loom/protocol/ACCOUNT_LOGIN.md`。Platform 独立仓库的 TypeScript 合同位于
`packages/contracts/src/loom-account.ts`，校验及签名代码位于账户业务模块。

聚焦验证入口：

```powershell
npm run test:integration:loom-account --workspace @neuro/account-domain
```

该命令创建仅绑定 loopback 随机端口的临时 Redis 容器，运行真实原子存储与设备
签名测试及 Web BFF 测试，最后只删除自己创建的容器，不访问本地开发数据库。
该入口已加入账户域常规 integration 测试。Neuro Windows 工作区还可以指定
候选 daemon，复用 Loom 隔离进程夹具执行原生互通检查：

```powershell
node scripts/testing/run-loom-account.mjs --daemon ..\release\Loom\qr-projection-20260924.3\runtime\loom-daemon.exe
```

原生互通覆盖 BFF handler、账号服务、专用 Redis 和两个真实 Loom 进程；批准
使用夹具账号，不代替完整账号 API / Web / Linux.do 授权验收。结果写入
`output/loom-account`，仅包含检查名、候选摘要及进程 ID；临时凭据与进程自动清理。
Linux.do 真实授权、Platform 正式发布及真实双机联网分别保留独立验收。
