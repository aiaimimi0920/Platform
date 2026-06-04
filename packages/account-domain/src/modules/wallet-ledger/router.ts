import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { exchangeObsidianToMira, getWalletPanel, getWalletSummary } from "@/modules/wallet-ledger/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

export const walletLedgerRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/me/wallet/panel", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("wallet");
    await requireModuleEnabled("ledger");
    const { userId } = assertUserContext(request);
    return {
      panel: await getWalletPanel(userId),
    };
  });

  app.get("/v1/me/wallet", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("wallet");
    await requireModuleEnabled("ledger");
    const { userId } = assertUserContext(request);
    return {
      wallet: await getWalletSummary(userId),
    };
  });

  const exchangeSchema = z.object({
    direction: z.literal("obsidian_to_mira"),
    amount: z.number().int().positive(),
  });

  app.post<{ Body: z.infer<typeof exchangeSchema> }>(
    "/v1/me/wallet/exchange",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      return {
        exchange: await exchangeObsidianToMira(userId, exchangeSchema.parse(request.body)),
      };
    },
  );
};
