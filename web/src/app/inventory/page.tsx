import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  AccountCenterAvatarStage,
  AccountCenterFrame,
} from "@/components/account-home/account-center-frame";
import {
  AccountHomeList,
  AccountHomeListRow,
  AccountHomeRailCard,
  AccountHomeSection,
  AccountHomeSectionHead,
  AccountHomeStat,
  AccountHomeStatGrid,
} from "@/components/account-home/templates";
import { PublicSurfaceDependencyState } from "@/components/public-surface-dependency-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildAccountCenterNavItems,
  buildAccountHudItems,
  formatAccountDateTime,
  formatAccountNumber,
} from "@/lib/account-center";
import { getCurrentUser } from "@/lib/account-client";
import { createListingAction, submitOrderAction } from "@/lib/platform-actions";
import { getFeatureSnapshot, isFeatureSnapshotUnavailable, listItems, listOrders } from "@/lib/platform-client";
import { hasPublicSurfaceSnapshot, loadPublicSurfaceDependency } from "@/lib/public-surface-dependency";
import {
  buildAccountCenterSurfaceVisibility,
  isPublicSurfaceVisibleForViewer,
} from "@/lib/public-surface-visibility";

type InventoryPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

function getItemStatusBadgeVariant(status: string): "success" | "warning" | "danger" | "violet" {
  if (status === "active") {
    return "success";
  }
  if (status === "listed") {
    return "warning";
  }
  if (status === "revoked") {
    return "danger";
  }
  return "violet";
}

function getItemStatusLabel(status: string) {
  if (status === "active") {
    return "在线";
  }
  if (status === "listed") {
    return "挂牌中";
  }
  if (status === "revoked") {
    return "已回退";
  }
  return "已耗尽";
}

function getOrderStatusBadgeVariant(status: string): "success" | "warning" | "danger" {
  if (status === "fulfilled") {
    return "success";
  }
  if (status === "rolled_back") {
    return "danger";
  }
  return "warning";
}

function getOrderStatusLabel(status: string) {
  if (status === "fulfilled") {
    return "已履约";
  }
  if (status === "rolled_back") {
    return "已回退";
  }
  return "处理中";
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;

  const userContext = {
    userId: session.user.id,
    username: session.user.username,
  };

  const [features, publicSurfaceDependency, user] = await Promise.all([
    getFeatureSnapshot(),
    loadPublicSurfaceDependency(),
    getCurrentUser(userContext),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (!hasPublicSurfaceSnapshot(publicSurfaceDependency)) {
    return <PublicSurfaceDependencyState result={publicSurfaceDependency} />;
  }
  const publicSurfaces = publicSurfaceDependency.data;

  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "inventory", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  if (isFeatureSnapshotUnavailable(features)) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">模块状态暂不可用</h1>
            <p className="mg-copy">当前无法读取模块状态，请稍后再试。</p>
          </Card>
        </div>
      </main>
    );
  }

  const itemEnabled = features.item.enabled;
  const productEnabled = features.product.enabled;

  if (!itemEnabled && !productEnabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">商品与资产模块已关闭</h1>
            <p className="mg-copy">当前无法读取个人商品历史或持有资产。</p>
          </Card>
        </div>
      </main>
    );
  }

  const [items, orders] = await Promise.all([
    itemEnabled ? listItems(userContext) : Promise.resolve([]),
    productEnabled ? listOrders(userContext) : Promise.resolve([]),
  ]);
  const listableItems = items.filter((item) => item.transferable && item.status === "active");

  const progression = user.snapshot?.progression ?? null;
  const walletSnapshot = user.snapshot?.wallet ?? null;
  const mailboxSnapshot = user.snapshot?.mailbox ?? null;
  const accountDisplayName = user.username || session.user.username;
  const accountAvatarUrl = user.avatarUrl || session.user.avatarUrl || null;
  const userInitial = accountDisplayName.slice(0, 1).toUpperCase();
  const unreadMailboxCount = mailboxSnapshot?.unreadMessages ?? 0;
  const pendingAttachmentCount = mailboxSnapshot?.pendingAttachments ?? 0;
  const activeItemCount = items.filter((item) => item.status === "active").length;
  const listedItemCount = items.filter((item) => item.status === "listed").length;
  const maintainedPoolCount = items.filter((item) => item.fulfillmentMode === "maintained_pool").length;
  const warrantyCount = items.filter((item) => item.fulfillmentMode === "warranty_delivery").length;
  const accountCenterVisibility = buildAccountCenterSurfaceVisibility(
    publicSurfaces,
    session.user.id,
    session.user.providerUserId,
  );
  const navItems = buildAccountCenterNavItems({
    active: null,
    mailboxUnreadCount: unreadMailboxCount,
    pendingAttachmentCount,
    progression,
    recentWalletCount: walletSnapshot?.recentEntryCount ?? 0,
    reputation: null,
    visibility: accountCenterVisibility,
  });
  const hudItems = buildAccountHudItems({
    wallet: null,
    walletSnapshot,
    progression,
    mailboxUnreadCount: unreadMailboxCount,
    pendingAttachmentCount,
  });

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        {status && message ? (
          <Card className="app-stack">
            <p className={status === "success" ? "app-banner app-banner--success" : "app-banner app-banner--error"}>
              {message}
            </p>
          </Card>
        ) : null}
        <AccountCenterFrame
          actions={
            <>
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "benefits", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--primary" href="/benefits">进入羊毛派</Link>
              ) : null}
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "store", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--primary" href="/products">进入商城</Link>
              ) : null}
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "marketplace", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--glass" href="/marketplace">进入集市</Link>
              ) : null}
              <Link className="mg-btn mg-btn--secondary" href="/dashboard">返回总览</Link>
            </>
          }
          description="商品个人视图的第一版现在以“我持有的资产 + 我下过的订单”收口到账户中心。详细购买与交易动作仍由平台页 owner，但个人视角已经不再散落。"
          focusItems={[
            { label: "持有资产", value: formatAccountNumber(items.length) },
            { label: "活跃资产", value: formatAccountNumber(activeItemCount) },
            { label: "已下订单", value: formatAccountNumber(orders.length) },
            { label: "可挂牌", value: formatAccountNumber(listableItems.length) },
          ]}
          hudItems={hudItems}
          kicker="资产终端"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
          <AccountHomeSectionHead kicker="资产结构" title="资产结构" />
              <AccountHomeList>
                <AccountHomeListRow aside={<span className="app-note">{maintainedPoolCount}</span>} title="维护池资产" />
                <AccountHomeListRow aside={<span className="app-note">{warrantyCount}</span>} title="质保资产" />
                <AccountHomeListRow aside={<span className="app-note">{listedItemCount}</span>} title="挂牌中" />
                <AccountHomeListRow aside={<span className="app-note">{orders[0] ? formatAccountDateTime(orders[0].createdAt) : "暂无"}</span>} title="最近下单" />
              </AccountHomeList>
            </AccountHomeRailCard>
          }
          railStats={[
            { label: "资产数", value: formatAccountNumber(items.length) },
            { label: "订单数", value: formatAccountNumber(orders.length) },
            { label: "维护池", value: formatAccountNumber(maintainedPoolCount) },
            { label: "质保资产", value: formatAccountNumber(warrantyCount) },
          ]}
          stage={
            <AccountCenterAvatarStage
              alt={`${accountDisplayName} avatar`}
              avatarUrl={accountAvatarUrl}
              fallback={userInitial}
            />
          }
          title="我的商品与资产"
          titleBadges={
            <>
              <Badge variant="cyan">Inventory</Badge>
              <Badge variant="violet">Orders</Badge>
              {progression ? <Badge variant="warning">{`Lv.${progression.level}`}</Badge> : null}
            </>
          }
        >
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection>
              <AccountHomeSectionHead kicker="持有资产" title="持有资产" />
                {items.length === 0 ? (
                  <p className="mg-copy">当前还没有持有资产。</p>
                ) : (
                  <div className="app-account-subgrid">
                    {items.map((item) => (
                      <Card className="app-stack" key={item.id}>
                        <AccountHomeListRow
                          aside={
                            <div className="app-account-ledger-aside">
                              <Badge variant={getItemStatusBadgeVariant(item.status)}>{getItemStatusLabel(item.status)}</Badge>
                              <strong>{item.fulfillmentMode}</strong>
                            </div>
                          }
                          subtitle={[
                            item.transferable ? "可流转" : "不可流转",
                            item.activeUnits !== null ? `活跃单元 ${item.activeUnits}` : null,
                            item.warrantyExpiresAt ? `质保至 ${formatAccountDateTime(item.warrantyExpiresAt)}` : null,
                            item.expiresAt ? `到期 ${formatAccountDateTime(item.expiresAt)}` : null,
                          ].filter(Boolean).join(" · ")}
                          title={item.productTitle}
                        />
                        {item.transferable && item.status === "active" ? (
                          <form action={createListingAction} className="app-account-inline-form">
                            <input name="itemId" type="hidden" value={item.id} />
                            <input name="redirectTo" type="hidden" value="/inventory" />
                            <Input
                              className="app-account-inline-form__input"
                              min="1"
                              name="price"
                              placeholder="挂牌价格"
                              required
                              type="number"
                            />
                            <button className="mg-btn mg-btn--secondary" type="submit">直接挂牌</button>
                          </form>
                        ) : (
                          <p className="app-note">
                            {item.status === "listed" ? "当前已在市场挂牌中。" : "该资产当前不可挂牌。"}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="订单历史" title="订单历史" />
                {orders.length === 0 ? (
                  <p className="mg-copy">当前还没有订单历史。</p>
                ) : (
                  <div className="app-account-subgrid">
                    {orders.map((order) => (
                      <Card className="app-stack" key={order.id}>
                        <AccountHomeListRow
                          aside={
                            <div className="app-account-ledger-aside">
                              <Badge variant={getOrderStatusBadgeVariant(order.status)}>{getOrderStatusLabel(order.status)}</Badge>
                              <strong>{`${order.finalAmount} ${order.currency}`}</strong>
                            </div>
                          }
                          subtitle={[
                            `原价 ${order.originalAmount}`,
                            order.discountAmount > 0 ? `优惠 ${order.discountAmount}` : null,
                            order.discountLabel,
                            formatAccountDateTime(order.createdAt),
                          ].filter(Boolean).join(" · ")}
                          title={order.productTitle}
                        />
                        <form action={submitOrderAction} className="app-action-row">
                          <input name="productId" type="hidden" value={order.productId} />
                          <input name="redirectTo" type="hidden" value="/inventory" />
                          <button className="mg-btn mg-btn--glass" type="submit">再次购买</button>
                          {isPublicSurfaceVisibleForViewer(publicSurfaces, "store", session.user.id, session.user.providerUserId) ? (
                            <Link className="mg-btn mg-btn--outline" href="/products">查看商品页</Link>
                          ) : null}
                        </form>
                      </Card>
                    ))}
                  </div>
                )}
              </AccountHomeSection>
            </div>

            <div className="app-account-content-side">
              <AccountHomeSection>
          <AccountHomeSectionHead kicker="摘要" title="商品域摘要" />
                <AccountHomeStatGrid>
                  <AccountHomeStat label="活跃资产" value={activeItemCount} />
                  <AccountHomeStat label="挂牌资产" value={listedItemCount} />
                  <AccountHomeStat label="维护池" value={maintainedPoolCount} />
                  <AccountHomeStat label="质保资产" value={warrantyCount} />
                </AccountHomeStatGrid>
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="快捷动作" title="账户页已接入动作" />
                <AccountHomeList>
                  {isPublicSurfaceVisibleForViewer(publicSurfaces, "benefits", session.user.id, session.user.providerUserId) ? (
                    <AccountHomeListRow aside={<span className="app-note">/benefits</span>} title="权益领取台" />
                  ) : null}
                  <AccountHomeListRow aside={<span className="app-note">{listableItems.length}</span>} title="可直接挂牌资产" />
                  <AccountHomeListRow aside={<span className="app-note">{orders.length}</span>} title="可从订单再次购买" />
                  <AccountHomeListRow aside={<span className="app-note">/inventory</span>} title="动作回跳页" />
                  <AccountHomeListRow aside={<span className="app-note">保留 /products /marketplace</span>} title="完整交易入口" />
                </AccountHomeList>
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="范围" title="账户资产范围" />
                <AccountHomeList>
                  <AccountHomeListRow aside={<span className="app-note">账户中心聚合 + 常用动作</span>} title="当前定位" />
                  <AccountHomeListRow aside={<span className="app-note">/products /marketplace</span>} title="详细交易入口" />
                  <AccountHomeListRow aside={<span className="app-note">账户资产与订单记录</span>} title="数据来源" />
                  <AccountHomeListRow aside={<span className="app-note">平台业务链路</span>} title="归属口径" />
                </AccountHomeList>
              </AccountHomeSection>
            </div>
          </div>
        </AccountCenterFrame>
      </div>
    </main>
  );
}
