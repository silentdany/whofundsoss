import type { ReactNode } from "react";

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full px-4 text-sm transition-colors ${
        active ? "bg-ink text-paper" : "bg-sand text-ink hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

/** A labeled group of chips: one visible label, one clear job. */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-full text-sm font-medium text-secondary sm:w-24 sm:shrink-0">{label}</span>
      {children}
    </div>
  );
}

/** A real on/off switch with a stable label (never "Hide" one moment and "Show" the next). */
export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-sage" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-paper shadow-sm transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
      <span>{children}</span>
    </label>
  );
}

export function Delta({ value, children }: { value: number; children: ReactNode }) {
  const tone =
    value > 0 ? "bg-rise-soft text-rise" : value < 0 ? "bg-fall-soft text-fall" : "bg-sand text-secondary";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium tabular-nums ${tone}`}>
      {children}
    </span>
  );
}
