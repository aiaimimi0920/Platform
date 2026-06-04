"use server";

import type { PublicSurfaceSnapshot } from "@neuro/contracts";
import { revalidatePath } from "next/cache";

import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { updatePublicSurfaceSnapshot } from "@/lib/core-client";
import { PUBLIC_SURFACE_DEFINITIONS } from "@/lib/public-surface-visibility";

export type PublicSurfaceVisibilityActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  snapshot: PublicSurfaceSnapshot | null;
  submittedAt: number;
};

function toMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export async function savePublicSurfaceVisibilityAction(
  _previousState: PublicSurfaceVisibilityActionState,
  formData: FormData,
): Promise<PublicSurfaceVisibilityActionState> {
  await requirePlatformOperatorUserContext();
  const submittedAt = Date.now();

  try {
    const nextSnapshot = await updatePublicSurfaceSnapshot(
      PUBLIC_SURFACE_DEFINITIONS.map((definition) => ({
        surfaceKey: definition.key,
        enabled: formData.get(`surface:${definition.key}`) === "on",
      })),
    );

    revalidatePath("/", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/products");
    revalidatePath("/marketplace");
    revalidatePath("/redeem");
    revalidatePath("/mailbox");
    revalidatePath("/benefits");
    revalidatePath("/projects");
    revalidatePath("/opinions");
    revalidatePath("/chat");
    revalidatePath("/agents");
    revalidatePath("/my-agents");
    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    revalidatePath("/wallet");
    revalidatePath("/growth");
    revalidatePath("/reputation");
    revalidatePath("/inventory");
    revalidatePath("/arbitrations");
    revalidatePath("/ops/account/surface-visibility");

    return {
      status: "success",
      message: "对外展示开关已保存。普通访问者会立即看到最新入口；管理员与 Local Dev 仍保持全显。",
      snapshot: nextSnapshot,
      submittedAt,
    };
  } catch (error) {
    return {
      status: "error",
      message: toMessage(error, "保存对外展示开关失败。"),
      snapshot: null,
      submittedAt,
    };
  }
}
