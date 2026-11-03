import Link from "next/link";

type SiteCardProps = {
  id: string;
  name: string;
  address: string;
  image: string;
};

export default function PopularSiteCard({
  id,
  name,
  address,
  image,
}: SiteCardProps) {
  return (
    <Link
      href={`/heritage/${id}`}
      className="
        group
        block
        w-[180px]
        shrink-0
      "
    >
      <div
        className="
          overflow-hidden
          rounded-2xl
        "
      >
        <img
          src={image}
          alt={name}
          className="
            h-[220px]
            w-full
            object-cover
            transition-transform
            duration-300
            group-hover:scale-105
          "
        />
      </div>

      <h3
        className="
          mt-3
          line-clamp-1
          text-sm
          font-semibold
          text-slate-900
        "
      >
        {name}
      </h3>

      <p
        className="
          mt-1
          line-clamp-2
          text-xs
          leading-4
          text-slate-500
        "
      >
        {address}
      </p>
    </Link>
  );
}