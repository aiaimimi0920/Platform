# Loom 二维码投射中心协调

状态：中心服务与隔离 Redis / BFF 自动化已实现；Loom 本机投射 v2、Hook 接线、
Iroh 传输及公网部署尚未完成。登录继续使用 Loom 的设备签名会话，主账号仍由
Platform 的 Linux.do 身份体系提供。

## 职责与入口

`packages/account-domain/src/modules/loom-projection` 维护同账号设备之间的邀请、
接收端绑定、版本摘要与短期网络地址。`loom-account` 负责认证设备及会话撤销；
它提供会话比较条件，让投射记录与授权状态在一次 Redis 事务中检查。

Web 的 `POST /api/loom/projections` 只转发到 account-api 的
`POST /internal/loom-projections`。后者要求内部服务认证及 `identity` 能力开启。
Web 不转发调用方 cookie、用户身份头、Authorization 或内部 token；Loom 在
body 中携带设备签名证明。Hook 只调用本机 Loom，不持有中心账户私钥。

中心只保存正式图像的摘要、尺寸和字节数。后续图像通道由 Loom 负责，使用
Iroh 的经过设备密钥认证的 QUIC 直连或加密中继。中心接口通过不能证明该图像
通道已经可用。

## 协议与状态

共享合同位于 `packages/contracts/src/loom-projection.ts`；独立于旧共享 Loom
服务的 `neuro.qr-projection.v1`。v2 二维码包含受信任中心 origin、投射 ID、
来源设备 / 公钥 / 账号 / 源会话 / Unit、初始 revision、内容类型 / 摘要、
到期时间、nonce 及 Ed25519 签名，不包含私钥、cookie 或图像。

设备请求的 `payload` 是原始 JSON 字符串。签名使用下列 UTF-8 字节，以 LF
分隔且无末尾 LF；摘要针对原始字符串，不能先解析、重排 JSON 后再计算：

```text
neuro.loom-account.v1
projection
<deviceId>
<timestampMs>
<nonce>
<lowercase SHA-256 of exact payload UTF-8 bytes>
```

操作包括 `configuration / create / inspect / accept / publish / read / unlink /
sync / peer`。完整字段和二维码签名字节顺序见工作区
`Loom/protocol/QR_PROJECTION_V2.md`；实现的校验和签名函数位于本模块 `model.ts`。

邀请有效期五分钟，初始版本为 1。`accept` 原子绑定一个接收设备及本地 Unit，
并核对用户确认的版本与摘要。相同接收设备、Unit 和确认版本可恢复成功响应，
包括邀请过期、来源更新后的重试。其他接收目标返回冲突。

来源每次发布必须提供同一源会话及连续版本。相同版本、摘要、尺寸、字节数的
重试可恢复成功响应；冲突不可覆盖原记录。`unlink` 保留停止状态，旧二维码
不能重新启用。对端撤销后，仍有效的一端可以完成清理。

`sync` 登记调用方的网络地址并返回其投射关系。A 在 B 接受后取得 B 的设备
身份和当前地址。未接受前，B 持有正确二维码且属于同账号时可取得 A 的预览
地址。接收连接时，来源必须将实际 QUIC TLS 对端公钥传入 `peer` 再授权图像
传输，不能使用数据流内自报的身份。

## 边界与部署配置

- 投射证明每设备每分钟 240 次，与账号状态 / 退出的 60 次预算分开；nonce
  防重放状态共享，时间偏差最大 60 秒。
- 每账号最多 64 条未过期记录，包含停止记录；记录最晚在来源设备的 30 天
  会话到期时清理。频繁创建 / 解绑不能绕过容量限制。
- 请求正文最多 16 KiB，其中 `payload` 最多 12 KiB。同步响应的本机读取上限
  为 256 KiB。图像元数据沿用 4 MiB、单边 8192、总像素 16,777,216 的限制。
- 每设备最多一个 presence，45 秒过期，每 15 秒更新；最多 8 个 IP / 端口。
  地址必须绑定本人公钥；不接受任意主机名、组播或未配置的中继。
- 传输授权租约最多 30 秒，且不能越过设备 / 邀请到期时间；本机传输必须在
  租约到期后停止使用旧授权。
- 不可用、已停止或已撤销的视图必须返回 `authorizedUntilMs: 0` 和 `peer: null`，
  避免客户端时钟略慢时将撤销响应误判为仍授予租约的无效响应。
- `401 device_session_unavailable` 表示调用方自己需要重新授权；
  `409 projection_peer_unavailable` 只影响相应投射，不应退出仍有效的本机账号。

account-api 的策略变量：

| 变量 | 规则 |
| --- | --- |
| `LOOM_PROJECTION_PUBLIC_ORIGIN` | 与 Loom 登录配置一致的规范 HTTPS origin；仅隔离开发允许 loopback HTTP |
| `LOOM_PROJECTION_RELAY_URLS` | JSON 字符串数组，最多 4 个以 `/` 结尾的规范 HTTPS relay origin；默认空数组 |

尚未选定或部署实际公网入口。缺少有效 origin 时返回
`503 projection_not_configured`；空中继列表仅支持后续直连开发，不承诺跨 NAT。
Redis / Valkey 必须与账号会话使用相同实例，以执行跨状态原子检查。状态丢失
后重新登录与配对，不信任客户端缓存来重建中心授权。

## 验证

运行 `npm run test:integration:loom-account --workspace @neuro/account-domain`。
该入口包含账号及投射的真实签名 / Redis 状态机、并发接受、版本冲突、重启、
撤销与原子写入竞争、地址到期、TLS 公钥授权、额度、BFF 字节预算及错误映射。
测试创建并清理随机 loopback 端口的专用 Redis 容器。

这组检查不运行真实 Linux.do OAuth、完整 account-api / Web 部署或两个原生
Loom 的图像通道。后续仍须按根计划完成 Windows 双机、NAT、受限 UDP、中继、
退出清理和最终 release 验收。
