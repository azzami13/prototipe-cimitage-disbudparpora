'use client';

import Link from 'next/link';

import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import Card from '@/components/ui/Card';

import HeritagePreviewMap from '@/components/maps/HeritagePreviewMap';

type HeritageSite = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

interface PreviewMapSectionProps {
  sites?: HeritageSite[];
}

const defaultSites: HeritageSite[] = [
    {
    id: 1,
    name: "Gedung Sudirman",
    latitude: -6.8857,
    longitude: 107.5428,
  },
  {
    id: 2,
    name: "Rumah Sakit Dustira",
    latitude: -6.8893,
    longitude: 107.5344,
  },
  {
    id: 3,
    name: "Stasiun Cimahi",
    latitude: -6.8851,
    longitude: 107.5418,
  },
];

export default function PreviewMapSection({
  sites = defaultSites,
}: PreviewMapSectionProps) {
  return (
    <Section>
      <SectionHeader
        title="Preview Peta Heritage"
        subtitle="Lihat persebaran situs heritage dan jalur wisata di Kota Cimahi melalui peta interaktif."
        action={
          <Link
            href="/peta"
            className="
              rounded-full
              border
              border-slate-200
              px-4
              py-2
              text-sm
              font-medium
              hover:bg-slate-100
              transition
            "
          >
            Lihat Peta
          </Link>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="relative">
          <HeritagePreviewMap sites={sites} />

          {/* Overlay Info */}
          <div
            className="
              absolute
              left-4
              right-4
              bottom-4
              grid
              grid-cols-3
              gap-3
            "
          >
            <div
              className="
                rounded-2xl
                bg-white/95
                backdrop-blur
                p-4
                shadow-sm
              "
            >
              <p className="text-2xl font-bold">
                12
              </p>

              <p className="text-xs text-slate-500">
                Situs Heritage
              </p>
            </div>

            <div
              className="
                rounded-2xl
                bg-white/95
                backdrop-blur
                p-4
                shadow-sm
              "
            >
              <p className="text-2xl font-bold">
                4
              </p>

              <p className="text-xs text-slate-500">
                Paket Wisata
              </p>
            </div>

            <div
              className="
                rounded-2xl
                bg-white/95
                backdrop-blur
                p-4
                shadow-sm
              "
            >
              <p className="text-2xl font-bold">
                Live
              </p>

              <p className="text-xs text-slate-500">
                Tracking Sakoci
              </p>
            </div>
          </div>
        </div>
      </Card>
    </Section>
  );
}