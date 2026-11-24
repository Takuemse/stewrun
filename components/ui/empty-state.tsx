import type { HTMLAttributes, ReactNode } from "react";

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  className = "",
  ...props
}: EmptyStateProps) {
  return (
    <div className={`ui-empty-state ${className}`} {...props}>
      <h2 className="ui-empty-state__title">{title}</h2>
      {description ? (
        <p className="ui-empty-state__description">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
