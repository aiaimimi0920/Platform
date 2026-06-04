"use client";

import { useEffect, useMemo, useState } from "react";

import { TerminalSelectField } from "@/features/account-agent-center/terminal-select-field";

export type ManagedLightModelOption = {
  value: string;
  label: string;
  description?: string | null;
};

export type ManagedLightServiceBindingOption = {
  id: string;
  title: string;
  description?: string | null;
  modelOptions: ManagedLightModelOption[];
};

type ManagedLightServiceBindingFieldsProps = {
  defaultModel?: string | null;
  defaultServiceId?: string;
  modelFieldName?: string;
  serviceFieldName?: string;
  serviceOptions: ManagedLightServiceBindingOption[];
};

function buildEffectiveModelOptions(
  service: ManagedLightServiceBindingOption | null,
  currentModel: string,
): ManagedLightModelOption[] {
  const options = service?.modelOptions ?? [];
  if (!currentModel || options.some((option) => option.value === currentModel)) {
    return options;
  }
  return [
    {
      value: currentModel,
      label: currentModel,
      description: "当前绑定",
    },
    ...options,
  ];
}

export function ManagedLightServiceBindingFields({
  defaultModel = null,
  defaultServiceId = "",
  modelFieldName = "managedModel",
  serviceFieldName = "managedServiceId",
  serviceOptions,
}: ManagedLightServiceBindingFieldsProps) {
  const normalizedDefaultServiceId = useMemo(
    () => (serviceOptions.some((option) => option.id === defaultServiceId) ? defaultServiceId : serviceOptions[0]?.id ?? ""),
    [defaultServiceId, serviceOptions],
  );
  const [serviceId, setServiceId] = useState(normalizedDefaultServiceId);
  const [model, setModel] = useState(defaultModel?.trim() || "");

  useEffect(() => {
    setServiceId(normalizedDefaultServiceId);
  }, [normalizedDefaultServiceId]);

  useEffect(() => {
    setModel(defaultModel?.trim() || "");
  }, [defaultModel]);

  const selectedService = useMemo(
    () => serviceOptions.find((option) => option.id === serviceId) ?? null,
    [serviceId, serviceOptions],
  );
  const modelOptions = useMemo(
    () => buildEffectiveModelOptions(selectedService, model),
    [model, selectedService],
  );
  const showModelConfigHint = Boolean(selectedService) && modelOptions.length === 0;

  return (
    <div className="app-agent-center-form__stack">
      <TerminalSelectField
        defaultValue={normalizedDefaultServiceId}
        disabled={serviceOptions.length === 0}
        name={serviceFieldName}
        onValueChange={(nextValue) => {
          setServiceId(nextValue);
          const nextService = serviceOptions.find((option) => option.id === nextValue) ?? null;
          const nextOptions = buildEffectiveModelOptions(nextService, model);
          if (!nextOptions.some((option) => option.value === model)) {
            setModel("");
          }
        }}
        options={serviceOptions.map((service) => ({
          value: service.id,
          label: service.title,
          description: service.description,
        }))}
        placeholder={serviceOptions.length > 0 ? "选择 AI 凭证" : "暂无 AI 凭证"}
        required={serviceOptions.length > 0}
        value={serviceId}
      />
      <TerminalSelectField
        defaultValue={defaultModel?.trim() || ""}
        disabled={!selectedService || modelOptions.length === 0}
        name={modelFieldName}
        onValueChange={setModel}
        options={modelOptions}
        placeholder={selectedService ? "选择模型" : "先选择 AI 凭证"}
        required={modelOptions.length > 0}
        value={model}
      />
      {showModelConfigHint ? (
        <p className="app-agent-center-form__hint">
          当前 AI 服务还没有可用模型。请先配置 gateway provider account / model alias。
        </p>
      ) : null}
    </div>
  );
}
