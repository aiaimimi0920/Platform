# account-honor 模块迁移状态

## 当前结构

```
account-honor/
  shared/                  ✅ 已创建 — 纯展示组件（owner 和 visitor 共享）
    honor-utils.ts             工具函数（雷达图计算、格式化、选择逻辑）
    ability-board.tsx          六边形能力雷达（纯渲染）
    activity-card.tsx          活跃度热力图（纯渲染）
    agent-display.tsx          Agent 展示卡列表（纯渲染）
    project-display.tsx        项目展示 + 投资项目摘要（纯渲染）
    issue-display.tsx          议题展示 + 投资议题摘要（纯渲染）
    index.ts                   桶导出
  owner/                   ✅ 已创建 — 用户自持视图专属（编辑能力）
    index.ts                   从根文件重导出现有 owner 组件
  visitor/                 ✅ 已创建 — 游客公开视图专属（只读）
    visitor-archive.tsx        只读档案正文（组合 shared，无配置按钮）
    visitor-profile.tsx        只读档案壳层（头像/名/签名/rank + archive）
    index.ts                   桶导出
  account-honor-panel.tsx  ⚠️ 旧文件 — 1459行，展示+编辑混合
  account-honor-center.tsx ⚠️ 旧文件 — owner overlay 壳层 + tagline 编辑
  account-honor-entry.tsx  ⚠️ 旧文件 — owner 触发按钮
  adapter.ts / helper.ts / routes.ts / server.ts / types.ts — 不变
  index.ts                 ✅ 已更新 — 同时导出 shared / owner / visitor
```

## 已完成

1. ✅ 纯展示逻辑提取到 `shared/`（radar chart、heatmap、agent/project/issue display）
2. ✅ 创建 `visitor/` 只读档案组件（VisitorArchive + VisitorProfile）
3. ✅ 创建 `owner/` 重导出桶（指向根文件的现有 owner 组件）
4. ✅ 更新 `index.ts` 导出三层结构

## 待完成（后续增量迁移）

- [ ] 将 `account-honor-panel.tsx` 中的编辑状态逻辑（config dialogs、POST calls）提取到 `owner/` 独立文件
- [ ] 让 `account-honor-panel.tsx` 中的 `AccountHonorArchiveSection` 和 `AccountHonorExecutionPanel` 改为组合 `shared/` 组件 + `owner/` 编辑逻辑
- [ ] 让 `account-honor-center.tsx` 中的 tagline 编辑逻辑提取到 `owner/tagline-editor.tsx`
- [ ] 最终使 `account-honor-panel.tsx` 只剩下对 `shared/` 和 `owner/` 的组合调用

## 规则

- `shared/` 组件不依赖 session 或 auth 状态
- `shared/` 组件不包含 `if (isOwner)` 分支
- 编辑能力（POST、form、config dialog）只出现在 `owner/`
- 详见 `docs/30-product/视图、账户与用户主线.md`
