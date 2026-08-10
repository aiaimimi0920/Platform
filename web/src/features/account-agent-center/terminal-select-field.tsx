"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

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
  const ignoreNextKeyboardClickRef = useRef(false);
  const listboxId = useId();
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
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const [activeOptionValue, setActiveOptionValue] = useState(selectedValue || options[0]?.value || "");
  const activeOptionIndex = options.findIndex((option) => option.value === activeOptionValue);
  const unavailable = disabled || options.length === 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveOptionValue((current) =>
      options.some((option) => option.value === current) ? current : selectedValue || options[0]?.value || "",
    );
  }, [open, options, selectedValue]);

  function handleSelect(nextValue: string) {
    if (!controlled) {
      setValueState(nextValue);
    }
    onValueChange?.(nextValue);
    setOpen(false);
  }

  function openMenu(index = Math.max(selectedIndex, 0)) {
    const boundedIndex = Math.min(Math.max(index, 0), Math.max(options.length - 1, 0));
    setActiveOptionValue(options[boundedIndex]?.value ?? "");
    setOpen(true);
  }

  function handleTriggerClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.detail === 0 && ignoreNextKeyboardClickRef.current) {
      ignoreNextKeyboardClickRef.current = false;
      return;
    }
    if (open) {
      setOpen(false);
    } else {
      openMenu();
    }
  }

  function handleTriggerKeyUp(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if ((event.key === "Enter" || event.key === " ") && ignoreNextKeyboardClickRef.current) {
      window.setTimeout(() => {
        ignoreNextKeyboardClickRef.current = false;
      }, 0);
    }
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (unavailable) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        const nextIndex = Math.min(Math.max(activeOptionIndex, 0) + 1, options.length - 1);
        setActiveOptionValue(options[nextIndex]?.value ?? "");
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        const nextIndex = Math.max(activeOptionIndex - 1, 0);
        setActiveOptionValue(options[nextIndex]?.value ?? "");
      }
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      openMenu(event.key === "Home" ? 0 : options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      ignoreNextKeyboardClickRef.current = true;
      if (!open) {
        openMenu();
        return;
      }
      const activeOption = options[activeOptionIndex];
      if (activeOption) {
        handleSelect(activeOption.value);
      }
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      className={cn("app-agent-center-terminal-select", open && "app-agent-center-terminal-select--open", className)}
      ref={rootRef}
    >
      <input name={name} type="hidden" value={selectedValue} />
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open && activeOptionIndex >= 0 ? `${listboxId}-option-${activeOptionIndex}` : undefined}
        className="app-agent-center-terminal-select__trigger"
        disabled={unavailable}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        onKeyUp={handleTriggerKeyUp}
        onPointerDown={() => {
          ignoreNextKeyboardClickRef.current = false;
        }}
        role="combobox"
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
          <span className="app-agent-center-terminal-select__trigger-label" id={`${listboxId}-label`}>
            {selected?.label || placeholder}
          </span>
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
        <div aria-labelledby={`${listboxId}-label`} className="app-agent-center-terminal-select__panel" id={listboxId} role="listbox">
          {options.map((option, index) => {
            const active = option.value === selectedValue;
            return (
              <div
                aria-selected={active}
                className={cn(
                  "app-agent-center-terminal-select__option",
                  active && "app-agent-center-terminal-select__option--active",
                  activeOptionIndex === index && "app-agent-center-terminal-select__option--highlighted",
                )}
                id={`${listboxId}-option-${index}`}
                key={option.value}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setActiveOptionValue(option.value)}
                role="option"
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
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
