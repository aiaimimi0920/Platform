export const LUMALABS_DEFAULT_VIDEO_ACTION_TYPE = "create_video_ray3_14";
export const LUMALABS_DEFAULT_VIDEO_ARTIFACT_FIELD = "video";
export const LUMALABS_DEFAULT_AUDIO_ACTION_TYPE = "text_to_music_elevenlabs_v1";
export const LUMALABS_DEFAULT_AUDIO_ARTIFACT_FIELD = "audio";

const VIDEO_ACTION_TYPE_KEYS = [
  "videoActionType",
  "video_action_type",
  "videosActionType",
  "videos_action_type",
];
const VIDEO_ARTIFACT_FIELD_KEYS = [
  "videoArtifactField",
  "video_artifact_field",
  "videosArtifactField",
  "videos_artifact_field",
];
const AUDIO_ACTION_TYPE_KEYS = [
  "audioActionType",
  "audio_action_type",
  "musicActionType",
  "music_action_type",
];
const AUDIO_ARTIFACT_FIELD_KEYS = [
  "audioArtifactField",
  "audio_artifact_field",
  "musicArtifactField",
  "music_artifact_field",
];

export type LumalabsConfiguredContract = {
  videoActionType: string | null;
  videoArtifactField: string | null;
  audioActionType: string | null;
  audioArtifactField: string | null;
};

export type LumalabsResolvedContract = {
  videoActionType: string;
  videoArtifactField: string;
  audioActionType: string;
  audioArtifactField: string;
};

export type LumalabsContractFieldKey = keyof LumalabsConfiguredContract;

export const LUMALABS_CONTRACT_FIELD_DEFINITIONS: Array<{
  key: LumalabsContractFieldKey;
  label: string;
  placeholder: string;
  fallbackValue: string;
  description: string;
}> = [
  {
    key: "videoActionType",
    label: "视频 action_type",
    placeholder: "例如：create_video_ray3_14",
    fallbackValue: LUMALABS_DEFAULT_VIDEO_ACTION_TYPE,
    description:
      "capture-derived 视频网页 action 名；留空时优先按当前 board 的 menus.json 自动发现，失败才回退到平台默认值。",
  },
  {
    key: "videoArtifactField",
    label: "视频 artifact_field",
    placeholder: "例如：video",
    fallbackValue: LUMALABS_DEFAULT_VIDEO_ARTIFACT_FIELD,
    description: "从 `output_artifacts.<field>[0]` 读取视频产物；留空则回退默认字段。",
  },
  {
    key: "audioActionType",
    label: "音频 action_type",
    placeholder: "例如：text_to_music_elevenlabs_v1",
    fallbackValue: LUMALABS_DEFAULT_AUDIO_ACTION_TYPE,
    description:
      "capture-derived 音频网页 action 名；留空时优先按当前 board 的 menus.json 自动发现，失败才回退到平台默认值。",
  },
  {
    key: "audioArtifactField",
    label: "音频 artifact_field",
    placeholder: "例如：audio",
    fallbackValue: LUMALABS_DEFAULT_AUDIO_ARTIFACT_FIELD,
    description: "从 `output_artifacts.<field>[0]` 读取音频产物；留空则回退默认字段。",
  },
];

function safeTrim(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function readFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readExtraBody(payload: Record<string, unknown> | null | undefined) {
  const source = payload ?? {};
  return {
    ...toRecord(source.extra_body),
    ...toRecord(source.extraBody),
  };
}

export function isLumalabsCompatibleAdapter(adapter: string | null | undefined) {
  return safeTrim(adapter) === "lumalabs_compatible";
}

export function readConfiguredLumalabsContract(
  payload: Record<string, unknown> | null | undefined,
): LumalabsConfiguredContract {
  const extraBody = readExtraBody(payload);
  return {
    videoActionType: readFirstString(extraBody, VIDEO_ACTION_TYPE_KEYS),
    videoArtifactField: readFirstString(extraBody, VIDEO_ARTIFACT_FIELD_KEYS),
    audioActionType: readFirstString(extraBody, AUDIO_ACTION_TYPE_KEYS),
    audioArtifactField: readFirstString(extraBody, AUDIO_ARTIFACT_FIELD_KEYS),
  };
}

export function resolveLumalabsContract(
  payload: Record<string, unknown> | null | undefined,
): LumalabsResolvedContract {
  const configured = readConfiguredLumalabsContract(payload);
  return {
    videoActionType: configured.videoActionType ?? LUMALABS_DEFAULT_VIDEO_ACTION_TYPE,
    videoArtifactField: configured.videoArtifactField ?? LUMALABS_DEFAULT_VIDEO_ARTIFACT_FIELD,
    audioActionType: configured.audioActionType ?? LUMALABS_DEFAULT_AUDIO_ACTION_TYPE,
    audioArtifactField: configured.audioArtifactField ?? LUMALABS_DEFAULT_AUDIO_ARTIFACT_FIELD,
  };
}

export function readLumalabsContractFromFormData(formData: FormData): LumalabsConfiguredContract {
  return {
    videoActionType: safeTrim(formData.get("videoActionType") as string | null) || null,
    videoArtifactField: safeTrim(formData.get("videoArtifactField") as string | null) || null,
    audioActionType: safeTrim(formData.get("audioActionType") as string | null) || null,
    audioArtifactField: safeTrim(formData.get("audioArtifactField") as string | null) || null,
  };
}

export function mergeLumalabsContractIntoPayload<T extends Record<string, unknown>>(
  payload: T,
  values: LumalabsConfiguredContract,
): T {
  const nextPayload = {
    ...payload,
  } as Record<string, unknown>;
  const extraBody = readExtraBody(payload);

  for (const key of [
    ...VIDEO_ACTION_TYPE_KEYS,
    ...VIDEO_ARTIFACT_FIELD_KEYS,
    ...AUDIO_ACTION_TYPE_KEYS,
    ...AUDIO_ARTIFACT_FIELD_KEYS,
  ]) {
    delete extraBody[key];
  }

  if (values.videoActionType) {
    extraBody.videoActionType = values.videoActionType;
  }
  if (values.videoArtifactField) {
    extraBody.videoArtifactField = values.videoArtifactField;
  }
  if (values.audioActionType) {
    extraBody.audioActionType = values.audioActionType;
  }
  if (values.audioArtifactField) {
    extraBody.audioArtifactField = values.audioArtifactField;
  }

  delete nextPayload.extra_body;
  if (Object.keys(extraBody).length > 0) {
    nextPayload.extraBody = extraBody;
  } else {
    delete nextPayload.extraBody;
  }

  return nextPayload as T;
}
