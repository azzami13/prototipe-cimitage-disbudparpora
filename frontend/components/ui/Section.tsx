interface SectionProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  spacing?: "none" | "sm" | "md" | "lg";
}

export default function Section({
  children,
  className = "",
  containerClassName = "",
}: SectionProps) {
  return (
    <section
      className={`
        bg-slate-50 py-2 md:py-4
        ${className}
      `}
    >
      <div
        className={`
          mx-auto
          max-w-7xl
          px-4
          md:px-6
          lg:px-8
          ${containerClassName}
        `}
      >
        {children}
      </div>
    </section>
  );
}