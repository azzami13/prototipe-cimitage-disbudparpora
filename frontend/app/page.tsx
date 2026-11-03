import Hero from "@/components/home/Hero";
import MyOrdersSection from "@/components/home/MyOrdersSection";
import PopularSitesSection from "@/components/home/PopularSitesSection";
import PreviewMapSection from "@/components/home/PreviewMapSection";

export default function HomePage() {
  return (
    <>
      <Hero />

      <MyOrdersSection />

      <PopularSitesSection />

      <PreviewMapSection />

      {/* <PackageSection />

      <Footer /> */}
    </>
  );
}