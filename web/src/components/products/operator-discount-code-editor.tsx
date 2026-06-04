import type { DiscountCodeOperatorView } from "@/lib/core-client";
import { upsertOperatorDiscountCodeAction } from "@/lib/platform-actions";

const operatorDiscountScopes: Array<{ value: DiscountCodeOperatorView["scope"]; label: string }> = [
  { value: "allProducts", label: "全商品" },
  { value: "productCategory", label: "指定类目" },
  { value: "specificProduct", label: "指定商品" },
];

const operatorDiscountAudienceScopes: Array<{ value: DiscountCodeOperatorView["audienceScope"]; label: string }> = [
  { value: "allUsers", label: "全体用户" },
  { value: "userGroup", label: "用户组" },
  { value: "specificUser", label: "指定用户" },
];

const operatorDiscountValueKinds: Array<{ value: DiscountCodeOperatorView["valueKind"]; label: string }> = [
  { value: "fixedAmount", label: "固定减免" },
  { value: "percentage", label: "百分比" },
];

type OperatorDiscountCodeDraft = Omit<DiscountCodeOperatorView, "totalUsedCount" | "createdAt" | "updatedAt">;

type OperatorDiscountCodeEditorProps = {
  discountCode: DiscountCodeOperatorView;
  redirectTo: string;
};

type OperatorDiscountCodeCreateCardProps = {
  redirectTo: string;
};

function toLocaleDateTime(value: string | null | undefined) {
  if (!value) return "暂无";
  return new Date(value).toLocaleString("zh-CN");
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderDiscountCodeFormFields(discountCode: OperatorDiscountCodeDraft, discountCodeIdReadOnly: boolean) {
  return (
    <>
      <div className="ops-form__row">
        <label className="ops-form__label">
          Discount ID
          <input className="ops-form__input" name="discountCodeId" defaultValue={discountCode.id} readOnly={discountCodeIdReadOnly} />
        </label>
        <label className="ops-form__label">
          Code
          <input className="ops-form__input" name="code" defaultValue={discountCode.code} placeholder="例如 OBSI-20" />
        </label>
        <label className="ops-form__label">
          Namespace
          <input className="ops-form__input" name="namespace" defaultValue={discountCode.namespace ?? ""} placeholder="例如 spring-campaign" />
        </label>
      </div>
      <div className="ops-form__row">
        <label className="ops-form__label">
          Batch Label
          <input className="ops-form__input" name="batchLabel" defaultValue={discountCode.batchLabel ?? ""} placeholder="例如 2026-q1-a" />
        </label>
        <label className="ops-form__label">
          启用状态
          <select className="ops-form__select" name="enabled" defaultValue={String(discountCode.enabled)}>
            <option value="true">启用</option>
            <option value="false">停用</option>
          </select>
        </label>
        <label className="ops-form__label">
          作用范围
          <select className="ops-form__select" name="scope" defaultValue={discountCode.scope}>
            {operatorDiscountScopes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="ops-form__row">
        <label className="ops-form__label">
          目标类目
          <input className="ops-form__input" name="targetProductCategory" defaultValue={discountCode.targetProductCategory ?? ""} placeholder="scope=productCategory 时填写" />
        </label>
        <label className="ops-form__label">
          目标商品 ID
          <input className="ops-form__input" name="targetProductId" defaultValue={discountCode.targetProductId ?? ""} placeholder="scope=specificProduct 时填写" />
        </label>
        <label className="ops-form__label">
          受众范围
          <select className="ops-form__select" name="audienceScope" defaultValue={discountCode.audienceScope}>
            {operatorDiscountAudienceScopes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="ops-form__row">
        <label className="ops-form__label">
          用户组
          <input className="ops-form__input" name="audienceGroupKey" defaultValue={discountCode.audienceGroupKey ?? ""} placeholder="audienceScope=userGroup 时填写" />
        </label>
        <label className="ops-form__label">
          指定用户 ID
          <input className="ops-form__input" name="audienceUserId" defaultValue={discountCode.audienceUserId ?? ""} placeholder="audienceScope=specificUser 时填写" />
        </label>
        <label className="ops-form__label">
          折扣类型
          <select className="ops-form__select" name="valueKind" defaultValue={discountCode.valueKind}>
            {operatorDiscountValueKinds.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="ops-form__row">
        <label className="ops-form__label">
          折扣值
          <input className="ops-form__input" min={1} name="valueAmount" step={1} type="number" defaultValue={discountCode.valueAmount} />
        </label>
        <label className="ops-form__label">
          总次数上限
          <input className="ops-form__input" min={1} name="totalMaxUses" step={1} type="number" defaultValue={discountCode.totalMaxUses ?? ""} placeholder="留空表示不限" />
        </label>
        <label className="ops-form__label">
          单用户次数上限
          <input className="ops-form__input" min={1} name="perUserLimit" step={1} type="number" defaultValue={discountCode.perUserLimit ?? ""} placeholder="留空表示不限" />
        </label>
      </div>
      <div className="ops-form__row">
        <label className="ops-form__label">
          生效时间
          <input className="ops-form__input" name="startsAt" type="datetime-local" defaultValue={toDateTimeLocalValue(discountCode.startsAt)} />
        </label>
        <label className="ops-form__label">
          过期时间
          <input className="ops-form__input" name="expiresAt" type="datetime-local" defaultValue={toDateTimeLocalValue(discountCode.expiresAt)} />
        </label>
      </div>
    </>
  );
}

export function OperatorDiscountCodeEditor({ discountCode, redirectTo }: OperatorDiscountCodeEditorProps) {
  return (
    <div className="ops-batch-item">
      <div className="ops-batch-item__head" style={{ cursor: "default" }}>
        <span>
          <strong>{discountCode.code}</strong>
          <span style={{ marginLeft: 8, opacity: 0.5, fontSize: "0.78rem" }}>{discountCode.id}</span>
        </span>
        <span className={`ops-status-dot ${discountCode.enabled ? "ops-status-dot--active" : "ops-status-dot--inactive"}`}>
          {discountCode.enabled ? "Enabled" : "Disabled"}
        </span>
        <code>{discountCode.scope}</code>
      </div>
      <div style={{ padding: "12px 16px" }}>
        <p style={{ fontSize: "0.82rem", color: "var(--mg-text-muted)", margin: "0 0 14px" }}>
          已使用 {discountCode.totalUsedCount} 次 · 创建 {toLocaleDateTime(discountCode.createdAt)} · 更新 {toLocaleDateTime(discountCode.updatedAt)}
        </p>
        <form action={upsertOperatorDiscountCodeAction} className="ops-form">
          <input name="redirectTo" type="hidden" value={redirectTo} />
          {renderDiscountCodeFormFields(discountCode, true)}
          <button className="ops-form__submit" type="submit">保存优惠码配置</button>
        </form>
      </div>
    </div>
  );
}

export function OperatorDiscountCodeCreateCard({ redirectTo }: OperatorDiscountCodeCreateCardProps) {
  const draft: OperatorDiscountCodeDraft = {
    id: "",
    code: "",
    namespace: null,
    batchLabel: null,
    enabled: true,
    scope: "allProducts",
    targetProductCategory: null,
    targetProductId: null,
    audienceScope: "allUsers",
    audienceGroupKey: null,
    audienceUserId: null,
    valueKind: "fixedAmount",
    valueAmount: 10,
    totalMaxUses: null,
    perUserLimit: 1,
    startsAt: null,
    expiresAt: null,
  };

  return (
    <div>
      <p style={{ fontSize: "0.82rem", color: "var(--mg-text-muted)", margin: "0 0 14px" }}>
        填写新的 discountCodeId 创建优惠码。seeded code 只负责补齐默认记录，不会覆盖人工修改。
      </p>
      <form action={upsertOperatorDiscountCodeAction} className="ops-form">
        <input name="redirectTo" type="hidden" value={redirectTo} />
        {renderDiscountCodeFormFields(draft, false)}
        <button className="ops-form__submit" type="submit">创建优惠码</button>
      </form>
    </div>
  );
}
