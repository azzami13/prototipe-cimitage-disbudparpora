interface DashboardShortcutProps {
  className?: string;
}

export default function DashboardShortcut({
  className = "",
}: DashboardShortcutProps) {
  const shortcuts = [
    {
      label: "Pesanan Saya",
      href: "/my-orders",
    },
    {
      label: "Wisata Populer",
      target: "popular",
    },
    {
      label: "Peta",
      target: "map",
    },
    {
      label: "Paket",
      target: "packages",
    },
    {
      label: "Semua Situs",
      target: "sites",
    },
  ];

  return (
    <div
    className={`flex flex-wrap justify-center gap-3 mb-4 ${className}`}
    >
    {shortcuts.map((item) => (
        <a
        key={item.label}
        href={'href' in item ? item.href : `#${item.target}`}
        className="
            flex
            h-7
            w-27
            items-center
            justify-center
            rounded-full
            bg-white
            border border-black/5
            text-xs
            font-semibold
            text-slate-700
            shadow-sm
            transition-all
            hover:-translate-y-0.5
            hover:shadow-md
        "
        >
        {item.label}
        </a>
    ))}
    </div>
  );
}
