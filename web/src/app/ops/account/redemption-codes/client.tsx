"use client";

import { useState, useMemo } from "react";
import type { RedemptionCodeView, RedemptionCodeUsageView, ProductOperatorView } from "@neuro/contracts";

import {
  createRedemptionCodeAction,
  updateRedemptionCodeAction,
  toggleRedemptionCodeAction,
  generateBatchAction,
} from "./actions";

type Props = {
  codes: RedemptionCodeView[];
  usages: RedemptionCodeUsageView[];
  usagesCodeId: string | null;
  editCodeId: string | null;
  status: "success" | "error" | null;
  message: string | null;
  loadError: string | null;
  products: ProductOperatorView[];
};

const CURRENCY_OPTIONS = [
  { value: "obsidian", label: "黑曜石 (obsidian)" },
  { value: "mira", label: "MIRA" },
  { value: "opinionTickets", label: "投票券 (opinionTickets)" },
] as const;

type RewardRow = { kind: "walletGrant" | "itemGrant"; currency: string; amount: string; productId: string };

const EMPTY_REWARD: RewardRow = { kind: "walletGrant", currency: "obsidian", amount: "20", productId: "" };
const PAGE_SIZE = 20;

// ─── Helpers ───

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN");
}

function formatTimeWindow(code: RedemptionCodeView) {
  const start = code.startsAt ? new Date(code.startsAt).toLocaleDateString("zh-CN") : null;
  const end = code.expiresAt ? new Date(code.expiresAt).toLocaleDateString("zh-CN") : null;
  if (start && end) return `${start} ~ ${end}`;
  if (start) return `${start} 起`;
  if (end) return `${end} 止`;
  return "永久";
}

function rewardsSummary(code: RedemptionCodeView) {
  if (code.rewards.length === 0) {
    if (code.rewardKind === "walletGrant") return `${code.amount ?? 0} ${code.currency ?? ""}`;
    return `物品 ${code.productId ?? ""}`;
  }
  return code.rewards
    .map((r) => (r.kind === "walletGrant" ? `${r.amount} ${r.currency}` : `物品 ${r.productId}`))
    .join(" + ");
}

function eligibilitySummary(code: RedemptionCodeView) {
  if (!code.eligibility) return "全部用户";
  const parts: string[] = [];
  if (code.eligibility.minTrustLevel != null) parts.push(`信任≥${code.eligibility.minTrustLevel}`);
  if (code.eligibility.userIds?.length) parts.push(`${code.eligibility.userIds.length}人限定`);
  return parts.join(", ") || "全部用户";
}

function statusLabel(code: RedemptionCodeView) {
  const now = Date.now();
  if (!code.active) return "stopped";
  if (code.startsAt && new Date(code.startsAt).getTime() > now) return "scheduled";
  if (code.expiresAt && new Date(code.expiresAt).getTime() < now) return "expired";
  if (code.usedCount >= code.maxUses) return "exhausted";
  return "active";
}

function statusDotClass(s: string) {
  if (s === "active") return "ops-status-dot--active";
  if (s === "scheduled") return "ops-status-dot--scheduled";
  return "ops-status-dot--inactive";
}

const STATUS_CN: Record<string, string> = {
  active: "启用中", scheduled: "待开放", stopped: "已停用", expired: "已过期", exhausted: "已用完",
};

type BatchGroup = {
  label: string;
  codes: RedemptionCodeView[];
  totalUses: number;
  totalMax: number;
};

function groupByBatch(codes: RedemptionCodeView[]): { groups: BatchGroup[]; ungrouped: RedemptionCodeView[] } {
  const map = new Map<string, RedemptionCodeView[]>();
  const ungrouped: RedemptionCodeView[] = [];

  for (const code of codes) {
    if (code.batchLabel) {
      const list = map.get(code.batchLabel) || [];
      list.push(code);
      map.set(code.batchLabel, list);
    } else {
      ungrouped.push(code);
    }
  }

  const groups: BatchGroup[] = [];
  for (const [label, list] of map) {
    groups.push({
      label,
      codes: list,
      totalUses: list.reduce((s, c) => s + c.usedCount, 0),
      totalMax: list.reduce((s, c) => s + c.maxUses, 0),
    });
  }

  return { groups, ungrouped };
}

// ─── Reward Row Editor ───

function ProductCombo({
  value,
  onChange,
  products,
}: {
  value: string;
  onChange: (v: string) => void;
  products: ProductOperatorView[];
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) => p.id.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [query, products]);

  function select(id: string) {
    setQuery(id);
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="ops-combo" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <input
        className="ops-form__input"
        placeholder="输入或选择商品"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 ? (
        <div className="ops-combo__dropdown">
          {filtered.slice(0, 10).map((p) => (
            <button
              className={`ops-combo__option ${p.id === value ? "ops-combo__option--active" : ""}`}
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(p.id)}
              type="button"
            >
              <strong>{p.title}</strong>
              <span>{p.id}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RewardEditor({
  rewards,
  onChange,
  products,
}: {
  rewards: RewardRow[];
  onChange: (rows: RewardRow[]) => void;
  products: ProductOperatorView[];
}) {
  function addRow() {
    onChange([...rewards, { ...EMPTY_REWARD }]);
  }

  function removeRow(index: number) {
    onChange(rewards.filter((_, i) => i !== index));
  }

  function updateRow(index: number, patch: Partial<RewardRow>) {
    onChange(rewards.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="ops-reward-editor">
      <div className="ops-reward-editor__head">
        <span className="ops-form__label" style={{ marginBottom: 0 }}>奖励配置 *</span>
        <button className="ops-reward-editor__add" onClick={addRow} type="button">+ 添加奖励</button>
      </div>
      {rewards.map((row, i) => (
        <div className="ops-reward-editor__row" key={i}>
          <select
            className="ops-form__select"
            value={row.kind}
            onChange={(e) => updateRow(i, { kind: e.target.value as RewardRow["kind"] })}
          >
            <option value="walletGrant">货币</option>
            <option value="itemGrant">物品</option>
          </select>
          {row.kind === "walletGrant" ? (
            <>
              <select
                className="ops-form__select"
                value={row.currency}
                onChange={(e) => updateRow(i, { currency: e.target.value })}
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                className="ops-form__input"
                type="number"
                placeholder="数量"
                min={1}
                value={row.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value })}
              />
            </>
          ) : (
            <div style={{ gridColumn: "span 2" }}>
              <ProductCombo
                value={row.productId}
                onChange={(v) => updateRow(i, { productId: v })}
                products={products}
              />
            </div>
          )}
          {rewards.length > 1 ? (
            <button className="ops-reward-editor__remove" onClick={() => removeRow(i)} type="button">×</button>
          ) : null}
        </div>
      ))}
      {/* hidden fields for form submission */}
      <input type="hidden" name="rewardCount" value={rewards.length} />
      {rewards.map((row, i) => (
        <span key={`hidden-${i}`}>
          <input type="hidden" name={`reward_${i}_kind`} value={row.kind} />
          {row.kind === "walletGrant" ? (
            <>
              <input type="hidden" name={`reward_${i}_currency`} value={row.currency} />
              <input type="hidden" name={`reward_${i}_amount`} value={row.amount} />
            </>
          ) : (
            <input type="hidden" name={`reward_${i}_productId`} value={row.productId} />
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Paginated Code Table ───

function CodeTable({
  codes,
  onViewUsages,
}: {
  codes: RedemptionCodeView[];
  onViewUsages: (id: string) => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(codes.length / PAGE_SIZE));
  const visible = codes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th>兑换码</th>
              <th>分组</th>
              <th>奖励</th>
              <th>条件</th>
              <th>使用/上限</th>
              <th>时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((code) => {
              const st = statusLabel(code);
              return (
                <tr key={code.id}>
                  <td><code>{code.code}</code></td>
                  <td>{code.exclusionGroup || "—"}</td>
                  <td>{rewardsSummary(code)}</td>
                  <td>{eligibilitySummary(code)}</td>
                  <td>{code.usedCount}/{code.maxUses}</td>
                  <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>{formatTimeWindow(code)}</td>
                  <td><span className={`ops-status-dot ${statusDotClass(st)}`}>{STATUS_CN[st] ?? st}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <form action={toggleRedemptionCodeAction} style={{ display: "inline" }}>
                        <input type="hidden" name="codeId" value={code.id} />
                        <input type="hidden" name="currentActive" value={String(code.active)} />
                        <input type="hidden" name="code" value={code.code} />
                        <input type="hidden" name="rewardCount" value={String(code.rewards.length || 1)} />
                        {code.rewards.map((r, i) => (
                          <span key={i}>
                            <input type="hidden" name={`reward_${i}_kind`} value={r.kind} />
                            {r.kind === "walletGrant" ? <><input type="hidden" name={`reward_${i}_currency`} value={r.currency} /><input type="hidden" name={`reward_${i}_amount`} value={String(r.amount)} /></> : null}
                            {r.kind === "itemGrant" ? <input type="hidden" name={`reward_${i}_productId`} value={r.productId} /> : null}
                          </span>
                        ))}
                        <input type="hidden" name="exclusionGroup" value={code.exclusionGroup ?? ""} />
                        <input type="hidden" name="startsAt" value={code.startsAt ?? ""} />
                        <input type="hidden" name="expiresAt" value={code.expiresAt ?? ""} />
                        <input type="hidden" name="maxUses" value={String(code.maxUses)} />
                        <input type="hidden" name="active" value={String(code.active)} />
                        <button className="ops-inline-action" type="submit">{code.active ? "停用" : "启用"}</button>
                      </form>
                      <a className="ops-inline-action" href={`/ops/account/redemption-codes?edit=${code.id}`}>编辑</a>
                      <button className="ops-inline-action" type="button" onClick={() => onViewUsages(code.id)}>明细</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="ops-pagination">
          <button className="ops-pagination__btn" disabled={page === 0} onClick={() => setPage(page - 1)} type="button">上一页</button>
          <span className="ops-pagination__info">{page + 1} / {totalPages}</span>
          <button className="ops-pagination__btn" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} type="button">下一页</button>
        </div>
      ) : null}
    </>
  );
}

// ─── Main Client Component ───

export function RedemptionCodesOpsClient({
  codes,
  usages,
  usagesCodeId,
  editCodeId,
  status,
  message,
  loadError,
  products,
}: Props) {
  const editingCode = editCodeId ? codes.find((c) => c.id === editCodeId) ?? null : null;
  const groups = [...new Set(codes.map((c) => c.exclusionGroup).filter(Boolean))] as string[];

  // Create form rewards state
  const initialRewards: RewardRow[] = editingCode
    ? editingCode.rewards.map((r) => ({
        kind: r.kind,
        currency: r.kind === "walletGrant" ? r.currency : "",
        amount: r.kind === "walletGrant" ? String(r.amount) : "",
        productId: r.kind === "itemGrant" ? r.productId : "",
      }))
    : [{ ...EMPTY_REWARD }];
  const [createRewards, setCreateRewards] = useState<RewardRow[]>(initialRewards);

  // Batch form rewards state
  const [batchRewards, setBatchRewards] = useState<RewardRow[]>([{ ...EMPTY_REWARD }]);

  // Batch group expand state
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // Usages inline view
  const [inlineUsagesId, setInlineUsagesId] = useState<string | null>(usagesCodeId);

  const { groups: batchGroups, ungrouped } = groupByBatch(codes);

  // Stats
  const totalCodes = codes.length;
  const activeCodes = codes.filter((c) => c.active).length;
  const totalUsed = codes.reduce((s, c) => s + c.usedCount, 0);
  const totalQuota = codes.reduce((s, c) => s + c.maxUses, 0);
  const usageRate = totalQuota > 0 ? ((totalUsed / totalQuota) * 100).toFixed(1) : "0";

  function exportBatchCsv(label: string, batchCodes: RedemptionCodeView[]) {
    const header = "兑换码,状态,奖励,使用/上限,互斥分组,时间窗口,备注";
    const rows = batchCodes.map((c) => {
      const st = statusLabel(c);
      return [
        c.code,
        STATUS_CN[st] ?? st,
        rewardsSummary(c),
        `${c.usedCount}/${c.maxUses}`,
        c.exclusionGroup || "",
        formatTimeWindow(c),
        c.description || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = "\uFEFF" + header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `redemption-codes-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ops-page-stack">
      <div className="ops-page-header">
        <h1 className="ops-page-title">兑换码管理</h1>
        <p className="ops-page-subtitle">
          支持互斥分组、领取条件、定时开启、多奖励组合、批量生成
        </p>
      </div>

      {status && message ? <div className={`ops-alert ops-alert--${status}`}>{message}</div> : null}
      {loadError ? <div className="ops-alert ops-alert--error">{loadError}</div> : null}

      {/* ─── Stats Overview ─── */}
      {totalCodes > 0 ? (
        <div className="ops-stats-bar">
          <div className="ops-stats-bar__item">
            <span className="ops-stats-bar__label">总兑换码</span>
            <strong className="ops-stats-bar__value">{totalCodes}</strong>
          </div>
          <div className="ops-stats-bar__item">
            <span className="ops-stats-bar__label">活跃</span>
            <strong className="ops-stats-bar__value ops-stats-bar__value--active">{activeCodes}</strong>
          </div>
          <div className="ops-stats-bar__item">
            <span className="ops-stats-bar__label">总使用</span>
            <strong className="ops-stats-bar__value">{totalUsed}</strong>
          </div>
          <div className="ops-stats-bar__item">
            <span className="ops-stats-bar__label">总配额</span>
            <strong className="ops-stats-bar__value">{totalQuota}</strong>
          </div>
          <div className="ops-stats-bar__item">
            <span className="ops-stats-bar__label">使用率</span>
            <strong className="ops-stats-bar__value">{usageRate}%</strong>
          </div>
          <button className="ops-inline-action" onClick={() => exportBatchCsv("all", codes)} type="button">
            导出全部 CSV
          </button>
        </div>
      ) : null}

      {/* ─── Create / Edit ─── */}
      <div className="ops-card">
        <h2 className="ops-card__title">{editingCode ? `编辑 ${editingCode.code}` : "创建兑换码"}</h2>
        <form action={editingCode ? updateRedemptionCodeAction : createRedemptionCodeAction} className="ops-form">
          {editingCode ? <input type="hidden" name="codeId" value={editingCode.id} /> : null}

          <div className="ops-form__row">
            <label className="ops-form__label">
              兑换码 *
              <input className="ops-form__input" name="code" required minLength={3} maxLength={64} defaultValue={editingCode?.code ?? ""} placeholder="SPRING-2026" />
            </label>
            <label className="ops-form__label">
              互斥分组
              <input className="ops-form__input" name="exclusionGroup" list="groups-dl" defaultValue={editingCode?.exclusionGroup ?? ""} placeholder="welcome_pack" />
              <datalist id="groups-dl">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            </label>
            <label className="ops-form__label">
              状态
              <select className="ops-form__select" name="active" defaultValue={editingCode ? String(editingCode.active) : "true"}>
                <option value="true">启用</option>
                <option value="false">停用</option>
              </select>
            </label>
          </div>

          <div className="ops-form__row">
            <label className="ops-form__label">开始时间<input className="ops-form__input" name="startsAt" type="datetime-local" defaultValue={editingCode?.startsAt?.slice(0, 16) ?? ""} /></label>
            <label className="ops-form__label">过期时间<input className="ops-form__input" name="expiresAt" type="datetime-local" defaultValue={editingCode?.expiresAt?.slice(0, 16) ?? ""} /></label>
            <label className="ops-form__label">最大使用次数 *<input className="ops-form__input" name="maxUses" type="number" required min={1} defaultValue={editingCode?.maxUses ?? 10000} /></label>
          </div>

          <div className="ops-form__row">
            <label className="ops-form__label">最低信任等级<input className="ops-form__input" name="eligibility_minTrustLevel" type="number" min={0} max={10} placeholder="不限" defaultValue={editingCode?.eligibility?.minTrustLevel ?? ""} /></label>
            <label className="ops-form__label">限定用户 ID（逗号分隔）<input className="ops-form__input" name="eligibility_userIds" placeholder="不限" defaultValue={editingCode?.eligibility?.userIds?.join(",") ?? ""} /></label>
            <label className="ops-form__label">备注<input className="ops-form__input" name="description" maxLength={500} defaultValue={editingCode?.description ?? ""} /></label>
          </div>

          <RewardEditor rewards={createRewards} onChange={setCreateRewards} products={products} />

          <div className="ops-form__row">
            <label className="ops-form__label">自定义邮件标题<input className="ops-form__input" name="mailTitle" maxLength={200} defaultValue={editingCode?.mailTitle ?? ""} placeholder="默认" /></label>
            <label className="ops-form__label">自定义邮件正文<input className="ops-form__input" name="mailBody" maxLength={2000} defaultValue={editingCode?.mailBody ?? ""} placeholder="默认" /></label>
            <label className="ops-form__label">批次标签<input className="ops-form__input" name="batchLabel" maxLength={64} defaultValue={editingCode?.batchLabel ?? ""} /></label>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="ops-form__submit" type="submit">{editingCode ? "保存修改" : "创建兑换码"}</button>
            {editingCode ? <a className="ops-inline-action" href="/ops/account/redemption-codes" style={{ alignSelf: "center" }}>取消编辑</a> : null}
          </div>
        </form>
      </div>

      {/* ─── Batch Generate ─── */}
      <div className="ops-card">
        <h2 className="ops-card__title">批量生成</h2>
        <form action={generateBatchAction} className="ops-form">
          <div className="ops-form__row">
            <label className="ops-form__label">码前缀 *<input className="ops-form__input" name="batchPrefix" required minLength={2} maxLength={32} placeholder="GIFT" /></label>
            <label className="ops-form__label">生成数量 *<input className="ops-form__input" name="batchCount" type="number" required min={1} max={500} defaultValue={10} /></label>
            <label className="ops-form__label">批次标签 *<input className="ops-form__input" name="batchLabel" required maxLength={64} placeholder="spring-2026-batch1" /></label>
          </div>
          <div className="ops-form__row">
            <label className="ops-form__label">每码使用上限<input className="ops-form__input" name="maxUses" type="number" min={1} defaultValue={1} /></label>
            <label className="ops-form__label">互斥分组<input className="ops-form__input" name="exclusionGroup" list="groups-dl" placeholder="不分组" /></label>
            <label className="ops-form__label">最低信任等级<input className="ops-form__input" name="eligibility_minTrustLevel" type="number" min={0} placeholder="不限" /></label>
          </div>
          <RewardEditor rewards={batchRewards} onChange={setBatchRewards} products={products} />
          <input type="hidden" name="active" value="true" />
          <button className="ops-form__submit" type="submit">批量生成</button>
        </form>
      </div>

      {/* ─── Code List: Batch Groups ─── */}
      {batchGroups.length > 0 ? (
        <div className="ops-card">
          <h2 className="ops-card__title">批次总览 ({batchGroups.length} 个批次，{codes.length - ungrouped.length} 条码)</h2>
          <div className="ops-batch-list">
            {batchGroups.map((group) => (
              <div className="ops-batch-item" key={group.label}>
                <button
                  className={`ops-batch-item__head ${expandedBatch === group.label ? "ops-batch-item__head--active" : ""}`}
                  onClick={() => setExpandedBatch(expandedBatch === group.label ? null : group.label)}
                  type="button"
                >
                  <span className="ops-batch-item__label">{group.label}</span>
                  <span className="ops-batch-item__stats">
                    {group.codes.length} 条 · 已用 {group.totalUses}/{group.totalMax}
                  </span>
                  <span className="ops-batch-item__chevron">{expandedBatch === group.label ? "▼" : "▶"}</span>
                </button>
                {expandedBatch === group.label ? (
                  <div className="ops-batch-item__body">
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                      <button
                        className="ops-inline-action"
                        onClick={() => exportBatchCsv(group.label, group.codes)}
                        type="button"
                      >
                        导出此批次 CSV
                      </button>
                    </div>
                    <CodeTable codes={group.codes} onViewUsages={setInlineUsagesId} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ─── Code List: Ungrouped ─── */}
      {ungrouped.length > 0 ? (
        <div className="ops-card">
          <h2 className="ops-card__title">独立兑换码 ({ungrouped.length})</h2>
          <CodeTable codes={ungrouped} onViewUsages={setInlineUsagesId} />
        </div>
      ) : null}

      {codes.length === 0 && !loadError ? (
        <div className="ops-card"><p className="ops-empty">暂无兑换码</p></div>
      ) : null}

      {/* ─── Usage Detail ─── */}
      {(inlineUsagesId || usagesCodeId) ? (
        <div className="ops-card">
          <h2 className="ops-card__title">
            使用明细 — {codes.find((c) => c.id === (inlineUsagesId || usagesCodeId))?.code ?? (inlineUsagesId || usagesCodeId)}
            <button className="ops-inline-action" onClick={() => setInlineUsagesId(null)} style={{ marginLeft: 12, fontSize: "0.76rem" }} type="button">关闭</button>
          </h2>
          {usages.length === 0 && inlineUsagesId !== usagesCodeId ? (
            <p className="ops-empty">请刷新页面查看明细（点击列表中的"明细"按钮会加载数据）</p>
          ) : usages.length === 0 ? (
            <p className="ops-empty">暂无使用记录</p>
          ) : (
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead><tr><th>用户</th><th>用户 ID</th><th>兑换时间</th></tr></thead>
                <tbody>
                  {usages.map((u) => (
                    <tr key={u.id}><td>{u.username || "—"}</td><td><code>{u.userId}</code></td><td>{formatDate(u.createdAt)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
