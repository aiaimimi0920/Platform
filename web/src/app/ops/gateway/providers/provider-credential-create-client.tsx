"use client";

import type { GatewayProviderAccountView } from "@/lib/account-client";
import { NtCard, NtPanel } from "@/components/nt-primitives";
import type { ChangeEvent, CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";

import {
  createGatewayProviderCredentialAction,
  createGatewayProviderCredentialBatchAction,
  uploadBatchGatewayProviderCredentialsAction,
  uploadSingleGatewayProviderCredentialAction,
} from "./[providerAccountId]/credentials/actions";
import { getProviderCreateDefaults } from "./provider-create-catalog";
import {
  isLumalabsCompatibleAdapter,
  LUMALABS_CONTRACT_FIELD_DEFINITIONS,
} from "./lumalabs-contract";

type ProviderCredentialCreateMode = "manual_single" | "manual_batch" | "upload_single" | "upload_batch";

const MODE_OPTIONS: Array<{ value: ProviderCredentialCreateMode; label: string }> = [
  { value: "manual_single", label: "手动填写 1 个凭证" },
  { value: "manual_batch", label: "手动批量填写" },
  { value: "upload_single", label: "手动上传 1 个凭证" },
  { value: "upload_batch", label: "手动批量上传凭证" },
];

/*
 * This is a client component, so every inline style object literal used to allocate a new
 * object on each render. Layout now runs through the shared `nt-` utilities and the few
 * values with no utility live in module-scope constants, allocated once.
 */
const PAGE_STACK_STYLE: CSSProperties = { gap: 20 };
const AUTOFIT_260 = { "--nt-autofit-min": "260px" } as CSSProperties;
const PROVIDER_TITLE_STYLE: CSSProperties = { fontSize: "1.08rem" };
const FIELD_HINT_STYLE: CSSProperties = { fontSize: "0.82rem" };
const DIRECTORY_UPLOAD_PROPS = { directory: "", webkitdirectory: "" } as Record<string, string>;

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

type BrowserFileWithRelativePath = File & {
  webkitRelativePath?: string;
};

function buildUploadManifest(files: FileList | null) {
  return JSON.stringify(
    Array.from(files ?? []).map((file) => {
      const extendedFile = file as BrowserFileWithRelativePath;
      return {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        relativePath: extendedFile.webkitRelativePath || file.name,
      };
    }),
  );
}

function prettyBatchCredentialJson(defaultCredentialDraft?: Record<string, unknown>) {
  return JSON.stringify(
    [
      {
        label: "Credential A",
        credential: defaultCredentialDraft ?? {},
      },
    ],
    null,
    2,
  );
}

export function ProviderCredentialCreateClient(props: {
  providerAccount: GatewayProviderAccountView;
  redirectTo: string;
}) {
  const [mode, setMode] = useState<ProviderCredentialCreateMode>("manual_single");
  const [credentialFilesManifestJson, setCredentialFilesManifestJson] = useState("[]");
  const [credentialFolderFilesManifestJson, setCredentialFolderFilesManifestJson] = useState("[]");
  const isLumalabs = isLumalabsCompatibleAdapter(props.providerAccount.adapter);
  const createDefaults = useMemo(
    () =>
      getProviderCreateDefaults(
        props.providerAccount.adapter,
        props.providerAccount.protocolFamily,
        props.providerAccount.protocolProfile,
      ),
    [
      props.providerAccount.adapter,
      props.providerAccount.protocolFamily,
      props.providerAccount.protocolProfile,
    ],
  );
  const singleCredentialJson = useMemo(
    () => prettyJson(createDefaults.defaultCredentialDraft ?? {}),
    [createDefaults.defaultCredentialDraft],
  );
  const batchCredentialJson = useMemo(
    () => prettyBatchCredentialJson(createDefaults.defaultCredentialDraft),
    [createDefaults.defaultCredentialDraft],
  );
  const handleCredentialFilesChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setCredentialFilesManifestJson(buildUploadManifest(event.currentTarget.files));
  }, []);
  const handleCredentialFolderFilesChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setCredentialFolderFilesManifestJson(buildUploadManifest(event.currentTarget.files));
  }, []);

  return (
    <div className="nt-stack" style={PAGE_STACK_STYLE}>
      <NtCard className="nt-stack nt-gap-3_5">
        <div className="nt-stack nt-gap-1_5">
          <span className="nt-kicker">服务商</span>
          <strong className="nt-text-strong" style={PROVIDER_TITLE_STYLE}>
            {props.providerAccount.label}
          </strong>
          <span className="nt-text-muted">
            {props.providerAccount.adapter} / {props.providerAccount.protocolFamily} / {props.providerAccount.executionMode}
          </span>
        </div>
        <div className="nt-flex nt-gap-2 nt-wrap">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`nt-btn ${mode === option.value ? "nt-btn--primary" : "nt-btn--secondary"}`}
              onClick={() => setMode(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </NtCard>

      {mode === "manual_single" ? (
        <NtCard className="nt-stack nt-gap-3_5">
          <span className="nt-kicker">手动填写 1 个凭证</span>
          <form action={createGatewayProviderCredentialAction} className="nt-stack nt-gap-3">
            <input name="providerAccountId" type="hidden" value={props.providerAccount.id} />
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <div className="nt-autofit">
              <label className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">显示名</span>
                <input className="nt-input" name="label" placeholder="例如：Codex Team Alpha" />
              </label>
              <label className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">状态</span>
                <input className="nt-input" defaultValue="active" name="status" />
              </label>
              <label className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">来源路径</span>
                <input className="nt-input" name="sourcePath" placeholder="例如：codex/team-a.json" />
              </label>
            </div>
            <label className="nt-stack nt-gap-1_5">
              <span className="nt-kicker">凭证 JSON</span>
              <textarea
                className="nt-textarea nt-resize-y nt-mono"
                defaultValue={singleCredentialJson}
                name="credentialJson"
                rows={14}
              />
            </label>
            {createDefaults.credentialHint ? (
              <NtPanel className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">凭证提示</span>
                <span className="nt-text-muted">{createDefaults.credentialHint}</span>
              </NtPanel>
            ) : null}
            {isLumalabs ? (
              <NtPanel className="nt-stack nt-gap-2_5">
                <span className="nt-kicker">Luma Reverse-Web 合同</span>
                <span className="nt-text-muted">
                  这些字段会自动写入凭证 JSON 的 `extraBody`，用于覆盖视频/音频网页 action 与产物字段；留空则沿用平台默认值。
                </span>
                <div className="nt-autofit">
                  {LUMALABS_CONTRACT_FIELD_DEFINITIONS.map((field) => (
                    <label key={field.key} className="nt-stack nt-gap-1_5">
                      <span className="nt-kicker">{field.label}</span>
                      <input className="nt-input" name={field.key} placeholder={field.placeholder} />
                      <span className="nt-text-muted" style={FIELD_HINT_STYLE}>
                        {field.description} 默认：{field.fallbackValue}
                      </span>
                    </label>
                  ))}
                </div>
              </NtPanel>
            ) : null}
            <div className="nt-flex nt-justify-end">
              <button className="nt-btn nt-btn--primary" type="submit">
                创建凭证
              </button>
            </div>
          </form>
        </NtCard>
      ) : null}

      {mode === "manual_batch" ? (
        <NtCard className="nt-stack nt-gap-3_5">
          <span className="nt-kicker">手动批量填写</span>
          <form action={createGatewayProviderCredentialBatchAction} className="nt-stack nt-gap-3">
            <input name="providerAccountId" type="hidden" value={props.providerAccount.id} />
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <NtPanel className="nt-stack nt-gap-1_5">
              <span className="nt-kicker">格式</span>
              <span className="nt-text-muted">
                使用 JSON 数组。每项可写 `label / status / sourcePath / credential`；若没有 `credential` 字段，则其余字段视为凭证对象。
              </span>
            </NtPanel>
            <label className="nt-stack nt-gap-1_5">
              <span className="nt-kicker">批量凭证 JSON</span>
              <textarea
                className="nt-textarea nt-resize-y nt-mono"
                defaultValue={batchCredentialJson}
                name="credentialBatchJson"
                rows={18}
              />
            </label>
            <div className="nt-flex nt-justify-end">
              <button className="nt-btn nt-btn--primary" type="submit">
                批量创建凭证
              </button>
            </div>
          </form>
        </NtCard>
      ) : null}

      {mode === "upload_single" ? (
        <NtCard className="nt-stack nt-gap-3_5">
          <span className="nt-kicker">手动上传 1 个凭证</span>
          <form action={uploadSingleGatewayProviderCredentialAction} className="nt-stack nt-gap-3">
            <input name="providerAccountId" type="hidden" value={props.providerAccount.id} />
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <div className="nt-autofit">
              <label className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">显示名（可选）</span>
                <input className="nt-input" name="label" placeholder="留空则按文件名推导" />
              </label>
              <label className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">凭证文件</span>
                <input accept=".json,application/json" className="nt-input" name="credentialFile" type="file" />
              </label>
            </div>
            <div className="nt-flex nt-justify-end">
              <button className="nt-btn nt-btn--primary" type="submit">
                上传凭证
              </button>
            </div>
          </form>
        </NtCard>
      ) : null}

      {mode === "upload_batch" ? (
        <NtCard className="nt-stack nt-gap-3_5">
          <span className="nt-kicker">手动批量上传凭证</span>
          <form action={uploadBatchGatewayProviderCredentialsAction} className="nt-stack nt-gap-3">
            <input name="providerAccountId" type="hidden" value={props.providerAccount.id} />
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <input name="credentialFilesManifestJson" type="hidden" value={credentialFilesManifestJson} />
            <input
              name="credentialFolderFilesManifestJson"
              type="hidden"
              value={credentialFolderFilesManifestJson}
            />
            <NtPanel className="nt-stack nt-gap-1_5">
              <span className="nt-kicker">上传规则</span>
              <span className="nt-text-muted">
                可一次选择多个 JSON 文件，也可直接选择一个文件夹。目录中的所有 JSON 文件都会被收集后批量导入；若某个文件本身是 JSON 数组，则会继续展开导入多条。
              </span>
            </NtPanel>
            <div className="nt-autofit" style={AUTOFIT_260}>
              <label className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">凭证文件</span>
                <input
                  accept=".json,application/json"
                  className="nt-input"
                  multiple
                  name="credentialFiles"
                  onChange={handleCredentialFilesChange}
                  type="file"
                />
              </label>
              <label className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">凭证文件夹</span>
                <input
                  accept=".json,application/json"
                  className="nt-input"
                  multiple
                  name="credentialFolderFiles"
                  onChange={handleCredentialFolderFilesChange}
                  type="file"
                  {...DIRECTORY_UPLOAD_PROPS}
                />
              </label>
            </div>
            <div className="nt-flex nt-justify-end">
              <button className="nt-btn nt-btn--primary" type="submit">
                批量上传凭证
              </button>
            </div>
          </form>
        </NtCard>
      ) : null}
    </div>
  );
}
