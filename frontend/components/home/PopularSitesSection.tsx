"use client";

// import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";

import PopularSiteCard from "./PopularSiteCard";

const sites = [
  {
    id: "1",
    name: "Gedung Sudirman",
    address:
      "Jl. Stasion, Baros, Kec. Cimahi Tengah, Kota Cimahi",
    image: "/images/landing/gedungsudirman.jpg",
  },
  {
    id: "2",
    name: "Rumah Sakit Dustira",
    address:
      "Jl. Dustira, Cimahi Tengah, Kota Cimahi",
    image: "/images/fallback-heritage.svg",
  },
  {
    id: "3",
    name: "Stasiun Cimahi",
    address:
      "Jl. Stasiun, Baros, Kota Cimahi",
    image: "/images/fallback-heritage.svg",
  },
  {
    id: "4",
    name: "Penjara Militer",
    address:
      "Jl. Gatot Subroto, Kota Cimahi",
    image: "/images/fallback-heritage.svg",
  },
  {
    id: "5",
    name: "Rumah Komandan",
    address:
      "Jl. Gatot Subroto, Kota Cimahi",
    image: "/images/fallback-heritage.svg",
  },
];

export default function PopularSitesSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollBy({
      left: direction === "right" ? 900 : -900,
      behavior: "smooth",
    });
  };

  return (
    <Section>
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Situs Wisata Populer"
          subtitle="Destinasi heritage yang paling banyak dikunjungi wisatawan."
        />

        <div className="hidden gap-2 md:flex">
            <button
            onClick={() => scroll("left")}
            className="
                flex h-10 w-10 items-center justify-center
                rounded-full border border-slate-200
                bg-white hover:bg-slate-100
            "
            >
            <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <path d="M15 18l-6-6 6-6" />
            </svg>
            </button>
            <button
            onClick={() => scroll("right")}
            className="
                flex h-10 w-10 items-center justify-center
                rounded-full border border-slate-200
                bg-white hover:bg-slate-100
            "
            >
            <svg    
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <path d="M9 18l6-6-6-6" />
            </svg>
            </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="
          flex
          gap-6
          overflow-x-auto
          scroll-smooth
          pb-4

          [&::-webkit-scrollbar]:hidden
          [-ms-overflow-style:none]
          [scrollbar-width:none]
        "
      >
        {sites.map((site) => (
          <PopularSiteCard
            key={site.id}
            {...site}
          />
        ))}
      </div>
    </Section>
  );
}
