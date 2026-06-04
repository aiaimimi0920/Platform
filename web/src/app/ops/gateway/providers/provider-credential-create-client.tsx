"use client";

import type { GatewayProviderAccountView } from "@/lib/account-client";
import { NtCard, NtPanel } from "@/components/nt-primitives";
import { useState } from "react";

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
  const createDefaults = getProviderCreateDefaults(
    props.providerAccount.adapter,
    props.providerAccount.protocolFamily,
    props.providerAccount.protocolProfile,
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <NtCard style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="nt-kicker">服务商</span>
          <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.08rem" }}>
            {props.providerAccount.label}
          </strong>
          <span style={{ color: "rgba(190,199,217,0.76)" }}>
            {props.providerAccount.adapter} / {props.providerAccount.protocolFamily} / {props.providerAccount.executionMode}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        <NtCard style={{ display: "grid", gap: 14 }}>
          <span className="nt-kicker">手动填写 1 个凭证</span>
          <form action={createGatewayProviderCredentialAction} style={{ display: "grid", gap: 12 }}>
            <input name="providerAccountId" type="hidden" value={props.providerAccount.id} />
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">显示名</span>
                <input className="nt-input" name="label" placeholder="例如：Codex Team Alpha" />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">状态</span>
                <input className="nt-input" defaultValue="active" name="status" />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">来源路径</span>
                <input className="nt-input" name="sourcePath" placeholder="例如：codex/team-a.json" />
              </label>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">凭证 JSON</span>
              <textarea
                className="nt-input"
                defaultValue={prettyJson(createDefaults.defaultCredentialDraft ?? {})}
                name="credentialJson"
                rows={14}
                style={{ resize: "vertical", fontFamily: "monospace" }}
              />
            </label>
            {createDefaults.credentialHint ? (
              <NtPanel style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">凭证提示</span>
                <span style={{ color: "rgba(190,199,217,0.76)" }}>{createDefaults.credentialHint}</span>
              </NtPanel>
            ) : null}
            {isLumalabs ? (
              <NtPanel style={{ display: "grid", gap: 10 }}>
                <span className="nt-kicker">Luma Reverse-Web 合同</span>
                <span style={{ color: "rgba(190,199,217,0.76)" }}>
                  这些字段会自动写入凭证 JSON 的 `extraBody`，用于覆盖视频/音频网页 action 与产物字段；留空则沿用平台默认值。
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {LUMALABS_CONTRACT_FIELD_DEFINITIONS.map((field) => (
                    <label key={field.key} style={{ display: "grid", gap: 6 }}>
                      <span className="nt-kicker">{field.label}</span>
                      <input className="nt-input" name={field.key} placeholder={field.placeholder} />
                      <span style={{ color: "rgba(190,199,217,0.7)", fontSize: "0.82rem" }}>
                        {field.description} 默认：{field.fallbackValue}
                      </span>
                    </label>
                  ))}
                </div>
              </NtPanel>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="nt-btn nt-btn--primary" type="submit">
                创建凭证
              </button>
            </div>
          </form>
        </NtCard>
      ) : null}

      {mode === "manual_batch" ? (
        <NtCard style={{ display: "grid", gap: 14 }}>
          <span className="nt-kicker">手动批量填写</span>
          <form action={createGatewayProviderCredentialBatchAction} style={{ display: "grid", gap: 12 }}>
            <input name="providerAccountId" type="hidden" value={props.providerAccount.id} />
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <NtPanel style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">格式</span>
              <span style={{ color: "rgba(190,199,217,0.76)" }}>
                使用 JSON 数组。每项可写 `label / status / sourcePath / credential`；若没有 `credential` 字段，则其余字段视为凭证对象。
              </span>
            </NtPanel>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">批量凭证 JSON</span>
              <textarea
                className="nt-input"
                defaultValue={prettyBatchCredentialJson(createDefaults.defaultCredentialDraft)}
                name="credentialBatchJson"
                rows={18}
                style={{ resize: "vertical", fontFamily: "monospace" }}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="nt-btn nt-btn--primary" type="submit">
                批量创建凭证
              </button>
            </div>
          </form>
        </NtCard>
      ) : null}

      {mode === "upload_single" ? (
        <NtCard style={{ display: "grid", gap: 14 }}>
          <span className="nt-kicker">手动上传 1 个凭证</span>
          <form action={uploadSingleGatewayProviderCredentialAction} style={{ display: "grid", gap: 12 }}>
            <input name="providerAccountId" type="hidden" value={props.providerAccount.id} />
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">显示名（可选）</span>
                <input className="nt-input" name="label" placeholder="留空则按文件名推导" />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">凭证文件</span>
                <input accept=".json,application/json" className="nt-input" name="credentialFile" type="file" />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="nt-btn nt-btn--primary" type="submit">
                上传凭证
              </button>
            </div>
          </form>
        </NtCard>
      ) : null}

      {mode === "upload_batch" ? (
        <NtCard style={{ display: "grid", gap: 14 }}>
          <span className="nt-kicker">手动批量上传凭证</span>
          <form action={uploadBatchGatewayProviderCredentialsAction} style={{ display: "grid", gap: 12 }}>
            <input name="providerAccountId" type="hidden" value={props.providerAccount.id} />
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <input name="credentialFilesManifestJson" type="hidden" value={credentialFilesManifestJson} />
            <input
              name="credentialFolderFilesManifestJson"
              type="hidden"
              value={credentialFolderFilesManifestJson}
            />
            <NtPanel style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">上传规则</span>
              <span style={{ color: "rgba(190,199,217,0.76)" }}>
                可一次选择多个 JSON 文件，也可直接选择一个文件夹。目录中的所有 JSON 文件都会被收集后批量导入；若某个文件本身是 JSON 数组，则会继续展开导入多条。
              </span>
            </NtPanel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">凭证文件</span>
                <input
                  accept=".json,application/json"
                  className="nt-input"
                  multiple
                  name="credentialFiles"
                  onChange={(event) => {
                    setCredentialFilesManifestJson(buildUploadManifest(event.currentTarget.files));
                  }}
                  type="file"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">凭证文件夹</span>
                <input
                  accept=".json,application/json"
                  className="nt-input"
                  multiple
                  name="credentialFolderFiles"
                  onChange={(event) => {
                    setCredentialFolderFilesManifestJson(buildUploadManifest(event.currentTarget.files));
                  }}
                  type="file"
                  {...({ directory: "", webkitdirectory: "" } as Record<string, string>)}
                />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
