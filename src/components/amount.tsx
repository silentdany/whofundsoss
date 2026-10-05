"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatUsd } from "@/lib/format";

export function Amount({
  value,
  className = "",
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const formatted = formatUsd(value ?? null);
  if (formatted) {
    return (
      <span className={`font-mono tabular-nums ${className}`}>{formatted}</span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`font-mono tabular-nums text-muted-foreground cursor-help ${className}`}
          tabIndex={0}
        >
          —
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Amount not public (often the case on GitHub Sponsors)
      </TooltipContent>
    </Tooltip>
  );
}
