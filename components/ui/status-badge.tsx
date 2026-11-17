import type { HTMLAttributes, ReactNode } from "react";

type Status = "neutral" | "success" | "warning" | "error" | "info";

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: Status;
  children: ReactNode;
}

export function StatusBadge({
  status = "neutral",
  className = "",
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={`ui-status-badge ui-status-badge--${status} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
