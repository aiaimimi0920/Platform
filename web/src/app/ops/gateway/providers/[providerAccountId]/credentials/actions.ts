"use server";

import {
  createOperatorGatewayProviderCredential,
  deleteOperatorGatewayProviderCredential,
  exportOperatorGatewayProviderCredentialsToFolder,
  getOperatorGatewayProviderAccount,
  importOperatorGatewayProviderCredentialsFromFolder,
  patchOperatorGatewayProviderCredential,
  refreshOperatorGatewayProviderCredentialQuota,
  setOperatorGatewayProviderCredentialFolderSyncEnabled,
  updateOperatorGatewayProviderAccount,
} from "@/lib/account-client";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  appendProviderCredentialOperatorWarningMessage,
  getProviderCredentialOperatorWarning,
} from "../../provider-create-catalog";
import {
  isLumalabsCompatibleAdapter,
  mergeLumalabsContractIntoPayload,
  readLumalabsContractFromFormData,
} from "../../lumalabs-contract";

function toMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function resolveRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

function buildStatusRedirect(redirectTo: string, status: "success" | "error", message: string) {
  const params = new URLSearchParams({ status, message });
  const [pathname, hash] = redirectTo.split("#", 2);
  return `${pathname}${pathname.includes("?") ? "&" : "?"}${params.toString()}${hash ? `#${hash}` : ""}`;
}

function readOptionalText(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function parseJsonObject(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error(`${label} 不能为空。`);
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON object。`);
  }
  return parsed as Record<string, unknown>;
}

function sanitizeCredentialFilename(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim();
}

function sanitizeCredentialPath(value: string) {
  return value
    .split(/[\\/]+/)
    .map((segment) => sanitizeCredentialFilename(segment))
    .filter(Boolean)
    .join("/");
}

function toNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type UploadedCredentialManifestEntry = {
  name?: string | null;
  size?: number | null;
  lastModified?: number | null;
  relativePath?: string | null;
};

type UploadedCredentialFileInput = {
  file: File;
  sourcePathHint?: string | null;
};

function parseUploadedFileManifest(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return [] as UploadedCredentialManifestEntry[];
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("上传文件清单格式无效。");
  }
  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return {};
    }
    const objectEntry = entry as Record<string, unknown>;
    return {
      name: toNonEmptyString(objectEntry.name),
      size: typeof objectEntry.size === "number" ? objectEntry.size : null,
      lastModified: typeof objectEntry.lastModified === "number" ? objectEntry.lastModified : null,
      relativePath: toNonEmptyString(objectEntry.relativePath),
    } satisfies UploadedCredentialManifestEntry;
  });
}

function uploadedFileSourcePath(file: File, sourcePathHint?: string | null) {
  const extended = file as File & { webkitRelativePath?: string; relativePath?: string };
  const raw =
    toNonEmptyString(sourcePathHint) ??
    toNonEmptyString(extended.webkitRelativePath) ??
    toNonEmptyString(extended.relativePath) ??
    toNonEmptyString(file.name);
  return raw ? sanitizeCredentialPath(raw) : null;
}

function fallbackCredentialLabelFromFile(file: File, sourcePathHint?: string | null) {
  const sourcePath = uploadedFileSourcePath(file, sourcePathHint) ?? sanitizeCredentialFilename(file.name);
  const segments = sourcePath.split("/").filter(Boolean);
  const leaf = segments[segments.length - 1] ?? sourcePath;
  return sanitizeCredentialFilename(leaf.replace(/\.json$/i, "")) || "上传凭证";
}

function inferCredentialLabel(credential: Record<string, unknown>, fallback: string) {
  return (
    toNonEmptyString(credential.label) ??
    toNonEmptyString(credential.accountLabel) ??
    toNonEmptyString(credential.account_label) ??
    toNonEmptyString(credential.name) ??
    fallback
  );
}

type CredentialCreateInput = {
  label: string;
  status?: string | null;
  credential: Record<string, unknown>;
  sourcePath?: string | null;
};

function normalizeBatchCredentialEntry(entry: unknown, index: number): CredentialCreateInput {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`批量凭证第 ${index + 1} 项必须是 JSON object。`);
  }
  const objectEntry = entry as Record<string, unknown>;
  const explicitCredential =
    objectEntry.credential && typeof objectEntry.credential === "object" && !Array.isArray(objectEntry.credential)
      ? (objectEntry.credential as Record<string, unknown>)
      : null;

  const credential =
    explicitCredential ??
    Object.fromEntries(
      Object.entries(objectEntry).filter(
        ([key]) =>
          ![
            "label",
            "status",
            "sourcePath",
            "source_path",
            "sourceKind",
            "source_kind",
            "syncMode",
            "sync_mode",
            "syncState",
            "sync_state",
            "syncError",
            "sync_error",
          ].includes(key),
      ),
    );

  if (!credential || Object.keys(credential).length === 0) {
    throw new Error(`批量凭证第 ${index + 1} 项缺少 credential 内容。`);
  }

  return {
    label: toNonEmptyString(objectEntry.label) ?? inferCredentialLabel(credential, `凭证 ${index + 1}`),
    status: toNonEmptyString(objectEntry.status) ?? "active",
    sourcePath: toNonEmptyString(objectEntry.sourcePath) ?? toNonEmptyString(objectEntry.source_path),
    credential,
  };
}

function parseCredentialBatchJson(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error("批量凭证 JSON 不能为空。");
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("批量凭证 JSON 必须是非空数组。");
  }
  return parsed.map((entry, index) => normalizeBatchCredentialEntry(entry, index));
}

async function parseUploadedCredentialFile(
  file: File,
  fallbackLabel: string,
  options?: { allowArray?: boolean; sourcePathHint?: string | null },
) {
  const raw = await file.text();
  if (!raw.trim()) {
    throw new Error(`文件 ${file.name} 内容为空。`);
  }
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    if (!options?.allowArray) {
      throw new Error(`文件 ${file.name} 不是单个凭证对象。`);
    }
    const baseSourcePath =
      uploadedFileSourcePath(file, options?.sourcePathHint) ?? sanitizeCredentialFilename(file.name);
    return parsed.map((entry, index) => {
      const normalized = normalizeBatchCredentialEntry(entry, index);
      return {
        ...normalized,
        sourcePath: normalized.sourcePath ?? `${baseSourcePath}#${index + 1}`,
      };
    });
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`文件 ${file.name} 必须是 JSON object。`);
  }
  const credential = parsed as Record<string, unknown>;
  return [
    {
      label: inferCredentialLabel(credential, fallbackLabel),
      status: "active",
      sourcePath:
        uploadedFileSourcePath(file, options?.sourcePathHint) ?? sanitizeCredentialFilename(file.name),
      credential,
    },
  ];
}

function dedupeUploadedFiles(files: UploadedCredentialFileInput[]) {
  const seen = new Set<string>();
  const result: UploadedCredentialFileInput[] = [];
  for (const input of files) {
    const { file, sourcePathHint } = input;
    const signature = [
      uploadedFileSourcePath(file, sourcePathHint) ?? file.name,
      String(file.size),
      String(file.lastModified),
    ].join("::");
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    result.push(input);
  }
  return result;
}

function collectUploadedFilesWithManifest(
  formData: FormData,
  fieldName: string,
  manifestFieldName: string,
) {
  const files = formData
    .getAll(fieldName)
    .filter((file): file is File => file instanceof File && Boolean(file.name));
  const manifest = parseUploadedFileManifest(formData.get(manifestFieldName));

  return files.map((file, index) => {
    const manifestEntry = manifest[index];
    const matchesFile =
      manifestEntry &&
      (!manifestEntry.name || manifestEntry.name === file.name) &&
      (manifestEntry.size == null || manifestEntry.size === file.size) &&
      (manifestEntry.lastModified == null || manifestEntry.lastModified === file.lastModified);
    return {
      file,
      sourcePathHint: matchesFile ? manifestEntry.relativePath : null,
    } satisfies UploadedCredentialFileInput;
  });
}

async function createCredentialsAndActivate(
  userContext: Awaited<ReturnType<typeof requirePlatformOperatorUserContext>>,
  providerAccountId: string,
  providerProtocolProfile: string,
  inputs: CredentialCreateInput[],
) {
  const createdLabels: string[] = [];
  const warnings = new Set<string>();
  for (const input of inputs) {
    const credential = await createOperatorGatewayProviderCredential(userContext, providerAccountId, {
      label: input.label,
      status: input.status ?? "active",
      credential: input.credential,
      sourceKind: "manual",
      sourcePath: input.sourcePath ?? null,
      syncMode: "manual",
      syncState: "idle",
      syncError: null,
    });
    createdLabels.push(credential.label);
    const warning = getProviderCredentialOperatorWarning(providerProtocolProfile, input.credential);
    if (warning) {
      warnings.add(warning);
    }
  }
  const activated = inputs.length ? await activateProviderAccountIfNeeded(userContext, providerAccountId) : false;
  return { createdLabels, activated, warnings: Array.from(warnings) };
}

async function activateProviderAccountIfNeeded(
  userContext: Awaited<ReturnType<typeof requirePlatformOperatorUserContext>>,
  providerAccountId: string,
) {
  const { providerAccount } = await getOperatorGatewayProviderAccount(userContext, providerAccountId);
  if (providerAccount.status === "active") {
    return false;
  }
  await updateOperatorGatewayProviderAccount(userContext, providerAccountId, {
    label: providerAccount.label,
    adapter: providerAccount.adapter,
    protocolFamily: providerAccount.protocolFamily,
    status: "active",
    sourceProfile: {
      sourceKind: providerAccount.sourceProfile.sourceKind,
      aggregatorApiMode: providerAccount.sourceProfile.aggregatorApiMode,
      webReverseAccessMode: providerAccount.sourceProfile.webReverseAccessMode,
      notes: providerAccount.sourceProfile.notes,
    },
    executionMode: providerAccount.executionMode,
    endpointExecutionModes: providerAccount.endpointExecutionModes,
    payload: providerAccount.payload,
  });
  return true;
}

async function resolveProviderAccountForCredentialMutation(
  userContext: Awaited<ReturnType<typeof requirePlatformOperatorUserContext>>,
  providerAccountId: string,
) {
  const { providerAccount } = await getOperatorGatewayProviderAccount(userContext, providerAccountId);
  return providerAccount;
}

export async function createGatewayProviderCredentialAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  if (!providerAccountId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商标识。"));
  }

  try {
    const providerAccount = await resolveProviderAccountForCredentialMutation(userContext, providerAccountId);
    const credentialJson = parseJsonObject(formData.get("credentialJson"), "凭证 JSON");
    const credentialPayload = isLumalabsCompatibleAdapter(providerAccount.adapter)
      ? mergeLumalabsContractIntoPayload(credentialJson, readLumalabsContractFromFormData(formData))
      : credentialJson;
    const credential = await createOperatorGatewayProviderCredential(userContext, providerAccountId, {
      label: String(formData.get("label") || "").trim(),
      status: readOptionalText(formData.get("status")),
      credential: credentialPayload,
      sourceKind: readOptionalText(formData.get("sourceKind")),
      sourcePath: readOptionalText(formData.get("sourcePath")),
      syncMode: readOptionalText(formData.get("syncMode")),
      syncState: readOptionalText(formData.get("syncState")),
      syncError: readOptionalText(formData.get("syncError")),
    });
    const activated = await activateProviderAccountIfNeeded(userContext, providerAccountId);
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        appendProviderCredentialOperatorWarningMessage(
          activated ? `已创建凭证 ${credential.label}，服务商已启用。` : `已创建凭证 ${credential.label}。`,
          providerAccount.protocolProfile,
          credentialPayload,
        ),
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "创建服务商凭证失败。")));
  }
}

export async function createGatewayProviderCredentialBatchAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  if (!providerAccountId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商标识。"));
  }

  try {
    const providerAccount = await resolveProviderAccountForCredentialMutation(userContext, providerAccountId);
    const entries = parseCredentialBatchJson(formData.get("credentialBatchJson"));
    const result = await createCredentialsAndActivate(
      userContext,
      providerAccountId,
      providerAccount.protocolProfile,
      entries,
    );
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        result.warnings.length
          ? `${result.activated ? `已新增 ${result.createdLabels.length} 条凭证，服务商已启用。` : `已新增 ${result.createdLabels.length} 条凭证。`} 注意：${result.warnings.join(" ")}`
          : result.activated
            ? `已新增 ${result.createdLabels.length} 条凭证，服务商已启用。`
            : `已新增 ${result.createdLabels.length} 条凭证。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "批量创建服务商凭证失败。")));
  }
}

export async function uploadSingleGatewayProviderCredentialAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  if (!providerAccountId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商标识。"));
  }

  try {
    const providerAccount = await resolveProviderAccountForCredentialMutation(userContext, providerAccountId);
    const file = formData.get("credentialFile");
    if (!(file instanceof File) || !file.name) {
      throw new Error("请上传一个凭证文件。");
    }
    const labelOverride = readOptionalText(formData.get("label"));
    const entries = await parseUploadedCredentialFile(
      file,
      labelOverride ?? fallbackCredentialLabelFromFile(file),
    );
    if (labelOverride) {
      entries[0].label = labelOverride;
    }
    const result = await createCredentialsAndActivate(
      userContext,
      providerAccountId,
      providerAccount.protocolProfile,
      entries,
    );
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        result.warnings.length
          ? `${result.activated ? `已上传凭证 ${result.createdLabels[0]}，服务商已启用。` : `已上传凭证 ${result.createdLabels[0]}。`} 注意：${result.warnings.join(" ")}`
          : result.activated
            ? `已上传凭证 ${result.createdLabels[0]}，服务商已启用。`
            : `已上传凭证 ${result.createdLabels[0]}。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "上传服务商凭证失败。")));
  }
}

export async function uploadBatchGatewayProviderCredentialsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  if (!providerAccountId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商标识。"));
  }

  try {
    const providerAccount = await resolveProviderAccountForCredentialMutation(userContext, providerAccountId);
    const files = dedupeUploadedFiles(
      [
        ...collectUploadedFilesWithManifest(formData, "credentialFiles", "credentialFilesManifestJson"),
        ...collectUploadedFilesWithManifest(
          formData,
          "credentialFolderFiles",
          "credentialFolderFilesManifestJson",
        ),
      ],
    );
    if (!files.length) {
      throw new Error("请至少上传一个凭证文件。");
    }
    const entries: CredentialCreateInput[] = [];
    for (const input of files) {
      const parsedEntries = await parseUploadedCredentialFile(
        input.file,
        fallbackCredentialLabelFromFile(input.file, input.sourcePathHint),
        { allowArray: true, sourcePathHint: input.sourcePathHint },
      );
      entries.push(...parsedEntries);
    }
    const result = await createCredentialsAndActivate(
      userContext,
      providerAccountId,
      providerAccount.protocolProfile,
      entries,
    );
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        result.warnings.length
          ? `${result.activated ? `已上传 ${result.createdLabels.length} 条凭证，服务商已启用。` : `已上传 ${result.createdLabels.length} 条凭证。`} 注意：${result.warnings.join(" ")}`
          : result.activated
            ? `已上传 ${result.createdLabels.length} 条凭证，服务商已启用。`
            : `已上传 ${result.createdLabels.length} 条凭证。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "批量上传服务商凭证失败。")));
  }
}

export async function patchGatewayProviderCredentialAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const providerCredentialId = String(formData.get("providerCredentialId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  if (!providerAccountId || !providerCredentialId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商或凭证标识。"));
  }

  try {
    const credentialJson = readOptionalText(formData.get("credentialJson"));
    const providerAccount = await resolveProviderAccountForCredentialMutation(userContext, providerAccountId);
    const parsedCredential =
      credentialJson != null ? parseJsonObject(credentialJson, "凭证 JSON") : null;
    const credentialPayload =
      parsedCredential && isLumalabsCompatibleAdapter(providerAccount.adapter)
        ? mergeLumalabsContractIntoPayload(parsedCredential, readLumalabsContractFromFormData(formData))
        : parsedCredential;
    const credential = await patchOperatorGatewayProviderCredential(userContext, providerCredentialId, {
      providerAccountId,
      label: readOptionalText(formData.get("label")),
      status: readOptionalText(formData.get("status")),
      credential: credentialPayload,
      sourceKind: readOptionalText(formData.get("sourceKind")),
      sourcePath: readOptionalText(formData.get("sourcePath")),
      syncMode: readOptionalText(formData.get("syncMode")),
      syncState: readOptionalText(formData.get("syncState")),
      syncError: readOptionalText(formData.get("syncError")),
    });
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        appendProviderCredentialOperatorWarningMessage(
          `已更新凭证 ${credential.label}。`,
          providerAccount.protocolProfile,
          credentialPayload,
        ),
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "更新服务商凭证失败。")));
  }
}

export async function toggleGatewayProviderCredentialStatusAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const providerCredentialId = String(formData.get("providerCredentialId") || "").trim();
  const currentStatus = String(formData.get("currentStatus") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  if (!providerAccountId || !providerCredentialId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商或凭证标识。"));
  }

  const nextStatus = currentStatus === "active" ? "disabled" : "active";

  try {
    const credential = await patchOperatorGatewayProviderCredential(userContext, providerCredentialId, {
      providerAccountId,
      status: nextStatus,
    });
    const activated =
      nextStatus === "active" ? await activateProviderAccountIfNeeded(userContext, providerAccountId) : false;
    const message =
      nextStatus === "active"
        ? activated
          ? `已启用凭证 ${credential.label}，服务商已同步启用。`
          : `已启用凭证 ${credential.label}。`
        : `已关闭凭证 ${credential.label}。`;
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "切换服务商凭证状态失败。")));
  }
}

export async function deleteGatewayProviderCredentialAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const providerCredentialId = String(formData.get("providerCredentialId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  if (!providerAccountId || !providerCredentialId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商或凭证标识。"));
  }

  try {
    await deleteOperatorGatewayProviderCredential(userContext, providerCredentialId);
    redirect(buildStatusRedirect(redirectTo, "success", "服务商凭证已删除。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "删除服务商凭证失败。")));
  }
}

export async function refreshGatewayProviderCredentialQuotaAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const providerCredentialId = String(formData.get("providerCredentialId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  if (!providerAccountId || !providerCredentialId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商或凭证标识。"));
  }

  try {
    const quota = await refreshOperatorGatewayProviderCredentialQuota(userContext, providerCredentialId);
    const message = quota
      ? `凭证额度已刷新：${quota.status}${quota.representativeClaim ? ` · ${quota.representativeClaim}` : ""}`
      : "当前凭证未声明可读取的额度接口。";
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "刷新凭证额度失败。")));
  }
}

export async function importGatewayProviderCredentialsFromFolderAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  try {
    const status = await importOperatorGatewayProviderCredentialsFromFolder(userContext);
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `文件夹导入完成：新增 ${status.importedCount} 条，更新 ${status.updatedCount} 条。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "执行文件夹导入失败。")));
  }
}

export async function toggleGatewayProviderCredentialFolderSyncAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );
  const nextEnabled = String(formData.get("nextEnabled") || "").trim() === "true";

  try {
    await setOperatorGatewayProviderCredentialFolderSyncEnabled(userContext, nextEnabled);
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        nextEnabled ? "已启用文件夹同步模式。" : "已停用文件夹同步模式。",
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "切换文件夹同步模式失败。")));
  }
}

export async function exportGatewayProviderCredentialsToFolderAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const redirectTo = resolveRedirectPath(
    formData.get("redirectTo"),
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`,
  );

  try {
    const status = await exportOperatorGatewayProviderCredentialsToFolder(userContext);
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `文件夹导出完成：导出 ${status.exportedCount} 条，删除 ${status.deletedCount} 条。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "执行文件夹导出失败。")));
  }
}
