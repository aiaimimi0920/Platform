import { auth } from "@/auth";
import { completeArbitrationEvidenceAttachmentUpload } from "@/lib/core-client";

type RouteContext = {
  params: Promise<{
    attachmentId: string;
  }>;
};

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attachmentId } = await context.params;

  try {
    await completeArbitrationEvidenceAttachmentUpload(
      {
        userId: session.user.id,
        username: session.user.username,
      },
      attachmentId,
    );

    return Response.json(
      { ok: true },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: toErrorMessage(error, "仲裁附件上传确认失败。"),
      },
      { status: 400 },
    );
  }
}
