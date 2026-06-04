"use client";

import { useState } from "react";

import type {
  GatewayAccessGrantMode,
  ProductOperatorView,
  ProductTargetedAudienceGroupKey,
} from "@neuro/contracts";

import {
  deleteOperatorProductAction,
  upsertOperatorProductAction,
} from "@/lib/platform-actions";

const operatorProductKinds: Array<{ value: ProductOperatorView["kind"]; label: string }> = [
  { value: "limitedTime", label: "限时" },
  { value: "limitedPurchase", label: "限购" },
  { value: "unlimited", label: "不限量" },
];

const operatorLimitScopes: Array<{ value: ProductOperatorView["limitScope"]; label: string }> = [
  { value: "global", label: "全体开放" },
  { value: "targeted", label: "定向开放" },
];

const operatorTargetedAudienceOptions: Array<{
  value: ProductTargetedAudienceGroupKey;
  label: string;
}> = [
  { value: "trusted_users", label: "可信用户" },
  { value: "new_users", label: "新用户" },
];

const operatorCategories = [
  { value: "artificial_intelligence", label: "人工智能" },
  { value: "network_search", label: "网络搜索" },
  { value: "network_proxy", label: "网络代理" },
];

export type OperatorProductBundleOption = {
  id: string;
  slug: string;
  displayName: string;
  billingMode: GatewayAccessGrantMode;
  status: string;
  projectId: string | null;
};

type OperatorProductDraft = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  kind: ProductOperatorView["kind"];
  currency: ProductOperatorView["currency"];
  price: number;
  fulfillmentMode: ProductOperatorView["fulfillmentMode"];
  transferable: boolean;
  active: boolean;
  allowDiscountCodes: boolean;
  limitScope: ProductOperatorView["limitScope"];
  targetedAudienceGroupKey: ProductTargetedAudienceGroupKey | null;
  durationDays: number | null;
  unitCount: number | null;
  warrantyDays: number | null;
  gatewayAccessBundleId: string | null;
  gatewayAccessGrantMode: GatewayAccessGrantMode | null;
  gatewayAccessGrantQuantity: number | null;
};

type OperatorProductEditorProps = {
  product: ProductOperatorView;
  redirectTo: string;
  bundleOptions: OperatorProductBundleOption[];
};

type OperatorProductCreateCardProps = {
  redirectTo: string;
  bundleOptions: OperatorProductBundleOption[];
};

type ProductFormFieldsProps = {
  product: OperatorProductDraft;
  bundleOptions: OperatorProductBundleOption[];
};

function toLocaleDateTime(value: string | null | undefined) {
  if (!value) return "暂无";
  return new Date(value).toLocaleString("zh-CN");
}

function toBundleBillingModeLabel(mode: GatewayAccessGrantMode) {
  switch (mode) {
    case "time_pass":
      return "时长";
    case "message_prepaid":
      return "请求数";
    default:
      return "Token";
  }
}

function toBundleGrantQuantityLabel(mode: GatewayAccessGrantMode) {
  switch (mode) {
    case "time_pass":
      return "充值天数";
    case "message_prepaid":
      return "充值请求数";
    default:
      return "充值 Token 数";
  }
}

function buildBundleOptions(
  bundleOptions: OperatorProductBundleOption[],
  product: OperatorProductDraft,
) {
  const bundleId = product.gatewayAccessBundleId?.trim();
  if (!bundleId) {
    return bundleOptions;
  }
  if (bundleOptions.some((bundle) => bundle.id === bundleId)) {
    return bundleOptions;
  }
  return [
    {
      id: bundleId,
      slug: bundleId,
      displayName: bundleId,
      billingMode: product.gatewayAccessGrantMode ?? "time_pass",
      status: "missing",
      projectId: null,
    },
    ...bundleOptions,
  ];
}

function ProductFormFields({ product, bundleOptions }: ProductFormFieldsProps) {
  const availableBundleOptions = buildBundleOptions(bundleOptions, product);
  const [bundleId, setBundleId] = useState(product.gatewayAccessBundleId ?? "");
  const [limitScope, setLimitScope] = useState<ProductOperatorView["limitScope"]>(product.limitScope);
  const [enableWarranty, setEnableWarranty] = useState(product.warrantyDays !== null);
  const [grantQuantity, setGrantQuantity] = useState(
    product.gatewayAccessGrantQuantity !== null ? String(product.gatewayAccessGrantQuantity) : "",
  );

  const selectedBundle = availableBundleOptions.find((bundle) => bundle.id === bundleId) ?? null;
  const resolvedGrantMode = selectedBundle?.billingMode ?? null;

  return (
    <div className="ops-form">
      <div className="ops-form__row">
        <label className="ops-form__label">
          Slug
          <input className="ops-form__input" name="slug" defaultValue={product.slug} />
        </label>
        <label className="ops-form__label">
          标题
          <input className="ops-form__input" name="title" defaultValue={product.title} />
        </label>
        <label className="ops-form__label">
          价格
          <input className="ops-form__input" min={0} name="price" step={1} type="number" defaultValue={product.price} />
        </label>
      </div>

      <div className="ops-form__row">
        <label className="ops-form__label">
          分类
          <select className="ops-form__select" name="category" defaultValue={product.category}>
            {operatorCategories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ops-form__label">
          Kind
          <select className="ops-form__select" name="kind" defaultValue={product.kind}>
            {operatorProductKinds.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ops-form__label">
          货币
          <select className="ops-form__select" name="currency" defaultValue={product.currency}>
            <option value="obsidian">曜石</option>
            <option value="mira">米拉</option>
          </select>
        </label>
      </div>

      <div className="ops-form__row">
        <label className="ops-form__label">
          开放范围
          <select
            className="ops-form__select"
            name="limitScope"
            value={limitScope}
            onChange={(event) => setLimitScope(event.target.value as ProductOperatorView["limitScope"])}
          >
            {operatorLimitScopes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {limitScope === "targeted" ? (
          <label className="ops-form__label">
            定向开放范围
            <select
              className="ops-form__select"
              name="targetedAudienceGroupKey"
              defaultValue={product.targetedAudienceGroupKey ?? "trusted_users"}
            >
              {operatorTargetedAudienceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div />
        )}
        <label className="ops-form__label">
          启用状态
          <select className="ops-form__select" name="active" defaultValue={String(product.active)}>
            <option value="true">启用</option>
            <option value="false">停用</option>
          </select>
        </label>
      </div>

      <div className="ops-form__row">
        <label className="ops-form__label">
          优惠码
          <select className="ops-form__select" name="allowDiscountCodes" defaultValue={String(product.allowDiscountCodes)}>
            <option value="true">允许</option>
            <option value="false">禁用</option>
          </select>
        </label>
        <label className="ops-form__label">
          质保
          <span className="ops-form__checkbox">
            <input
              checked={enableWarranty}
              name="enableWarranty"
              onChange={(event) => setEnableWarranty(event.target.checked)}
              type="checkbox"
              value="true"
            />
            <span>启用质保</span>
          </span>
        </label>
        {enableWarranty ? (
          <label className="ops-form__label">
            质保天数
            <input
              className="ops-form__input"
              defaultValue={product.warrantyDays ?? ""}
              min={1}
              name="warrantyDays"
              step={1}
              type="number"
            />
          </label>
        ) : (
          <div />
        )}
      </div>

      <div className="ops-form__row">
        <label className="ops-form__label">
          Tags
          <input className="ops-form__input" name="tags" defaultValue={JSON.stringify(product.tags)} />
        </label>
        <label className="ops-form__label">
          绑定 Bundle
          <select
            className="ops-form__select"
            name="gatewayAccessBundleId"
            value={bundleId}
            onChange={(event) => setBundleId(event.target.value)}
          >
            <option value="">不绑定</option>
            {availableBundleOptions.map((bundle) => (
              <option key={bundle.id} value={bundle.id}>
                {bundle.displayName} ({toBundleBillingModeLabel(bundle.billingMode)})
              </option>
            ))}
          </select>
        </label>
        {resolvedGrantMode ? (
          <label className="ops-form__label">
            {toBundleGrantQuantityLabel(resolvedGrantMode)}
            <input
              className="ops-form__input"
              min={1}
              name="gatewayAccessGrantQuantity"
              onChange={(event) => setGrantQuantity(event.target.value)}
              step={1}
              type="number"
              value={grantQuantity}
            />
          </label>
        ) : (
          <div />
        )}
      </div>

      <div className="ops-form__row" style={{ gridColumn: "1 / -1" }}>
        <label className="ops-form__label" style={{ width: "100%" }}>
          描述
          <textarea
            className="ops-form__input"
            defaultValue={product.description}
            name="description"
            rows={3}
            style={{ resize: "vertical" }}
          />
        </label>
      </div>

      {limitScope !== "targeted" ? <input name="targetedAudienceGroupKey" type="hidden" value="" /> : null}
      <input
        name="fulfillmentMode"
        type="hidden"
        value={resolvedGrantMode ? "one_time_delivery" : product.fulfillmentMode}
      />
      <input
        name="transferable"
        type="hidden"
        value={resolvedGrantMode ? "false" : String(product.transferable)}
      />
      <input
        name="durationDays"
        type="hidden"
        value={resolvedGrantMode ? "" : product.durationDays ?? ""}
      />
      <input
        name="unitCount"
        type="hidden"
        value={resolvedGrantMode ? "" : product.unitCount ?? ""}
      />
      <input name="gatewayAccessGrantMode" type="hidden" value={resolvedGrantMode ?? ""} />
      {!enableWarranty ? <input name="warrantyDays" type="hidden" value="" /> : null}
      <input name="stockLabel" type="hidden" value={limitScope === "targeted" ? "定向开放" : "持续开放"} />
    </div>
  );
}

function ProductDeleteButton() {
  return (
    <button
      className="ops-form__submit ops-form__submit--danger"
      formAction={deleteOperatorProductAction}
      onClick={(event) => {
        if (!window.confirm("确认删除这个商品？已有关联订单或发货记录的商品不会被允许删除。")) {
          event.preventDefault();
        }
      }}
    >
      删除商品
    </button>
  );
}

export function OperatorProductEditor({ product, redirectTo, bundleOptions }: OperatorProductEditorProps) {
  const draft: OperatorProductDraft = {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    category: product.category,
    tags: product.tags,
    kind: product.kind,
    currency: product.currency,
    price: product.price,
    fulfillmentMode: product.fulfillmentMode,
    transferable: product.transferable,
    active: product.active,
    allowDiscountCodes: product.allowDiscountCodes,
    limitScope: product.limitScope,
    targetedAudienceGroupKey: product.targetedAudienceGroupKey,
    durationDays: product.durationDays,
    unitCount: product.unitCount,
    warrantyDays: product.warrantyDays,
    gatewayAccessBundleId: product.gatewayAccessBundleId,
    gatewayAccessGrantMode: product.gatewayAccessGrantMode,
    gatewayAccessGrantQuantity: product.gatewayAccessGrantQuantity,
  };

  return (
    <div className="ops-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "rgba(235,241,245,0.92)" }}>{product.title}</h3>
          <p className="ops-empty" style={{ padding: 0, textAlign: "left", minHeight: 0, marginTop: 10 }}>
            创建：{toLocaleDateTime(product.createdAt)}，最近更新：{toLocaleDateTime(product.updatedAt)}
          </p>
        </div>
        <span className={`ops-status-dot ops-status-dot--${product.active ? "active" : "inactive"}`}>
          {product.active ? "Active" : "Inactive"}
        </span>
      </div>
      <form action={upsertOperatorProductAction}>
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <input name="productId" type="hidden" value={product.id} />
        <ProductFormFields product={draft} bundleOptions={bundleOptions} />
        <div className="ops-form__actions">
          <button className="ops-form__submit" type="submit">
            保存商品配置
          </button>
          <ProductDeleteButton />
        </div>
      </form>
    </div>
  );
}

export function OperatorProductCreateCard({ redirectTo, bundleOptions }: OperatorProductCreateCardProps) {
  const draft: OperatorProductDraft = {
    id: "",
    slug: "",
    title: "",
    description: "",
    category: "artificial_intelligence",
    tags: [],
    kind: "limitedPurchase",
    currency: "obsidian",
    price: 0,
    fulfillmentMode: "one_time_delivery",
    transferable: false,
    active: true,
    allowDiscountCodes: true,
    limitScope: "global",
    targetedAudienceGroupKey: null,
    durationDays: null,
    unitCount: null,
    warrantyDays: null,
    gatewayAccessBundleId: null,
    gatewayAccessGrantMode: null,
    gatewayAccessGrantQuantity: null,
  };

  return (
    <div className="ops-card">
      <h3 style={{ margin: 0, fontSize: "1rem", color: "rgba(235,241,245,0.92)" }}>新建商品</h3>
      <form action={upsertOperatorProductAction}>
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <input name="productId" type="hidden" value="" />
        <ProductFormFields product={draft} bundleOptions={bundleOptions} />
        <div className="ops-form__actions">
          <button className="ops-form__submit" type="submit">
            创建商品
          </button>
        </div>
      </form>
    </div>
  );
}
