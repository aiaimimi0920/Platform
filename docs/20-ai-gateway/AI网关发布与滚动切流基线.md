# AI 网关发布与滚动切流基线

## 目的

本文档用于承接历史 Rust gateway 无停机发布与滚动切流基线的长期正式结论。

---

## 1. 当前正式发布主线

Rust `gateway` 的正式无停机发布主线仍然是：

1. `splitter` 拉起新的 `worker`
2. 新请求切到新 `worker`
3. 老 `worker` 只排空旧请求
4. 排空后退出

当前不应把：

- 直接重启单实例
- 运行中热改 Rust 主进程

视为正式发布基线。

---

## 2. 当前正式 helper

当前正式无停机发布 helper 仍包括：

- `deploy/build-gateway-binary.sh`
- `deploy/reload-gateway-splitter.sh`
- `deploy/release-gateway.sh`

更外层的镜像/集群 helper 可继续存在，但不得替代上述主链。

---

## 3. 当前边界

本文只负责：

- Rust gateway 发布与切流主线

不负责：

- provider 业务能力说明
- 协议矩阵说明
- access key 语义

---

## 4. 当前旧来源

本文当前主要吸收：

- `legacy source: AI网关Rust滚动发布与无停机Provider上线基线.md`

---

## 5. 当前正式结论

从现在开始：

- AI Gateway 发布与滚动切流已有新的 canonical 专题
- 后续若更新正式发布基线，应优先更新本文和 `AGENTS.md`
