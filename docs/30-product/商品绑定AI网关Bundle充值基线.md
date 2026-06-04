# 商品绑定 AI 网关 Bundle 充值基线

## 目的

本文档用于接住旧 `商品绑定AI网关Bundle充值基线.md` 中与产品主线直接相关的长期结论。

---

## 1. 当前正式定位

`商品绑定 AI 网关 Bundle` 当前不只是某个网关侧技巧。

它在产品上代表：

- 商品/订单/权益系统
- 与 AI Gateway 访问能力
- 之间的一条正式绑定链

---

## 2. 当前正式理解

当用户购买带有 AI Gateway bundle 的商品后，平台需要能够正确完成：

1. 商品/订单侧确权
2. 绑定到对应 bundle / access projection
3. 让用户在网关侧获得相应访问能力
4. 支持后续回退、重算、资格修复

因此它同时触达：

- 商品与权益主线
- AI Gateway access/projection 主线

---

## 3. 文档边界

本文只负责产品与资格语义。

若需要理解：

- AccessKey / projection / route

应再看：

- `docs/20-ai-gateway/统一AccessKey与客户端接入基线.md`

若需要理解：

- 商品、订单、item、权益发放

应再看：

- `商品、资产与权益总线.md`

---

## 4. 当前旧来源

本文当前主要吸收：

- `legacy source: 商品绑定AI网关Bundle充值基线.md`

---

## 5. 当前正式结论

从现在开始：

- bundle 充值有新的 canonical 专题
- 它默认按“商品权益主线 + 网关访问主线”双边理解
- 旧 bundle 充值文档默认退为参考层
