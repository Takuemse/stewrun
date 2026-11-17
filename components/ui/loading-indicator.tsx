import { LoaderCircle } from "lucide-react";
import type { HTMLAttributes } from "react";

interface LoadingIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string;
}

export function LoadingIndicator({
  label = "Loading",
  className = "",
  ...props
}: LoadingIndicatorProps) {
  return (
    <span
      className={`ui-loading-indicator ${className}`}
      role="status"
      {...props}
    >
      <LoaderCircle aria-hidden="true" className="ui-loading-indicator__icon" />
      <span>{label}</span>
    </span>
  );
}
