import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`
        bg-slate-50
        border border-black/5
        rounded-3xl
        shadow-[0px_10px_16px_9px_rgba(0,0,0,0.06)]
        overflow-hidden
        ${className}
      `}
    >
      {children}
    </div>
  );
}