import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  getCoreAccountMissionProgress,
  getCoreAccountPlatformSummary,
  getCoreAccountProductSnapshot,
  listCoreAccountProductSnapshots,
} from "@/modules/account-integration/service";
import { HttpError } from "@/platform/errors";
import { withInternalRequest } from "@/platform/internal-auth";

const platformSummaryParamsSchema = z.object({
  userId: z.string().min(1),
});

const missionProgressQuerySchema = z.object({
  scope: z.enum(["daily", "weekly"]),
  from: z.string().min(1),
  to: z.string().min(1),
  keys: z.string().min(1),
});

function parseIsoDate(raw: string, fieldName: string) {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "BAD_REQUEST", `Invalid ${fieldName} timestamp`);
  }
  return date;
}

function parseMissionKeys(scope: "daily" | "weekly", raw: string) {
  const keys = Array.from(
    new Set(
      raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
  if (keys.length === 0) {
    throw new HttpError(400, "BAD_REQUEST", "Mission progress request requires at least one key");
  }

  const allowedKeys =
    scope === "daily"
      ? new Set(["taskApply", "productPurchase"])
      : new Set(["taskApply", "productPurchase", "opinionSupport"]);

  const invalidKeys = keys.filter((key) => !allowedKeys.has(key));
  if (invalidKeys.length > 0) {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      `Unsupported ${scope} mission progress keys: ${invalidKeys.join(", ")}`,
    );
  }

  return keys;
}

export const accountIntegrationRouter: FastifyPluginAsync = async (app) => {
  app.get<{ Params: z.infer<typeof platformSummaryParamsSchema> }>(
    "/internal/account/users/:userId/platform-summary",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId } = platformSummaryParamsSchema.parse(request.params);
      return {
        summary: await getCoreAccountPlatformSummary(userId),
      };
    },
  );

  app.get<{
    Params: z.infer<typeof platformSummaryParamsSchema>;
    Querystring: z.infer<typeof missionProgressQuerySchema>;
  }>(
    "/internal/account/users/:userId/mission-progress",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId } = platformSummaryParamsSchema.parse(request.params);
      const query = missionProgressQuerySchema.parse(request.query);
      const from = parseIsoDate(query.from, "from");
      const to = parseIsoDate(query.to, "to");

      if (from >= to) {
        throw new HttpError(400, "BAD_REQUEST", "`from` must be earlier than `to`");
      }

      if (query.scope === "daily") {
        return {
          progress: await getCoreAccountMissionProgress({
            userId,
            scope: "daily",
            from,
            to,
            keys: parseMissionKeys("daily", query.keys) as Array<"taskApply" | "productPurchase">,
          }),
        };
      }

      return {
        progress: await getCoreAccountMissionProgress({
          userId,
          scope: "weekly",
          from,
          to,
          keys: parseMissionKeys("weekly", query.keys) as Array<
            "taskApply" | "productPurchase" | "opinionSupport"
          >,
        }),
      };
    },
  );

  app.get<{ Params: { productId: string } }>(
    "/internal/account/products/:productId",
    { preHandler: withInternalRequest },
    async (request) => {
      return {
        product: await getCoreAccountProductSnapshot(request.params.productId),
      };
    },
  );

  app.get(
    "/internal/account/products",
    { preHandler: withInternalRequest },
    async () => ({
      products: await listCoreAccountProductSnapshots(),
    }),
  );
};
