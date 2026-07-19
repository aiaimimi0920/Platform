# Platform 产品完成任务分解

详细步骤以 [implementation plan](../superpowers/plans/2026-07-18-platform-product-completion.md) 为准；本文件是跨会话索引。

| ID | 阶段 | 等级 | 依赖 | 并行 lane | 主要输出 | 完成证据 |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | 验收门禁 | P0 | P0-D05 | A | manifest/runner/skip-fail | `.runtime/acceptance/<run-id>/acceptance-manifest.json` |
| P1-02 | 隔离 Compose | P0 | P1-01 | B | isolated compose/doubles/cleanup | Compose config + startup log |
| P1-03 | readiness/auth | P0 | P1-01 | C | ready semantics/dev-auth guard | focused test reports |
| P1-04 | strict entry/debt | P0 | P1-01,P1-02,P1-03 | A | smoke bridge/debt green | acceptance manifest |
| P2-01 | heavy persistence | P0 | P1-04 | D | contracts/migration/repository | Core integration report |
| P2-02 | heavy service | P0 | P2-01 | D | managed_heavy/service | Core test report |
| P2-03 | Gateway execution | P0 | P2-02 | D | server-side stream/retry | boundary evidence |
| P2-04 | Web API/state | P0 | P2-03 | E | real chat UI persistence | Web test report |
| P2-05 | actions | P0 | P2-04 | E | task/mailbox bridges | DB/API evidence |
| P3-01 | dependency envelope | P1 | P1-04 | F | truthful state primitives | component tests |
| P3-02 | fallback removal | P1 | P3-01 | F | no fake empty/demo | route tests |
| P3-03 | direct surfaces | P1 | P3-01 | G | mailbox/benefits/arbitration | journey tests |
| P3-04 | slot controls | P1 | P2-02,P3-01 | E | functional heavy controls | component/API tests |
| P4-01 | economy invariants | P1 | P1-04 | H | identity/wallet/commerce/task tests | DB integration |
| P4-02 | governance/executor | P1 | P1-04 | I | agent/mailbox/governance/executor tests | workspace tests |
| P4-03 | integration/OAuth | P1 | P1-02,P1-03,P4-01 | H | required fixture/contract | manifest |
| P4-04 | observability | P1 | P3-01,P3-02,P4-02,P4-03 | I | correlation/redaction | redaction scan |
| P5-01 | K8s | P0 | P4-03,P4-04 | J | first-deploy manifests | kustomize output |
| P5-02 | OpenTofu | P1 | P5-01 | J | portable infra validation | tofu validate |
| P5-03 | release build | P0 | P1-04,P5-01 | K | complete release bundle | release manifest |
| P5-04 | release smoke | P0 | P5-03 | K | artifact-only runtime | smoke evidence |
| P6-01 | Owner/Visitor E2E | P0 | P2-05,P3-03,P4-03 | L | six browser journeys | Playwright report |
| P6-02 | Operator/errors E2E | P0 | P3-02,P4-04 | L | operator/error journeys | Playwright report |
| P6-03 | matrix | P0 | P6-01,P6-02,P5-04 | M | required/live classification | final manifest |
| P6-04 | signoff | P0 | P6-03 | M | release + P2 register | signed acceptance |

Parallel lanes are only advisory until the task's dependency row is green. Tasks sharing a migration, Compose file, `package.json`, or progress file must be merged sequentially and tested after each merge.
