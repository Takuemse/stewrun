import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

type ToastStatus = "success" | "error" | "info";

interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  status: ToastStatus;
  children: ReactNode;
}

const statusIcons = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

export function Toast({
  status,
  className = "",
  children,
  ...props
}: ToastProps) {
  const StatusIcon = statusIcons[status];
  const role = status === "error" ? "alert" : "status";

  return (
    <div
      className={`ui-toast ui-toast--${status} ${className}`}
      role={role}
      aria-live={status === "error" ? "assertive" : "polite"}
      {...props}
    >
      <StatusIcon aria-hidden="true" className="ui-toast__icon" />
      <div>{children}</div>
    </div>
  );
}
