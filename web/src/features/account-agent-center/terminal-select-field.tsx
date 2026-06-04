"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

type TerminalSelectOption = {
  value: string;
  label: string;
  description?: string | null;
  iconSrc?: string;
  iconAlt?: string;
};

type TerminalSelectFieldProps = {
  name: string;
  options: TerminalSelectOption[];
  placeholder: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path
        d="M4 6.25 8 10.25l4-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function TerminalSelectField({
  name,
  options,
  placeholder,
  defaultValue = "",
  value,
  onValueChange,
  required = false,
  disabled = false,
  className,
}: TerminalSelectFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controlled = typeof value === "string";
  const normalizedDefaultValue = useMemo(
    () => (options.some((option) => option.value === defaultValue) ? defaultValue : ""),
    [defaultValue, options],
  );
  const [open, setOpen] = useState(false);
  const [valueState, setValueState] = useState(normalizedDefaultValue);
  const selectedValue = controlled
    ? (options.some((option) => option.value === value) ? value : "")
    : valueState;

  useEffect(() => {
    if (!controlled) {
      setValueState(normalizedDefaultValue);
    }
  }, [controlled, normalizedDefaultValue]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selected = options.find((option) => option.value === selectedValue) ?? null;
  const unavailable = disabled || options.length === 0;

  function handleSelect(nextValue: string) {
    if (!controlled) {
      setValueState(nextValue);
    }
    onValueChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div
      className={cn("app-agent-center-terminal-select", open && "app-agent-center-terminal-select--open", className)}
      ref={rootRef}
    >
      <input name={name} type="hidden" value={selectedValue} />
      <button
        aria-expanded={open}
        className="app-agent-center-terminal-select__trigger"
        disabled={unavailable}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span
          className={cn(
            "app-agent-center-terminal-select__trigger-copy",
            !selected && "app-agent-center-terminal-select__trigger-copy--placeholder",
          )}
        >
          {selected?.iconSrc ? (
            <img
              alt={selected.iconAlt ?? ""}
              aria-hidden={selected.iconAlt ? undefined : true}
              className="app-agent-center-terminal-select__icon"
              decoding="async"
              draggable={false}
              height={24}
              loading="lazy"
              src={selected.iconSrc}
              width={24}
            />
          ) : null}
          <span className="app-agent-center-terminal-select__trigger-label">{selected?.label || placeholder}</span>
        </span>
        <span className="app-agent-center-terminal-select__chevron">
          <ChevronIcon />
        </span>
      </button>
      {required ? (
        <input
          aria-hidden="true"
          className="app-agent-center-terminal-select__proxy"
          onChange={() => {}}
          required={required}
          tabIndex={-1}
          value={selectedValue}
        />
      ) : null}
      {open && !unavailable ? (
        <div className="app-agent-center-terminal-select__panel" role="listbox">
          {options.map((option) => {
            const active = option.value === selectedValue;
            return (
              <button
                aria-selected={active}
                className={cn("app-agent-center-terminal-select__option", active && "app-agent-center-terminal-select__option--active")}
                key={option.value}
                onClick={() => handleSelect(option.value)}
                role="option"
                type="button"
              >
                <span className="app-agent-center-terminal-select__option-copy">
                  <span className="app-agent-center-terminal-select__option-main">
                    {option.iconSrc ? (
                      <img
                        alt={option.iconAlt ?? ""}
                        aria-hidden={option.iconAlt ? undefined : true}
                        className="app-agent-center-terminal-select__icon"
                        decoding="async"
                        draggable={false}
                        height={24}
                        loading="lazy"
                        src={option.iconSrc}
                        width={24}
                      />
                    ) : null}
                    <strong>{option.label}</strong>
                  </span>
                  {option.description ? <span>{option.description}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
