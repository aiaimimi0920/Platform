import assert from "node:assert/strict";
import test from "node:test";

import { buildGatewayCatalogUnavailableNotice, buildGatewayDependencyUnavailableNotice } from "./gateway-catalog-notice";

test("gateway catalog notice turns fetch failures into an actionable operator message", () => {
  const notice = buildGatewayCatalogUnavailableNotice(new Error("fetch failed"), "http://127.0.0.1:4200");

  assert.equal(notice.title, "AI Gateway 内部服务未连接");
  assert.match(notice.body, /Gateway bundle 目录暂不可用/);
  assert.match(notice.body, /商品库存和优惠码管理仍可继续使用/);
  assert.match(notice.detail, /AI_GATEWAY_INTERNAL_URL=http:\/\/127\.0\.0\.1:4200/);
  assert.match(notice.detail, /原始错误：fetch failed/);
});

test("gateway catalog notice handles non-error failures without leaking object strings", () => {
  const notice = buildGatewayCatalogUnavailableNotice({ cause: "network" }, "http://gateway.internal:4200");

  assert.equal(notice.title, "AI Gateway 内部服务未连接");
  assert.match(notice.detail, /AI_GATEWAY_INTERNAL_URL=http:\/\/gateway\.internal:4200/);
  assert.doesNotMatch(notice.detail, /\[object Object\]/);
});

test("gateway dependency notice can describe provider inventory degradation", () => {
  const notice = buildGatewayDependencyUnavailableNotice(new Error("fetch failed"), {
    resourceName: "服务商库存",
    continuation: "已创建服务商列表暂不可用；创建服务商模板入口仍可打开。",
    gatewayInternalUrl: "http://127.0.0.1:4226",
  });

  assert.equal(notice.title, "AI Gateway 内部服务未连接");
  assert.match(notice.body, /服务商库存暂不可用/);
  assert.match(notice.body, /创建服务商模板入口仍可打开/);
  assert.match(notice.detail, /AI_GATEWAY_INTERNAL_URL=http:\/\/127\.0\.0\.1:4226/);
});

test("gateway dependency notice distinguishes gateway response errors from offline services", () => {
  const notice = buildGatewayDependencyUnavailableNotice(
    new Error('database error: error occurred while decoding column "request_count"'),
    {
      resourceName: "健康状态与用量聚合",
      continuation: "credential × model 状态机和 usage bucket 暂不可查看。",
      gatewayInternalUrl: "http://127.0.0.1:4226",
    },
  );

  assert.equal(notice.title, "AI Gateway 返回数据异常");
  assert.equal(notice.badgeLabel, "Gateway 接口异常");
  assert.equal(notice.badgeTone, "danger");
  assert.match(notice.detail, /Gateway 已响应/);
  assert.match(notice.detail, /数据库 schema 或迁移状态/);
  assert.doesNotMatch(notice.detail, /启动 AI Gateway 服务/);
});
