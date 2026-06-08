import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { GatewayDependencyUnavailableCard } from "./gateway-dependency-unavailable-card";

test("gateway dependency card renders an actionable outage notice", () => {
  const markup = renderToStaticMarkup(
    <GatewayDependencyUnavailableCard
      notice={{
        title: "AI Gateway 内部服务未连接",
        body: "请求追踪暂不可用；其他运营页面仍可继续使用。",
        detail: "请检查 AI_GATEWAY_INTERNAL_URL=http://127.0.0.1:4226 或启动 AI Gateway 服务。原始错误：fetch failed",
      }}
    />,
  );

  assert.match(markup, /依赖服务未连接/);
  assert.match(markup, /AI Gateway 内部服务未连接/);
  assert.match(markup, /请求追踪暂不可用/);
  assert.match(markup, /AI_GATEWAY_INTERNAL_URL=http:\/\/127\.0\.0\.1:4226/);
});

test("gateway dependency card can render a recovery action", () => {
  const markup = renderToStaticMarkup(
    <GatewayDependencyUnavailableCard
      notice={{
        title: "AI Gateway 内部服务未连接",
        body: "模型别名暂不可用；创建服务商模板入口仍可打开。",
        detail: "请检查 AI_GATEWAY_INTERNAL_URL=http://127.0.0.1:4226 或启动 AI Gateway 服务。原始错误：fetch failed",
      }}
      action={{ href: "/ops/gateway/providers/create", label: "打开创建服务商模板" }}
    />,
  );

  assert.match(markup, /href="\/ops\/gateway\/providers\/create"/);
  assert.match(markup, /打开创建服务商模板/);
});

test("gateway dependency card can render gateway response error notices", () => {
  const markup = renderToStaticMarkup(
    <GatewayDependencyUnavailableCard
      notice={{
        title: "AI Gateway 返回数据异常",
        body: "健康状态与用量聚合暂不可用；其他运营页面仍可继续使用。",
        detail: "AI Gateway 已响应，但健康状态与用量聚合接口返回错误；请检查 Gateway 日志、数据库 schema 或迁移状态。原始错误：database error",
        badgeLabel: "Gateway 接口异常",
        badgeTone: "danger",
      }}
    />,
  );

  assert.match(markup, /Gateway 接口异常/);
  assert.match(markup, /AI Gateway 返回数据异常/);
  assert.doesNotMatch(markup, /依赖服务未连接/);
});
