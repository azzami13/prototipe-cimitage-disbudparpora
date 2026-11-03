import SearchBar from "./SearchBar";
import { backendAssetUrl } from "@/lib/runtime-config";

export default function Hero() {
  return (
    <section className="relative h-52 md:h-50 lg:h-66 overflow-hidden">
      {/* Background */}
      <img
        src={backendAssetUrl('/uploads/beranda/cimahi.jpeg')}
        alt="Cimahi Heritage"
        className="
          absolute inset-0
          h-full w-full
          object-cover
          object-[center_45%]
        "
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Search */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <SearchBar />
      </div>
    </section>
  );
}
