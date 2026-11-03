import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";

import DashboardShortcut from "./DashboardShortcut";
import GuestIntroduction from "./GuestIntroduction";

export default function MyOrdersSection() {
  return (
    <Section
      className="-mt-10 relative z-10 py-4 md:py-8"
    >
      <DashboardShortcut />

        {/* <SectionHeader
          title="Pesanan Saya"
          subtitle="Lihat status pemesanan dan perjalanan wisata Anda."
        /> */}

        <GuestIntroduction />
    </Section>
  );
}