import { auth } from "@/auth";
import { prepareArbitrationEvidenceAttachmentUpload } from "@/lib/core-client";

type RouteContext = {
  params: Promise<{
    evidenceId: string;
  }>;
};

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        fileName?: string;
        contentType?: string;
        sizeBytes?: number;
      }
    | null;

  const { evidenceId } = await context.params;

  try {
    const response = await prepareArbitrationEvidenceAttachmentUpload(
      {
        userId: session.user.id,
        username: session.user.username,
      },
      evidenceId,
      {
        fileName: body?.fileName ?? "",
        contentType: body?.contentType ?? "",
        sizeBytes: body?.sizeBytes ?? 0,
      },
    );

    if ("authorization" in response.upload.requiredHeaders) {
      return Response.json(
        {
          error: "当前仲裁附件上传计划依赖服务端凭证，web 不会把该凭证下发到浏览器。请切到预签名 PUT 对象存储路径后再启用浏览器直传。",
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        upload: response.upload,
      },
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
        error: toErrorMessage(error, "仲裁附件预签名上传初始化失败。"),
      },
      { status: 400 },
    );
  }
}
