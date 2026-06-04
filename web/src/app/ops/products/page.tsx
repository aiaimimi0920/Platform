import Link from "next/link";
import { redirect } from "next/navigation";

import {
  OperatorProductCreateCard,
  OperatorProductEditor,
  type OperatorProductBundleOption,
} from "@/components/products/operator-product-editor";
import { auth } from "@/auth";
import { getFeatureSnapshot, listOperatorProducts } from "@/lib/core-client";
import { getGatewayAccessCatalog } from "@/lib/account-client";
import { isPlatformOperatorUserId } from "@/lib/platform-session";

type ProductOpsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function ProductOpsPage({ searchParams }: ProductOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : {};
  const status = params.status || "";
  const message = params.message || "";

  const isOperator = isPlatformOperatorUserId(session.user.id, session.user.providerUserId);
  const features = await getFeatureSnapshot();

  if (!isOperator) {
    return (
      <main className="ops-main">
        <div className="ops-page-stack">
          <p className="ops-alert ops-alert--error">当前账号无法访问商品运营台，需要平台操作员权限。</p>
        </div>
      </main>
    );
  }

  if (!features.product.enabled) {
    return (
      <main className="ops-main">
        <div className="ops-page-stack">
          <p className="ops-alert ops-alert--error">当前 product 模块未启用，商品运营台暂不可用。</p>
        </div>
      </main>
    );
  }

  const userContext = { userId: session.user.id, providerUserId: session.user.providerUserId ?? undefined };
  const [operatorProducts, bundleCatalogResult] = await Promise.all([
    listOperatorProducts(userContext),
    getGatewayAccessCatalog(userContext)
      .then((catalog) => ({
        bundles: catalog.bundles.map<OperatorProductBundleOption>((bundle) => ({
          id: bundle.id,
          slug: bundle.slug,
          displayName: bundle.displayName,
          billingMode: bundle.billingMode as OperatorProductBundleOption["billingMode"],
          status: bundle.status,
          projectId: bundle.projectId,
        })),
        error: null,
      }))
      .catch((error) => ({
        bundles: [] as OperatorProductBundleOption[],
        error: error instanceof Error ? error.message : "Gateway bundle 目录加载失败。",
      })),
  ]);
  const redirectTo = "/ops/products";

  const activeCount = operatorProducts.filter((p) => p.active).length;
  const inactiveCount = operatorProducts.filter((p) => !p.active).length;

  return (
    <main className="ops-main">
      <div className="ops-page-stack">
        <div className="ops-page-header">
          <h1 className="ops-page-title">商品管理</h1>
        </div>

        {status && message ? (
          <p className={`ops-alert ops-alert--${status}`}>{message}</p>
        ) : null}
        {bundleCatalogResult.error ? (
          <p className="ops-alert ops-alert--error">Gateway bundle 目录加载失败：{bundleCatalogResult.error}</p>
        ) : null}

        <div className="ops-card">
          <h2 className="ops-card__title">Inventory</h2>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Total Products</th>
                  <th>Active</th>
                  <th>Inactive</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{operatorProducts.length}</td>
                  <td>
                    <span className="ops-status-dot ops-status-dot--active">{activeCount}</span>
                  </td>
                  <td>
                    <span className="ops-status-dot ops-status-dot--inactive">{inactiveCount}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="ops-card">
          <h2 className="ops-card__title">新建商品</h2>
          <OperatorProductCreateCard redirectTo={redirectTo} bundleOptions={bundleCatalogResult.bundles} />
        </div>

        <div className="ops-card">
          <h2 className="ops-card__title">现有商品维护</h2>
          {operatorProducts.length === 0 ? (
            <p className="ops-empty">暂无商品记录。</p>
          ) : (
            operatorProducts.map((product) => (
              <OperatorProductEditor
                key={product.id}
                product={product}
                redirectTo={redirectTo}
                bundleOptions={bundleCatalogResult.bundles}
              />
            ))
          )}
        </div>

        {features.discountCode.enabled ? (
          <div className="ops-card">
            <h2 className="ops-card__title">优惠码管理</h2>
            <div>
              <Link href="/ops/discount-codes" className="ops-form__submit" style={{ display: "inline-block", textDecoration: "none" }}>
                前往优惠码管理
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
