import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export default function SectionHeader({
  title,
  subtitle,
  action,
}: SectionHeaderProps) {
  return (
    <div className="mb-10 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-3xl font-bold">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-2 text-slate-600">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}