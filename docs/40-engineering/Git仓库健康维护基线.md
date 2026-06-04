# Git仓库健康维护基线

## 目的

本文档用于固定本仓库在 Windows 本地开发环境下的 Git 仓库健康处理基线，重点覆盖：

- `git gc/repack` 因内存不足失败
- `.git/objects/pack/.tmp-*.pack` 孤儿临时 pack 残留
- 仓库过大时自动维护反复触发、进一步放大不稳定性

---

## 1. 当前默认处理顺序

当本仓库出现以下症状时：

- 提交后后台自动 `gc` 失败
- `git count-objects -vH` 出现 `no corresponding .idx`
- `.git/objects/pack` 中残留 `.tmp-*.pack`
- `git gc` / `git repack` 报 `Out of memory`、`packed object ... is corrupt`

默认按以下顺序处理：

1. 先确认仓库当前是否仍有 Git 进程或 lock 文件。
2. 先在**仓库本地配置**关闭自动维护，再做对象库清理。
3. 只删除明确没有对应 `.idx` 的孤儿 `.tmp-*.pack`。
4. 删除后立即复核：
   - `git count-objects -vH`
   - 必要时 `git fsck --connectivity-only`
5. 若异常已消失，则先停止，不默认继续全量 `repack`。

---

## 2. 当前默认本地配置

当前仓库若已经出现过 `gc/repack` 内存不足或临时 pack 残留，默认先设置：

- `git config --local gc.auto 0`
- `git config --local gc.autoPackLimit 0`
- `git config --local maintenance.auto false`

目的不是永久禁用一切维护，而是先阻止 Git 在大仓库、脏工作树、浏览器 profile/runtime 产物很多的情况下继续自动触发高成本维护。

---

## 3. 当前对 `.tmp-*.pack` 的处理规则

当 `.git/objects/pack` 中出现：

- `.tmp-*.pack`
- 且 `git count-objects -vH` 明确提示 `no corresponding .idx`

默认可视为失败的 `gc/repack` 留下的孤儿临时 pack。

当前允许的处理方式是：

- 只删除这些**没有对应 `.idx` 的 `.tmp-*.pack`**

当前不允许的处理方式是：

- 直接删除正常的 `pack-*.pack`
- 直接删除正常的 `pack-*.idx`
- 在未确认异常来源前盲目清空 `.git/objects/pack`

---

## 4. 当前默认验证标准

一次低风险修复完成后，至少应满足：

- `git count-objects -vH` 不再出现 `.tmp-*.pack` 的 warning
- `garbage` 归零，或至少不再由 `.tmp-*.pack` 主导
- `git gc --auto` 不再立即复现之前的 fatal error
- 常规 `git status`、`git log`、`git fsck --connectivity-only` 可正常返回

大量 `dangling blob` 当前仍可接受，它表示历史悬挂对象较多，但不等价于仓库立即损坏。

---

## 5. 当前不默认做的动作

在完成上述止血前，当前不默认直接做：

- 全量 `git repack -Ad`
- 全量 `git gc --prune=now`
- 多轮 aggressive `fsck --full`
- 手动删除正常 pack / idx

原因是本仓库当前对象体积较大，且经常伴随：

- `.runtime/`
- `output/`
- 浏览器 profile
- 大量 gateway/runtime 产物

直接做重型维护很容易再次命中内存不足或新的 pack 异常。

---

## 6. 当前长期原则

从现在开始：

- Git 仓库健康修复优先“先止血，再评估”
- 仓库级自动维护应显式受控，不默认放任后台 `gc/repack`
- 若未来需要更彻底的 pack 合并或瘦身，应单独安排维护窗口，不在日常开发回合里顺手进行

另外，Python 运行期缓存当前统一按“仓库噪音产物”处理：

- `__pycache__/`
- `*.pyc`

都不应继续作为 tracked 文件保留在仓库中。

若发现这类文件已被历史提交带入版本控制，当前默认处理方式是：

1. 在根 `.gitignore` 中显式忽略它们
2. 使用 `git rm --cached` 把已有 tracked cache 文件从索引移除
3. 再用一轮最小 repo-level 验证确认：
   - 常规测试运行后工作树不再因为 Python bytecode 自动回写而变脏

这条规则当前尤其适用于：

- `deploy/__pycache__/`
- 回归 helper / validator 在本机运行后自动生成的 `.pyc`

因为这些文件会让“只读验证”也变成 tracked worktree 污染，削弱当前 repo-level strict 的可信度。

同样，仓库根目录和 `gateway/` 下的临时 scratch 文件当前也统一按“本机排查噪音”处理：

- `tmp-*`
- `gateway/tmp-*`

它们默认只允许作为一次性调试产物存在于本地工作树，不应继续作为 tracked 文件保留。

若发现这类文件已经被版本控制收进仓库，当前默认处理方式是：

1. 确认它们没有被正式代码、文档或脚本引用
2. 在根 `.gitignore` 中显式忽略：
   - `tmp-*`
   - `gateway/tmp-*`
3. 使用 `git rm --cached` 把历史 tracked scratch 文件从索引移除
4. 再跑一轮 repo-level strict，确认验证过程本身不会继续把这些一次性排查文件误当成正式仓库内容

这条规则当前典型适用于：

- `tmp-mailbox-*.json`
- `tmp-mission-*.json`
- `gateway/tmp-gemini-canvas-worker-input.json`

此外，`gateway/scripts/` 下若某个 helper 已经进入：

- operator 路径
- regression / fixture / live 验证路径
- 文档化的长期开发辅助路径

则它不应继续保留 `temp-*` 前缀。

当前默认要求：

1. `gateway/scripts/temp-*` 只允许作为短暂未收口草稿存在于本地工作树
2. 一旦决定把它留在仓库中，默认应直接 formalize 成稳定脚本名
3. repo-level strict 当前应把仍然 tracked 的 `gateway/scripts/temp-*` 视为仓库健康问题，而不是正常状态

同时，`gateway/scripts/` 自己派生出的脚本本地运行产物也不应进入版本控制：

- `gateway/scripts/.runtime/**`
- `gateway/scripts/output/**`

它们当前只代表：

- 脚本局部 runtime state
- 一次性 profile / storage-state 派生产物
- 脚本调试期输出捕获

而不是仓库内长期 canonical evidence。

若它们被误加入 git，当前默认处理方式是：

1. 使用 `git rm --cached -r` 从索引移除：
   - `gateway/scripts/.runtime`
   - `gateway/scripts/output`
2. 在根 `.gitignore` 中显式忽略这两棵路径
3. 再跑一轮 repo-level strict，确认 helper 正式化改动与本地运行产物边界已经重新分开

进一步地，仓库根 `.runtime/` 下的直接 scratch 文件也应与长期 evidence/object tree 区分开：

- `.runtime/*.pid`
- `.runtime/*worker-input.json`
- `.runtime/*manual-network*`
- `.runtime/local-web-port.txt`
- `.runtime/test-node-*.txt`
- `.runtime/tmp/**`

这类文件当前只代表：

- 本机 helper 进程句柄
- 一次性 worker input
- 手工网络探测草稿
- 本地预览端口状态文件
- 临时 node probe 文本输出
- runtime 下的临时镜像/拷贝工作树

不代表应长期保留在仓库中的 canonical runtime evidence。

若它们已被历史提交带入版本控制，当前默认处理方式同样是：

1. 对 **根 `.runtime/` 直接子文件** 与 `.runtime/tmp/**` 应用这条 scratch 规则
2. 在根 `.gitignore` 中显式忽略上述模式
3. 使用 `git rm --cached` 从索引移除已有 tracked root `.runtime` scratch
4. 再跑一轮 repo-level strict，确认普通 helper 运行不会继续把这些根 `.runtime` scratch 重新污染 tracked worktree

对 AI gateway 专题的长期 runtime evidence，当前还需要额外区分“最小保留证据”与“整棵浏览器 profile / user-data 树”：

- 当前允许继续 tracked 的最小集合是：
  - `.runtime/ai-gateway-objects/credential-runtime/**/storage-state.json`
  - `.runtime/ai-gateway-objects/debug/**/*.json`
  - `.runtime/ai-gateway-objects/debug/**/*.png`
- 当前不应继续 tracked 的典型路径是：
  - `.runtime/ai-gateway-objects/credential-runtime/**/user-data/**`

这类 `user-data` 树当前只代表：

- 浏览器 profile 派生缓存
- leveldb / cache / cookie / code-cache / history 等本机运行态文件

它们不属于应长期留在 git 中的最小证据面。

若历史上已经把这些路径收进仓库，当前默认处理方式是：

1. 用 whitelist 规则显式固定“允许继续 tracked 的最小集合”
2. 在根 `.gitignore` 中忽略：
   - `.runtime/ai-gateway-objects/credential-runtime/**/user-data/`
3. 使用 `git rm --cached` 将现有 tracked `user-data` 树从索引移除
4. 再跑 repo-level strict，确认只剩 `storage-state.json` 与 `debug` 证据继续 tracked

根 `output/` 当前也默认按“本地证据归档目录”处理，而不是长期 git tracked 内容：

- `output/` 中允许继续保留本地：
  - focused / fixture / live summary
  - request / response / result dumps
  - screenshot / playwright captures
- 但这些归档默认属于：
  - 本机验收证据
  - rerun 对照材料
  - 运行后产物

它们不应默认继续进入 git tracked set。

若历史上已经把根 `output/**` 带入版本控制，当前默认处理方式是：

1. 在根 `.gitignore` 中忽略：
   - `output/`
2. 使用 `git rm --cached -r output` 将现有 tracked root output 归档从索引移除
3. 保留本地目录与证据文件本体，不做工作树物理删除
4. 再跑 repo-level strict，确认 tracked worktree 不再被 root `output/**` 污染

本地浏览器自动化与测试运行状态目录同样不应长期进入 git：

- `.playwright-cli/**`
- `test-results/**`

这类目录当前只代表：

- 本机 browser-use / playwright cli 截图与页面快照
- 本地测试运行器的最近一次执行状态

若历史上已经被带入版本控制，当前默认处理方式是：

1. 在根 `.gitignore` 中忽略：
   - `.playwright-cli/`
   - `test-results/`
2. 使用 `git rm --cached -r .playwright-cli test-results` 将其从索引移除
3. 保留本地目录与运行快照本体，不做工作树物理删除
4. 再跑 repo-level strict，确认这类本地自动化产物不再污染 tracked worktree

另外，当前仓库本地还可能出现一批仅供 agent/browser 调试使用的辅助目录与输入快照：

- `.codex-preview/**`
- `.codex/preview-logs/**`
- `.playwright-mcp/**`
- `.input.json`

它们当前只代表：

- 本地预览 helper 日志
- browser/mcp bridge 调试输出
- 一次性执行输入快照

这类文件默认也不应进入 git tracked set。当前默认做法是：

1. 在根 `.gitignore` 中显式忽略这些路径
2. 若曾被误提交，则使用 `git rm --cached` 将它们从索引移除
3. 将这类路径视为“本地工具现场”，而不是仓库 canonical artifact

进一步地，根 `.runtime/` 当前默认也按“本地运行现场目录”处理：

- 未显式进入 whitelist 的 `.runtime/**` 内容
- 默认都不应继续作为 untracked 噪音频繁出现在日常 `git status`

因此当前默认策略是：

1. 根 `.gitignore` 用 `.runtime/**` 作为 deny-by-default 本地忽略
2. tracked 层真正允许长期存在的内容，仍由 repo-level strict 白名单定义
3. 若需要新增新的长期 `.runtime` 证据，应先更新 whitelist 规则，再显式决定是否纳入版本控制

同样地，`gateway/` 子树下也会持续产出一批仅供本机 Rust/browser 调试使用的本地运行目录：

- `gateway/.linux-target/**`
- `gateway/.runtime/**`
- `gateway/gateway/.runtime/**`
- `gateway/*.log`

它们当前只代表：

- 本机 Linux target 构建输出
- gateway browser/runtime pool 本地现场
- 误落在嵌套目录下的 gateway 运行态 scratch
- 本地直接启动 gateway 时的 stdout/stderr/debug 日志

因此当前默认做法也是：

1. 在根 `.gitignore` 中忽略这些路径
2. 若曾被误提交，则使用 `git rm --cached` 将它们从索引移除
3. 将这类路径视为“gateway 本机运行现场”，而不是仓库 canonical artifact

仓库根目录下另外两类常见的个人审计材料也按同样方式处理：

- CURRENT_MAIN_REPO.md（本地状态笔记）
- `*-console-login-required.png`

它们当前只代表：

- 本机主仓状态备忘
- 某次 console/login gate 现场截图

因此默认也应：

1. 留在本地工作树
2. 不进入 git tracked set
3. 不被误读成正式产品/工程文档或 canonical evidence

另外，`gateway/` 子树下还可能残留两类“看起来像正式内容、但当前不应直接回流进 git”的本地稿件：

- gateway/FREEBUFF_REFRESH_PRINCIPLES.md（gateway-root 本地草稿来源）
- `gateway/src/protocol/accio.rs`

当前默认理解是：

- gateway/FREEBUFF_REFRESH_PRINCIPLES.md（gateway-root 本地草稿来源）
  - 只是 gateway-root 本地草稿来源
  - 正式长期 owner 应迁到：
    - `docs/20-ai-gateway/AI网关FreeBuff兼容Provider接入基线.md`
- `gateway/src/protocol/accio.rs`
  - 只是目录重构后的历史 local duplicate
  - 当前正式 protocol owner 是：
    - `gateway/src/protocol/accio/line.rs`

因此这两条路径默认也应：

1. 留在本地时仅作为草稿/残留现场看待
2. 不直接进入 git tracked set
3. 需要正式保留时，先迁到 canonical docs 或 canonical module owner，再纳入版本控制

对长期 tracked 的 helper/source 文件，当前还要额外避免一类隐蔽漂移：

- 把当前仓库根目录硬编码成绝对路径写进：
  - `deploy/*.py`
  - `deploy/*.ps1`
  - `gateway/scripts/*.mjs`

同工作区下的 sibling 机器路径（例如 `.../GameEditor/linshi/...`）当前也按同类问题处理。

这类路径当前默认应通过：

- `REPO_ROOT` 相对解析
- runtime discovery
- 或显式 env override

来解决，而不是把当前机器上的仓库绝对路径继续写死进源码。

对 Gemini Canvas 一类 runtime/profile helper，当前还要额外避免另一类“时间戳默认值漂移”：

- `host-export-YYYYMMDD`
- `manual-live-vendor-YYYYMMDD`
- `manual-live-vendor-YYYYMMDD-profile`
- `manual-test-YYYYMMDD`
- `live-probe-YYYYMMDD`

这类默认值当前应优先收口成：

- generic canonical 名
  - 例如 `host-export`、`manual-live-vendor-profile`
- 再在本地运行时按 `LastWriteTime` 或其他明确规则回退到 latest dated 目录

不要继续把某次人工试验目录名长期写死在 tracked helper/source 文件里。

同样地，tracked 配置文件里的 `runtime_state_object_key` / `runtimeStateObjectKey` 也应优先指向：

- 稳定 canonical object key
  - 例如 `credential-runtime/udio/manual-browser-helper/storage-state.json`
  - 或 `credential-runtime/gemini-canvas/host-export/storage-state.json`

而不是继续指向：

- `manual-test-YYYYMMDD`
- `host-export-YYYYMMDD`

这类一次性人工导出目录。

---

## 7. 当前远端分支无共同祖先时的发布基线

当某条本地 feature branch 需要发布到远端，但出现以下现象时：

- `git merge-base HEAD origin/<target-branch>` 返回空
- `git push` 看起来像是在推“小分支”，实际却长时间卡在 `pack-objects`
- 本地 feature 只改了很少几个提交，但相对远端却表现为“整段历史都要发送”

默认先按“远端目标分支与当前本地主线**没有共同祖先**”处理。

当前默认验证顺序：

1. 先显式拉取目标远端分支：
   - `git fetch origin <target-branch> --no-tags`
2. 再检查：
   - `git merge-base HEAD origin/<target-branch>`
   - `git rev-list --left-right --count origin/<target-branch>...HEAD`
3. 若 `merge-base` 为空，则不要再把当前问题理解成“只差推送最近几个提交”。

当前默认动作：

- 不默认反复盲推同一条 branch
- 不默认把 pack 超时、`Out of memory`、或远端断开，简单归因成单次网络波动
- 先确认当前要发布的是：
  - 真正的小 feature 增量
  - 还是一整段本地历史

若需要判断“能否只发布当前专题补丁，而不是整段历史”，当前推荐低风险做法是：

1. 先导出 patchset 或其他本地备份
2. 在临时 worktree 上，以 `origin/<target-branch>` 为基线测试：
   - `git am --3way <patches>`
3. 若大面积出现：
   - `modify/delete`
   - 目录缺失
   - 基础文件根本不存在

则应认定：

- 当前远端不具备承接该专题补丁的基础代码面
- 不能再把它当成“轻量 cherry-pick / patch replay”问题

在这种情况下，当前推荐先做：

- 保留本地 checkpoint commit
- 保留本地 patchset / 证据归档
- 再单独评估远端历史同步策略

而不是在日常开发回合里持续盲推、持续重试大 pack。

---

## 8. 当前大历史发布受阻时的 bundle 导出基线

当出现下面这种组合症状时：

- 直接 `git push` 长时间卡在 `pack-objects`
- 默认 `git bundle create` 也报：
  - `Out of memory`
  - `packed object ... is corrupt`
- 但本地对象库经过基础检查后，并没有发现新的 `.tmp-*.pack` 孤儿残留

当前允许把“导出一份完整 branch bundle”当作低风险旁路。

当前已验证可行的方式是：

- 使用较新的 Git for Windows，而不是仅依赖 SourceTree 自带 Git
- 同时显式收紧 pack 参数：
  - `pack.window=0`
  - `pack.depth=0`
  - `pack.threads=1`
  - `pack.windowMemory=16m`
  - `core.compression=1`

示例：

```powershell
较新的 Git for Windows 可执行文件（例如 `scoop/shims/git.exe`） `
  -C <repo> `
  -c pack.window=0 `
  -c pack.depth=0 `
  -c pack.threads=1 `
  -c pack.windowMemory=16m `
  -c core.compression=1 `
  bundle create <bundle-path> <ref>
```

创建完成后，默认立即执行：

```powershell
<newer-git.exe> -C <repo> bundle verify <bundle-path>
```

若这份 `.bundle` 准备用作当前 feature branch 的高保真转运件，当前推荐再做一轮一次性导入验证：

1. 新建临时 bare repo
2. `git fetch <bundle> <ref>:<ref>`
3. 比较导入后的 ref head 与源 branch head 是否一致

这样可以证明：

- `.bundle` 本身不只是“结构上可验证”
- 它也能在一个干净目标仓中真正恢复出预期分支 head

当前原则：

- `.bundle` 是发布受阻时的高保真转运件
- 它不能替代最终远端分支发布
- 但在远端历史错位或本机默认 git push 路径不稳定时，它优于只保留聊天结论
- 若实际 `git push` 在较新的 Git + 保守 pack 参数下仍长时间卡在 `send-pack / pack-objects`，且远端 ref 迟迟没有出现，当前默认优先停止长时间悬挂的 push 进程，保留已验证的 `.bundle`，不要无限等待
- 若已从 `.bundle` 成功恢复出一个最小 bare source repo，而从该 bare repo 再推远端仍返回 `HTTP 500` / remote disconnect，当前默认把它视为远端侧发布阻塞，而不是继续怀疑本地 branch 内容或 bundle 结构

---

## 9. 当前 patchset 转运与验证基线

当最新专题分支已经生成 patchset，但：

- 最新 `.bundle` 仍然落后于当前 head
- 或继续导出新的 `.bundle` 又重新卡在：
  - `upload-pack`
  - `pack-objects`

当前允许把 **最新 patchset** 当作当前 head 的正式转运件之一。

### 9.1 当前默认 patchset 验证路径

若只是验证“当前 patchset 能否在 base 上正确重放”，当前默认优先使用：

- **同仓 detached worktree**

而不是：

- 新建 fresh temp repo 后再 `git fetch source <base>`

原因是后者在大仓库上很容易重新触发：

- `upload-pack`
- `pack-objects`

从而把 patchset 验证问题退化回对象传输问题。

当前推荐顺序：

1. 取出 patchset README 中记录的：
   - `base commit`
   - `branch head`
2. 在同一仓库上创建一次性 detached worktree：
   - `git worktree add --detach <temp> <base>`
3. 在该 worktree 中顺序执行：
   - `git am --3way <patches>`
4. 验证完成后删除该临时 worktree

### 9.2 当前正确的 patchset 成功判据

patchset 通过 `git am` 重放后，**不得**直接拿：

- 重放后的 `HEAD commit hash`

与源 branch head 的 commit hash 做相等判断。

原因是：

- patchset replay 会生成新的 commit object
- commit id 通常天然不同

当前正式成功判据应至少满足：

1. `HEAD^{tree}` 一致
2. patch 数量与源提交数量一致
3. commit subject 序列一致

也就是优先比较：

- `git rev-parse HEAD^{tree}`

而不是只比较：

- `git rev-parse HEAD`

若：

- tree hash 一致
- subject sequence 一致

则应认定：

- patchset 已经在语义上正确重放出当前分支 head 对应的最终树状态

即使 commit hash 本身不同，也不应误判为失败。

### 9.3 当前 latest current bundle 的 synthetic 旁路

当出现下面这种情况时：

- 最新 patchset 已经通过：
  - 同仓 detached worktree
  - `git am --3way`
  验证
- 但仍然无法从原始大仓库继续刷新一个“对齐当前 head”的 full-history `.bundle`
- 失败点继续停留在：
  - `upload-pack`
  - `pack-objects`

当前允许使用一条 **synthetic current bundle** 旁路：

1. 从 source repo 的 `base commit` 导出 base tree
2. 在**短绝对路径**下新建一个小 repo，例如：
   - `C:\t\<task>`
3. 在该小 repo 中：
   - 先提交一条 base snapshot commit
   - 再顺序 `git am --3way <verified patchset>`
4. 从该 synthetic repo 导出新的 `.bundle`
5. 再做：
   - `git bundle verify`
   - 一次性 bare repo `git fetch <bundle> <ref>:<ref>`

当前选择短路径的原因是：

- 即使 synthetic repo 不再依赖原始大仓库对象传输，
- 仍可能在 Windows 上命中：
  - `Filename too long`

因此当前 synthetic repo 默认优先使用：

- `C:\t\...`

并显式设置：

- `git config core.longpaths true`

### 9.4 当前 synthetic bundle 的正确成功判据

synthetic bundle 当前不要求：

- synthetic repo head commit hash 与 source branch head commit hash 相同

因为 synthetic repo 的 base snapshot commit 是本地重建的，commit 历史天然不同。

当前正式成功判据应至少满足：

1. source branch `HEAD^{tree}` 与 synthetic repo `HEAD^{tree}` 一致
2. synthetic bundle `git bundle verify` 通过
3. 一次性 bare repo 从该 bundle `git fetch` 后，取回的 ref head 与 synthetic repo head 一致

若以上三点同时成立，则应认定：

- 这份 synthetic current bundle 已经对 source branch 当前 head 具备可接受的高保真转运语义

它的信任链当前应写明为：

- `source branch tree`
- `verified patchset`
- `synthetic repo tree`
- `bundle roundtrip synthetic head`

而不是误写成：

- “与 source branch head commit hash 完全相同”
