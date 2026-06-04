"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import type { ArbitrationEvidenceAttachmentUploadPlanView } from "@neuro/contracts";

type PreparedAttachmentUploadProps = {
  accept: string;
  buttonLabel?: string;
  className?: string;
  evidenceId: string;
  successMessage?: string;
};

type UploadState =
  | { kind: "idle"; message: null }
  | { kind: "uploading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || fallback;
}

export function PreparedAttachmentUpload({
  accept,
  buttonLabel = "上传附件",
  className = "app-form-grid",
  evidenceId,
  successMessage = "证据附件已通过浏览器直传。",
}: PreparedAttachmentUploadProps) {
  const router = useRouter();
  const [uploadState, setUploadState] = useState<UploadState>({ kind: "idle", message: null });
  const [isRefreshing, startRefresh] = useTransition();
  const busy = uploadState.kind === "uploading" || isRefreshing;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("attachment");

    if (!(file instanceof File) || file.size <= 0) {
      setUploadState({ kind: "error", message: "请选择有效的附件文件。" });
      return;
    }

    setUploadState({ kind: "uploading", message: "正在申请上传地址并直传附件..." });

    try {
      const prepareResponse = await fetch(
        `/api/arbitration-evidences/${encodeURIComponent(evidenceId)}/prepare-upload`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name || "evidence.bin",
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        },
      );

      if (!prepareResponse.ok) {
        throw new Error(await readErrorMessage(prepareResponse, "仲裁附件预签名上传初始化失败。"));
      }

      const preparePayload = (await prepareResponse.json()) as {
        upload?: ArbitrationEvidenceAttachmentUploadPlanView;
      };
      const uploadPlan = preparePayload.upload;
      if (!uploadPlan) {
        throw new Error("上传计划返回为空。");
      }

      const uploadResponse = await fetch(uploadPlan.uploadUrl, {
        method: uploadPlan.uploadMethod,
        headers: uploadPlan.requiredHeaders,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`远程上传失败，状态码 ${uploadResponse.status}。`);
      }

      if (uploadPlan.completeUploadRequired) {
        const completeResponse = await fetch(
          `/api/arbitration-attachments/${encodeURIComponent(uploadPlan.attachmentId)}/complete-upload`,
          {
            method: "POST",
          },
        );

        if (!completeResponse.ok) {
          throw new Error(await readErrorMessage(completeResponse, "仲裁附件上传确认失败。"));
        }
      }

      form.reset();
      setUploadState({ kind: "success", message: successMessage });
      startRefresh(() => {
        router.refresh();
      });
    } catch (error) {
      setUploadState({
        kind: "error",
        message: toErrorMessage(error, "证据附件上传失败，请稍后重试。"),
      });
    }
  }

  return (
    <div className="app-stack">
      <form className={className} onSubmit={handleSubmit}>
        <input
          accept={accept}
          className="mg-input"
          disabled={busy}
          name="attachment"
          required
          type="file"
        />
        <button className="mg-btn mg-btn--glass" disabled={busy} type="submit">
          {busy ? "上传中..." : buttonLabel}
        </button>
      </form>
      {uploadState.message ? (
        <p
          className={
            uploadState.kind === "error"
              ? "app-banner app-banner--error"
              : uploadState.kind === "success"
                ? "app-banner app-banner--success"
                : "app-note"
          }
        >
          {uploadState.message}
        </p>
      ) : null}
    </div>
  );
}
