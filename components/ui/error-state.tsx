import type { HTMLAttributes, ReactNode } from "react";

interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function ErrorState({
  title,
  description,
  action,
  className = "",
  ...props
}: ErrorStateProps) {
  return (
    <div className={`ui-error-state ${className}`} role="alert" {...props}>
      <h2 className="ui-error-state__title">{title}</h2>
      {description ? (
        <p className="ui-error-state__description">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
