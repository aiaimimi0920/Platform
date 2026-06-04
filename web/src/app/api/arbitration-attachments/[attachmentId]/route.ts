import { auth } from "@/auth";

type RouteContext = {
  params: Promise<{
    attachmentId: string;
  }>;
};

function buildHeaders(userId: string, username?: string | null) {
  const headers: Record<string, string> = {
    "x-internal-api-token": process.env.INTERNAL_API_TOKEN || "",
    "x-neuro-user-id": userId,
  };

  if (username) {
    headers["x-neuro-username"] = username;
  }

  return headers;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { attachmentId } = await context.params;
  const coreInternalUrl = process.env.CORE_INTERNAL_URL || "http://127.0.0.1:4000";
  const accessResponse = await fetch(`${coreInternalUrl}/v1/arbitrations/attachments/${attachmentId}/access`, {
    method: "GET",
    headers: buildHeaders(session.user.id, session.user.username),
    cache: "no-store",
    redirect: "manual",
  });

  if (accessResponse.ok) {
    const payload = (await accessResponse.json().catch(() => null)) as
      | { access?: { url?: string } | null }
      | null;
    const url = payload?.access?.url;
    if (url) {
      return Response.redirect(url, 302);
    }
  }

  const response = await fetch(`${coreInternalUrl}/v1/arbitrations/attachments/${attachmentId}/content`, {
    method: "GET",
    headers: buildHeaders(session.user.id, session.user.username),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/octet-stream",
      "content-disposition": response.headers.get("content-disposition") || "attachment",
      "cache-control": "private, no-store",
    },
  });
}
