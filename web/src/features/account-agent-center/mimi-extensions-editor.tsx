"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  NtBadge as Badge,
  NtCard as Card,
  NtSelect as Select,
} from "@/components/nt-primitives";

const DEFAULT_HEAVY_AGENT_NAME = "觅觅";
const DEFAULT_HEAVY_AGENT_UNIQUE_ID = "chat.heavy.mimi";
const DEFAULT_HEAVY_GROWTH_MODES = ["共创成长", "主人成长", "锁定"] as const;
const LOCAL_STORAGE_GROWTH_MODE_KEY = "neuro:heavy:mimi:growthMode";
const LOCAL_STORAGE_MARKS_KEY = "neuro:heavy:mimi:marks";
const LOCAL_STORAGE_ACTIVE_MARK_KEY = "neuro:heavy:mimi:activeMarkId";

type MimiMarkSnapshot = {
  createdAtMs?: number;
  id: string;
  label: string;
  growthMode: string;
};

type MimiExtensionsEditorProps = {
  initialGrowthMode?: string;
  openHref: string;
  target?: string;
};

function formatMarkTimestamp(createdAtMs?: number) {
  if (!createdAtMs || !Number.isFinite(createdAtMs)) {
    return "未知时间";
  }

  const date = new Date(createdAtMs);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function buildMarkLabel(index: number, growthMode: string, createdAtMs?: number) {
  return `标记 ${index} · ${formatMarkTimestamp(createdAtMs)} · ${growthMode}`;
}

function parseStoredMarks(raw: string | null): MimiMarkSnapshot[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is MimiMarkSnapshot => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const candidate = item as Partial<MimiMarkSnapshot>;
        return (
          (typeof candidate.createdAtMs === "number" || typeof candidate.createdAtMs === "undefined") &&
          typeof candidate.id === "string" &&
          typeof candidate.label === "string" &&
          typeof candidate.growthMode === "string"
        );
      })
      .slice(0, 3);
  } catch {
    return [];
  }
}

export function MimiExtensionsEditor({
  initialGrowthMode = "主人成长",
  openHref,
  target,
}: MimiExtensionsEditorProps) {
  const [editing, setEditing] = useState(false);
  const [growthMode, setGrowthMode] = useState(initialGrowthMode);
  const [markSnapshots, setMarkSnapshots] = useState<MimiMarkSnapshot[]>([]);
  const [activeMarkId, setActiveMarkId] = useState("");

  const savedGrowthModeRef = useRef(initialGrowthMode);
  const savedMarkSnapshotsRef = useRef<MimiMarkSnapshot[]>([]);
  const savedActiveMarkIdRef = useRef("");

  useEffect(() => {
    try {
      const storedGrowthMode = window.localStorage.getItem(LOCAL_STORAGE_GROWTH_MODE_KEY);
      const nextGrowthMode =
        storedGrowthMode && DEFAULT_HEAVY_GROWTH_MODES.includes(storedGrowthMode as (typeof DEFAULT_HEAVY_GROWTH_MODES)[number])
          ? storedGrowthMode
          : initialGrowthMode;
      const nextMarks = parseStoredMarks(window.localStorage.getItem(LOCAL_STORAGE_MARKS_KEY));
      const nextActiveMarkId = window.localStorage.getItem(LOCAL_STORAGE_ACTIVE_MARK_KEY) || "";

      savedGrowthModeRef.current = nextGrowthMode;
      savedMarkSnapshotsRef.current = nextMarks;
      savedActiveMarkIdRef.current = nextActiveMarkId;

      setGrowthMode(nextGrowthMode);
      setMarkSnapshots(nextMarks);
      setActiveMarkId(nextActiveMarkId);
    } catch {
      savedGrowthModeRef.current = initialGrowthMode;
      savedMarkSnapshotsRef.current = [];
      savedActiveMarkIdRef.current = "";

      setGrowthMode(initialGrowthMode);
      setMarkSnapshots([]);
      setActiveMarkId("");
    }
  }, [initialGrowthMode]);

  function persistState(nextGrowthMode: string, nextMarks: MimiMarkSnapshot[], nextActiveMarkId: string) {
    savedGrowthModeRef.current = nextGrowthMode;
    savedMarkSnapshotsRef.current = nextMarks;
    savedActiveMarkIdRef.current = nextActiveMarkId;

    try {
      window.localStorage.setItem(LOCAL_STORAGE_GROWTH_MODE_KEY, nextGrowthMode);
      window.localStorage.setItem(LOCAL_STORAGE_MARKS_KEY, JSON.stringify(nextMarks));
      window.localStorage.setItem(LOCAL_STORAGE_ACTIVE_MARK_KEY, nextActiveMarkId);
    } catch {
      // Ignore storage failures and keep in-memory state only.
    }
  }

  function handleEdit() {
    setEditing(true);
  }

  function handleCancel() {
    setGrowthMode(savedGrowthModeRef.current);
    setMarkSnapshots(savedMarkSnapshotsRef.current);
    setActiveMarkId(savedActiveMarkIdRef.current);
    setEditing(false);
  }

  function handleSave() {
    persistState(growthMode, markSnapshots, activeMarkId);
    setEditing(false);
  }

  function handleCreateMark() {
    if (!editing) {
      return;
    }
    const createdAtMs = Date.now();
    const nextSnapshot: MimiMarkSnapshot = {
      createdAtMs,
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `mark-${createdAtMs}`,
      label: buildMarkLabel(markSnapshots.length + 1, growthMode, createdAtMs),
      growthMode,
    };
    const nextSnapshots = [nextSnapshot, ...markSnapshots].slice(0, 3).map((snapshot, index) => ({
      ...snapshot,
      label: buildMarkLabel(index + 1, snapshot.growthMode, snapshot.createdAtMs),
    }));
    setMarkSnapshots(nextSnapshots);
    setActiveMarkId(nextSnapshot.id);
  }

  function handleSwitchMark(nextMarkId: string) {
    if (!editing) {
      return;
    }
    setActiveMarkId(nextMarkId);
    const snapshot = markSnapshots.find((item) => item.id === nextMarkId);
    if (snapshot) {
      setGrowthMode(snapshot.growthMode);
    }
  }

  return (
    <Card className="app-agent-center-light-card">
      <div className="app-agent-center-light-card__top">
        <div className="app-agent-center-light-card__title-block">
          <div className="app-agent-center-light-card__title-row">
            <h3 className="app-card-title">{DEFAULT_HEAVY_AGENT_NAME}</h3>
            <div className="app-agent-center-card__meta app-agent-center-light-card__meta">
              <Badge tone="cyan">固定</Badge>
            </div>
          </div>
          <p className="app-agent-center-light-card__summary">
            {DEFAULT_HEAVY_AGENT_NAME}
            继续通过 `/chat` 运行，负责通用对话、工作整理、任务拆解和长上下文会话承接。
          </p>
        </div>

        <div className="app-agent-center-inline-actions">
          {editing ? (
            <>
              <button className="nt-btn nt-btn--primary app-agent-center-light-card__edit" onClick={handleSave} type="button">
                保存
              </button>
              <button className="nt-btn nt-btn--secondary app-agent-center-light-card__edit" onClick={handleCancel} type="button">
                取消
              </button>
            </>
          ) : (
            <button className="nt-btn nt-btn--outline app-agent-center-light-card__edit" onClick={handleEdit} type="button">
              编辑
            </button>
          )}
          <Link className="nt-btn nt-btn--outline app-agent-center-light-card__edit" href={openHref} target={target}>
            打开对话
          </Link>
        </div>
      </div>

      <div className="app-agent-center-light-card__matrix">
        <div className="app-agent-center-light-card__item">
          <span>唯一 ID</span>
          <strong>{DEFAULT_HEAVY_AGENT_UNIQUE_ID}</strong>
        </div>
        <div className="app-agent-center-light-card__item">
          <span>对话入口</span>
          <strong>/chat</strong>
        </div>
        <div className="app-agent-center-light-card__item">
          <span>槽位类型</span>
          <strong>默认免费重度</strong>
        </div>
        <div className="app-agent-center-light-card__item">
          <span>运行状态</span>
          <strong>固定启用</strong>
        </div>
      </div>

      <div className="app-agent-center-heavy-default-extensions">
        <div className="app-agent-center-heavy-default-extensions__section app-agent-center-heavy-default-extensions__section--compact">
          <span className="app-agent-center-heavy-default-extensions__label">智能模式</span>
          <Select
            aria-label="智能模式"
            className="app-agent-center-heavy-default-extensions__select"
            disabled={!editing}
            value={growthMode}
            onChange={(event) => setGrowthMode(event.target.value)}
          >
            {DEFAULT_HEAVY_GROWTH_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </Select>
        </div>

        <div className="app-agent-center-heavy-default-extensions__section app-agent-center-heavy-default-extensions__section--compact">
          <span className="app-agent-center-heavy-default-extensions__label">智能标记</span>
          <button
            className="nt-btn nt-btn--glass app-agent-center-heavy-default-extensions__button"
            disabled={!editing}
            onClick={handleCreateMark}
            type="button"
          >
            智能标记
          </button>
        </div>

        <div className="app-agent-center-heavy-default-extensions__section app-agent-center-heavy-default-extensions__section--compact">
          <span className="app-agent-center-heavy-default-extensions__label">切换智能</span>
          <Select
            aria-label="切换智能"
            className="app-agent-center-heavy-default-extensions__select"
            disabled={!editing || markSnapshots.length === 0}
            value={activeMarkId}
            onChange={(event) => handleSwitchMark(event.target.value)}
          >
            <option disabled value="">
              选择已锁定标记
            </option>
            {markSnapshots.map((mark) => (
              <option key={mark.id} value={mark.id}>
                {mark.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Card>
  );
}
