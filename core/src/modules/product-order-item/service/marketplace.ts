import { eq } from "drizzle-orm";
import { items } from "@/modules/product-order-item/schema";
import { BadRequestError } from "@/platform/errors";
import { type DbTx } from "./shared";

export async function markItemListed(args: {
  tx: DbTx;
  itemId: string;
  ownerUserId: string;
}) {
  const [item] = await args.tx.select().from(items).where(eq(items.id, args.itemId));

  if (!item || item.userId !== args.ownerUserId) {
    throw new BadRequestError("资产不存在或不属于当前用户");
  }
  if (item.fulfillmentMode === "maintained_pool" || item.fulfillmentMode === "warranty_delivery") {
    throw new BadRequestError("服务型履约资产当前不可流转");
  }
  if (!item.transferable) {
    throw new BadRequestError("该资产不可流转");
  }
  if (item.status !== "active") {
    throw new BadRequestError("该资产当前不可挂牌");
  }

  await args.tx.update(items).set({ status: "listed" }).where(eq(items.id, item.id));
  return item;
}

export async function releaseListedItem(args: {
  tx: DbTx;
  itemId: string;
  ownerUserId: string;
}) {
  const [item] = await args.tx.select().from(items).where(eq(items.id, args.itemId));

  if (!item || item.userId !== args.ownerUserId) {
    throw new BadRequestError("资产不存在或不属于当前用户");
  }

  await args.tx.update(items).set({ status: "active" }).where(eq(items.id, item.id));
}

export async function transferMarketplaceItem(args: {
  tx: DbTx;
  itemId: string;
  expectedSellerUserId: string;
  buyerUserId: string;
}) {
  const [item] = await args.tx.select().from(items).where(eq(items.id, args.itemId));

  if (!item || item.userId !== args.expectedSellerUserId || item.status !== "listed") {
    throw new BadRequestError("资产状态已变化，无法完成转移");
  }
  if (item.fulfillmentMode === "maintained_pool" || item.fulfillmentMode === "warranty_delivery") {
    throw new BadRequestError("服务型履约资产当前不可流转");
  }

  await args.tx
    .update(items)
    .set({
      userId: args.buyerUserId,
      status: "active",
    })
    .where(eq(items.id, item.id));
}
