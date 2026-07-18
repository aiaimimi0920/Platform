# docs 文档主入口

`docs/` 是当前仓库新的**权威开发文档树**。

建立它的原因很直接：

- 旧 `docs/` 中长期混放了：
  - 平台总基线
  - provider 专题
  - 设计草案
  - 分析文档
  - 进度文档
  - 阶段性实施总结
- 这些文档来源不同、时期不同、owner 不同，导致：
  - 同一主题有多份“基线”
  - 旧结论和新结论并存
  - 分析/进度文档被误读成长期正式规则

因此当前正式规则改成：

1. `rules/` 继续是**最高优先级的仓库级守则**
2. `docs/` 是**当前正式开发文档主树**
3. `docs/50-history/` 负责承接历史分析、计划与施工记录
4. 若历史归档与 canonical `docs/` 冲突：
   - **以 `docs/` 为准**

---

## 当前阅读顺序

建议后续 AI / 开发者按下面顺序阅读：

1. `../AGENTS.md`
2. `../rules/`
3. `docs/README.md`
4. `docs/00-governance/文档权威与生命周期基线.md`
5. `docs/10-platform/README.md`
6. `docs/10-platform/NeuroLoom平台总基线.md`
7. `docs/20-ai-gateway/README.md`
8. `docs/20-ai-gateway/AI网关总基线.md`
9. `docs/20-ai-gateway/AI网关服务商建模与凭证体系.md`
10. `docs/30-product/README.md`
11. `docs/30-product/账户与产品总基线.md`
12. `docs/40-engineering/开发流程与文档更新机制.md`
13. `docs/40-engineering/Platform产品完成与验收基线.md`
14. `docs/superpowers/plans/2026-07-18-platform-product-completion.md`
15. `docs/plan/task-breakdown.md`
16. `docs/progress/MASTER.md`
17. `docs/50-history/README.md`

---

## 当前目录结构

```text
docs/
  README.md
  00-governance/
  10-platform/
  20-ai-gateway/
  30-product/
  40-engineering/
  plan/
  progress/
  superpowers/plans/
  50-history/
```

### 00-governance

回答：

- 哪些文档是正式规则
- 新旧文档冲突时怎么处理
- 文档生命周期如何划分

### 10-platform

回答：

- `NeuroLoom` 平台到底是什么
- 架构、部署、视图、运行单元的当前正式结论是什么

### 20-ai-gateway

回答：

- Rust `gateway` 的正式 owner 边界
- provider / implementation line / surface / credential 的正式建模
- AI 网关当前应如何理解

### 30-product

回答：

- 账户、产品、钱包、任务、Agent、公开档案、运营视图等产品主线的正式边界

### 40-engineering

回答：

- 开发流程
- 文档更新机制
- 工程协作与历史收口规范
- Platform 产品完成定义、验收门禁与 release 签收标准

### 50-history

回答：

- `analysis / plan / progress` 这类历史过程文档现在如何归档
- 哪些过程材料仍值得保留
- 它们当前对应哪条 canonical 主线

---

## 当前重建方法

这次重建不再按“把 200 多份旧文档一份份搬过来”推进，而是按下面的方法做：

1. 先识别上位主题
2. 建新的 canonical 文档
3. 把历史专题中相近、冲突、重复的内容归并进去
4. 对过程型文档只做：
   - 归档
   - 索引
   - 历史说明

这意味着：

- `docs/` 优先追求**少而稳**
- 不是再复制出第二套 200 多份文档

---

## 当前边界

当前 `docs/` 已经开始承接：

- 平台总基线
- AI 网关总基线
- 服务商与凭证体系
- 账户与产品总基线
- 文档治理与开发流程
- 历史过程文档的统一归档入口

因此当前正式策略是：

- 开发与新结论以 `docs/` 为准
- 过程与历史材料统一回收到 `docs/50-history/`

---

## 当前盘点结论

历史结构曾经暴露出的主要问题不是“文档不够”，而是：

- 缺 canonical hierarchy
- 缺 lifecycle boundary
- 缺冲突优先级

`docs/` 的任务就是解决这三件事。
