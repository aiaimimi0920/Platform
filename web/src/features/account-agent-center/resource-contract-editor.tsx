"use client";

import { useEffect, useMemo, useState } from "react";

import { NtInput as Input } from "@/components/nt-primitives";
import { cn } from "@/lib/cn";
import { TerminalSelectField } from "@/features/account-agent-center/terminal-select-field";

const resourceContractSlots = [1, 2, 3, 4, 5] as const;

const resourceTypeOptions = [
  { value: "string", label: "文本", token: "txt" },
  { value: "image", label: "图片", token: "img" },
  { value: "audio", label: "音频", token: "aud" },
  { value: "video", label: "视频", token: "vid" },
  { value: "archive", label: "压缩包", token: "zip" },
  { value: "file", label: "文件", token: "file" },
  { value: "url", label: "链接", token: "url" },
  { value: "number", label: "数字", token: "num" },
  { value: "integer", label: "整数", token: "int" },
  { value: "boolean", label: "布尔", token: "bool" },
  { value: "object", label: "对象", token: "obj" },
  { value: "array", label: "数组", token: "arr" },
] as const;

type ResourceContractEditorProps = {
  prefix: "input" | "output";
  title: string;
  showTitle?: boolean;
  initialSchema?: Record<string, unknown> | null;
};

type ResourceSlotState = {
  fieldName: string;
  marker: string;
  type: string;
  required: boolean;
  copied: boolean;
  defaultText: string;
  fileName: string;
  fileContentType: string;
  fileDataUrl: string;
};

function isFileLikeType(type: string) {
  return type === "image" || type === "audio" || type === "video" || type === "archive" || type === "file";
}

function buildMarkerId(type: string, index: number) {
  const token = resourceTypeOptions.find((option) => option.value === type)?.token ?? "var";
  return `${token}_${String(index).padStart(3, "0")}`;
}

function buildCopyMarker(markerId: string) {
  return `#$${markerId}$#`;
}

function buildDefaultTextValue(prefix: "input" | "output", type: string) {
  const role = prefix === "input" ? "输入" : "输出";
  switch (type) {
    case "string":
      return `${role}文本`;
    case "url":
      return "https://example.com/resource";
    case "number":
      return "0";
    case "integer":
      return "1";
    case "boolean":
      return "false";
    case "object":
      return `{"source":"${role}"}`;
    case "array":
      return `["${role}资源"]`;
    default:
      return "";
  }
}

function buildDefaultPlaceholder(prefix: "input" | "output", type: string) {
  const role = prefix === "input" ? "输入" : "输出";
  switch (type) {
    case "string":
      return `${role}文本`;
    case "url":
      return "默认链接";
    case "number":
      return "默认数字";
    case "integer":
      return "默认整数";
    case "boolean":
      return "true / false";
    case "object":
      return "默认对象 JSON";
    case "array":
      return "默认数组 JSON";
    case "image":
      return `上传默认${role}图片`;
    case "audio":
      return `上传默认${role}音频`;
    case "video":
      return `上传默认${role}视频`;
    case "archive":
      return `上传默认${role}压缩包`;
    case "file":
      return `上传默认${role}文件`;
    default:
      return "默认值";
  }
}

function buildFileAccept(type: string) {
  switch (type) {
    case "image":
      return "image/*";
    case "audio":
      return "audio/*";
    case "video":
      return "video/*";
    case "archive":
      return ".zip,.7z,.rar,.tar,.gz,.tgz";
    default:
      return "*/*";
  }
}

function inferResourceType(property: Record<string, unknown>) {
  const resourceKind = typeof property["x-openagent-resource-kind"] === "string" ? property["x-openagent-resource-kind"] : null;
  if (
    resourceKind === "image" ||
    resourceKind === "audio" ||
    resourceKind === "video" ||
    resourceKind === "archive" ||
    resourceKind === "file"
  ) {
    return resourceKind;
  }

  const contentMediaType = typeof property.contentMediaType === "string" ? property.contentMediaType : "";
  if (contentMediaType.startsWith("image/")) return "image";
  if (contentMediaType.startsWith("audio/")) return "audio";
  if (contentMediaType.startsWith("video/")) return "video";
  if (contentMediaType === "application/zip") return "archive";

  const type = typeof property.type === "string" ? property.type : "string";
  if (type === "string" && property.format === "uri") {
    return "url";
  }
  if (
    type === "number" ||
    type === "integer" ||
    type === "boolean" ||
    type === "object" ||
    type === "array"
  ) {
    return type;
  }
  return "string";
}

function createEmptySlotState(): ResourceSlotState {
  return {
    fieldName: "",
    marker: "",
    type: "",
    required: false,
    copied: false,
    defaultText: "",
    fileName: "",
    fileContentType: "",
    fileDataUrl: "",
  };
}

function buildInitialSlots(initialSchema: Record<string, unknown> | null | undefined) {
  const slots = Object.fromEntries(
    resourceContractSlots.map((slot) => [slot, createEmptySlotState()]),
  ) as Record<(typeof resourceContractSlots)[number], ResourceSlotState>;
  const properties =
    initialSchema &&
    typeof initialSchema === "object" &&
    "properties" in initialSchema &&
    initialSchema.properties &&
    typeof initialSchema.properties === "object" &&
    !Array.isArray(initialSchema.properties)
      ? (initialSchema.properties as Record<string, unknown>)
      : {};
  const requiredSet = new Set(
    Array.isArray(initialSchema?.required)
      ? initialSchema.required.filter((value): value is string => typeof value === "string")
      : [],
  );

  Object.entries(properties)
    .slice(0, resourceContractSlots.length)
    .forEach(([fieldName, rawProperty], index) => {
      const slot = resourceContractSlots[index];
      const property =
        rawProperty && typeof rawProperty === "object" && !Array.isArray(rawProperty)
          ? (rawProperty as Record<string, unknown>)
          : {};
      const defaultResource =
        property["x-openagent-default-resource"] &&
        typeof property["x-openagent-default-resource"] === "object" &&
        !Array.isArray(property["x-openagent-default-resource"])
          ? (property["x-openagent-default-resource"] as Record<string, unknown>)
          : null;
      const marker =
        typeof property["x-openagent-marker"] === "string" && property["x-openagent-marker"].trim().length > 0
          ? property["x-openagent-marker"].trim()
          : fieldName;
      const defaultText =
        defaultResource?.kind === "text" && typeof defaultResource.value === "string"
          ? defaultResource.value
          : "";
      const fileName =
        defaultResource?.kind === "file" && typeof defaultResource.fileName === "string"
          ? defaultResource.fileName
          : "";
      const fileContentType =
        defaultResource?.kind === "file" && typeof defaultResource.contentType === "string"
          ? defaultResource.contentType
          : "";
      const fileDataUrl =
        defaultResource?.kind === "file" && typeof defaultResource.dataUrl === "string"
          ? defaultResource.dataUrl
          : "";

      slots[slot] = {
        fieldName,
        marker,
        type: inferResourceType(property),
        required: requiredSet.has(fieldName),
        copied: false,
        defaultText: fileDataUrl ? "" : defaultText,
        fileName,
        fileContentType,
        fileDataUrl,
      };
    });

  return slots;
}

export function ResourceContractEditor({
  prefix,
  title,
  showTitle = true,
  initialSchema = null,
}: ResourceContractEditorProps) {
  const initialState = useMemo(
    () => buildInitialSlots(initialSchema),
    [initialSchema],
  );
  const [slots, setSlots] = useState(initialState);

  useEffect(() => {
    setSlots(initialState);
  }, [initialState]);

  function updateSlot(slot: (typeof resourceContractSlots)[number], nextValue: Partial<ResourceSlotState>) {
    setSlots((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        ...nextValue,
      },
    }));
  }

  return (
    <div className="app-agent-center-contract-editor">
      {showTitle ? <p className="app-agent-center-note">{title}</p> : null}
      {resourceContractSlots.map((slot) => {
        const state = slots[slot];
        const markerId = state.marker || (state.type ? buildMarkerId(state.type, slot) : "");
        const fieldName = state.fieldName || markerId;
        const defaultPlaceholder = state.type ? buildDefaultPlaceholder(prefix, state.type) : "默认值";
        const fileLike = isFileLikeType(state.type);
        return (
          <div className="app-agent-center-contract-editor__row app-agent-center-contract-editor__row--inline" key={`${prefix}-${slot}`}>
            <label className="app-agent-center-checkbox app-agent-center-checkbox--leading app-agent-center-checkbox--icon-only">
              <input
                checked={state.required}
                name={`${prefix}FieldRequired${slot}`}
                onChange={(event) => updateSlot(slot, { required: event.target.checked })}
                type="checkbox"
                value="true"
              />
            </label>

            <TerminalSelectField
              className="app-agent-center-contract-editor__type"
              name={`${prefix}FieldType${slot}`}
              onValueChange={(nextType) => {
                const previousFileLike = isFileLikeType(state.type);
                const previousDefault = state.type ? buildDefaultTextValue(prefix, state.type) : "";
                updateSlot(slot, {
                  fieldName: nextType ? buildMarkerId(nextType, slot) : "",
                  marker: nextType ? buildMarkerId(nextType, slot) : "",
                  type: nextType,
                  copied: false,
                  defaultText:
                    !previousFileLike && (!state.defaultText || state.defaultText === previousDefault)
                      ? buildDefaultTextValue(prefix, nextType)
                      : isFileLikeType(nextType)
                        ? ""
                        : !state.defaultText || previousFileLike
                          ? buildDefaultTextValue(prefix, nextType)
                          : state.defaultText,
                  fileName: isFileLikeType(nextType) ? state.fileName : "",
                  fileContentType: isFileLikeType(nextType) ? state.fileContentType : "",
                  fileDataUrl: isFileLikeType(nextType) ? state.fileDataUrl : "",
                });
              }}
              options={resourceTypeOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              placeholder="资源类型"
              value={state.type}
            />

            <button
              className={cn(
                "app-agent-center-marker-chip",
                !markerId && "app-agent-center-marker-chip--disabled",
              )}
              disabled={!markerId}
              onClick={async () => {
                if (!markerId) {
                  return;
                }
                try {
                  await navigator.clipboard.writeText(buildCopyMarker(markerId));
                  updateSlot(slot, { copied: true });
                  window.setTimeout(() => {
                    setSlots((current) => ({
                      ...current,
                      [slot]: {
                        ...current[slot],
                        copied: false,
                      },
                    }));
                  }, 1600);
                } catch {
                  updateSlot(slot, { copied: false });
                }
              }}
              type="button"
            >
              <span>{markerId || "标记"}</span>
              <small>{state.copied ? "已复制" : "点击复制"}</small>
            </button>

            {fileLike ? (
              <label className="app-agent-center-file-field">
                <input
                  accept={buildFileAccept(state.type)}
                  className="app-agent-center-file-field__input"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      updateSlot(slot, {
                        fileName: "",
                        fileContentType: "",
                        fileDataUrl: "",
                      });
                      return;
                    }
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
                      reader.onerror = () => reject(reader.error);
                      reader.readAsDataURL(file);
                    }).catch(() => "");
                    updateSlot(slot, {
                      fileName: file.name,
                      fileContentType: file.type,
                      fileDataUrl: dataUrl,
                    });
                  }}
                  type="file"
                />
                <span className="app-agent-center-file-field__button">上传</span>
                <span className={cn("app-agent-center-file-field__name", !state.fileName && "app-agent-center-file-field__name--placeholder")}>
                  {state.fileName || defaultPlaceholder}
                </span>
              </label>
            ) : (
              <Input
                onChange={(event) => updateSlot(slot, { defaultText: event.target.value })}
                placeholder={defaultPlaceholder}
                value={state.defaultText}
              />
            )}

            <input name={`${prefix}FieldName${slot}`} type="hidden" value={fieldName || ""} />
            <input name={`${prefix}FieldMarker${slot}`} type="hidden" value={markerId} />
            <input name={`${prefix}FieldDefaultText${slot}`} type="hidden" value={fileLike ? "" : state.defaultText} />
            <input name={`${prefix}FieldDefaultFileName${slot}`} type="hidden" value={state.fileName} />
            <input name={`${prefix}FieldDefaultFileType${slot}`} type="hidden" value={state.fileContentType} />
            <input name={`${prefix}FieldDefaultFileData${slot}`} type="hidden" value={state.fileDataUrl} />
          </div>
        );
      })}
    </div>
  );
}
