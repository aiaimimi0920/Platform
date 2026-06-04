import type { FastifyPluginAsync } from "fastify";

import {
  acceptMailgunInboundWebhook,
  env as accountEnv,
  verifyMailgunWebhookSignature,
} from "@neuro/account-domain";
import { requireModuleEnabled } from "@neuro/backend-foundation/platform/feature-modules/service";
import { HttpError } from "@neuro/backend-foundation/platform/errors";

type MailgunFieldMap = Record<string, string>;

type MailgunAttachmentMetadata = {
  fieldName: string;
  filename: string | null;
  contentType: string | null;
  sizeBytes: number;
};

async function countFilePartBytes(stream: AsyncIterable<Buffer | string>) {
  let sizeBytes = 0;
  for await (const chunk of stream) {
    sizeBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
  }
  return sizeBytes;
}

async function collectMailgunMultipartPayload(request: any): Promise<{
  fields: MailgunFieldMap;
  attachments: MailgunAttachmentMetadata[];
}> {
  const fields: MailgunFieldMap = {};
  const attachments: MailgunAttachmentMetadata[] = [];

  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === "file") {
      const sizeBytes = await countFilePartBytes(part.file);
      attachments.push({
        fieldName: part.fieldname,
        filename: typeof part.filename === "string" ? part.filename : null,
        contentType: typeof part.mimetype === "string" ? part.mimetype : null,
        sizeBytes,
      });
      continue;
    }

    fields[part.fieldname] = typeof part.value === "string" ? part.value : String(part.value ?? "");
  }

  return {
    fields,
    attachments,
  };
}

export const emailProviderIngressRouter: FastifyPluginAsync = async (app) => {
  app.post("/v1/public/email-ingress/providers/mailgun", async (request, reply) => {
    await requireModuleEnabled("identity");

    if (!accountEnv.mailgunIngressSigningKey) {
      throw new HttpError(503, "BAD_REQUEST", "Mailgun ingress signing key is not configured");
    }

    const { fields, attachments } = await collectMailgunMultipartPayload(request);
    const verification = verifyMailgunWebhookSignature({
      signingKey: accountEnv.mailgunIngressSigningKey,
      timestamp: fields.timestamp,
      token: fields.token,
      signature: fields.signature,
      maxAgeSeconds: accountEnv.emailIngressSignatureMaxAgeSeconds,
    });

    if (!verification.ok) {
      throw new HttpError(401, "UNAUTHORIZED", `Invalid Mailgun signature: ${verification.reason}`);
    }

    const result = await acceptMailgunInboundWebhook({
      fields,
      attachments,
      receivedAt: new Date().toISOString(),
    });

    return reply.code(result.duplicate ? 200 : 202).send({
      accepted: true,
      duplicate: result.duplicate,
      provider: "mailgun",
      providerInboundMessageId: result.message.id,
    });
  });
};
