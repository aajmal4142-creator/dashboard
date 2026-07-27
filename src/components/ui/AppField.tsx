import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";

export function AppField({
  className,
  label,
  id,
  ...props
}: ComponentProps<"input"> & { label?: string }) {
  const inputId = id ?? props.name;
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label ? <span className="label-caps">{label}</span> : null}
      <input
        id={inputId}
        className={cn(fieldClass, "font-inherit", className)}
        {...props}
      />
    </label>
  );
}

export function AppSelectNative({
  className,
  label,
  id,
  children,
  ...props
}: ComponentProps<"select"> & { label?: string }) {
  const selectId = id ?? props.name;
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label ? <span className="label-caps">{label}</span> : null}
      <select
        id={selectId}
        className={cn(fieldClass, "cursor-pointer", className)}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

/** Colour swatch picker + hex text — either updates the other. */
export function AppColorField({
  label,
  id,
  value,
  onChange,
  placeholder = "#000000",
  disabled,
  fallback = "#7A2E2E",
}: {
  label?: string;
  id?: string;
  value: string;
  onChange: (hex: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Used by the native picker when `value` is empty or invalid. */
  fallback?: string;
}) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const pickerValue = HEX6.test(value) ? value : fallback;

  return (
    <div className="flex flex-col gap-1 text-xs text-ink-muted">
      {label ? (
        <label htmlFor={inputId} className="label-caps">
          {label}
        </label>
      ) : null}
      <div className="flex items-stretch gap-2">
        <input
          type="color"
          aria-label={label ? `${label} picker` : "Colour picker"}
          value={pickerValue}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className={cn(
            "h-[42px] w-12 shrink-0 cursor-pointer rounded-[4px] border border-rule bg-surface-1 p-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[2px] [&::-webkit-color-swatch]:border-0",
            "[&::-moz-color-swatch]:rounded-[2px] [&::-moz-color-swatch]:border-0",
          )}
        />
        <input
          id={inputId}
          type="text"
          inputMode="text"
          spellCheck={false}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(fieldClass, "min-w-0 flex-1 font-data")}
        />
      </div>
    </div>
  );
}

export { fieldClass as appFieldClass };
